/**
 * ECU Dump Screen
 *
 * Handles offline analytics data collection from vehicle ECUs.
 *
 * Flow:
 * 1. Clean up previous dump attempts
 * 2. Subscribe to native dump events
 * 3. Monitor collection progress with multiple timeout conditions
 * 4. On success: Zip files and queue for upload
 * 5. On failure: Save error logs and update status
 */

import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { captureException, captureMessage } from "@sentry/react-native";
import dayjs from "dayjs";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  BackHandler,
  Dimensions,
  Image,
  NativeEventEmitter,
  NativeModules,
  Text,
  View,
} from "react-native";
import { Bar as ProgressBar } from "react-native-progress";
import { useUploadEeDumpWithEcu } from "@/api/data-transfer";
import { infoIcon } from "@/assets/images";
import { PrimaryButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import {
  cleanupPreviousEEDump,
  createZipAndQueueJob,
  getPendingJobs,
} from "@/lib/eedump-file-manager";
import {
  OACollectionStatus,
  type OACollectionStatusCode,
  updateCollectionStatus,
} from "@/lib/offline-analytics";
import { toastInfo } from "@/lib/toast";
import { useDataTransferStore } from "@/store/data-transfer-store";

const { BluetoothModule } = NativeModules;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================
// Types
// ============================================

type CollectionState = "WAITING" | "COLLECTING" | "COMPLETE";

type DumpProgress = {
  state: CollectionState;
  percent: number;
  message: string;
  uploadStatus?: "pending" | "success" | "failed";
};

type DumpResponse = {
  status: boolean;
  processStatus?: "upload" | "inProgress";
  isReadyToUpload?: boolean;
  EEDumpPercent?: number;
  EEDumpPosOn?: number;
  message?: string;
};

// ============================================
// Constants
// ============================================

const TIMEOUT_CONFIG = {
  /** Maximum total wait time (8 minutes) */
  MAX_TOTAL_WAIT: 8 * 60 * 1000,
  /** Absolute maximum wait time (10 minutes) */
  ABSOLUTE_MAX_WAIT: 10 * 60 * 1000,
  /** Polling interval for timeout checks */
  POLL_INTERVAL: 10,
} as const;

// ============================================
// Module-Level Variables
// ============================================

let isCollectionActive = false;
let lastResponseTime = 0;

// ============================================
// Helper Functions
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value || 0));
}

function isNRCError(value: string): boolean {
  return value.toLowerCase().includes("nrc");
}

// ============================================
// Main Component
// ============================================

export default function ECUDumpScreen() {
  // ============================================
  // Store & Hooks
  // ============================================

  const navigation = useNavigation();
  const { selectedEcu, vin, isDonglePhase3State, updateDongleToDisconnected } =
    useDataTransferStore();
  const { trigger: uploadDumps } = useUploadEeDumpWithEcu();

  // ============================================
  // State
  // ============================================

  const [progress, setProgress] = useState<DumpProgress>({
    state: "WAITING",
    percent: 0,
    message: "Initializing...",
  });
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureMessage, setFailureMessage] = useState("");

  // ============================================
  // Refs
  // ============================================

  const collectionStartTimeRef = useRef<dayjs.Dayjs | null>(null);
  const lastProgressMessageRef = useRef("");

  // ============================================
  // Collection Status Updates
  // ============================================

  /**
   * Save collection status to persistent storage
   */
  const saveCollectionStatus = (status: OACollectionStatusCode): void => {
    if (!(vin && selectedEcu)) {
      console.warn("[ECUDump] Missing VIN or ECU for status update");
      return;
    }

    updateCollectionStatus(vin, selectedEcu.ecuName, status);
  };

  // ============================================
  // Post-Collection Operations
  // ============================================

  /**
   * Handle post-collection tasks: cleanup, zip, and upload
   */
  const finalizeCollection = async (
    status: "Success" | "Failure"
  ): Promise<void> => {
    try {
      BluetoothModule.unsubscribeToDump();
      BluetoothModule.stopAllTimersFromReact();
      BluetoothModule.saveAppLog(selectedEcu?.index || 0);

      // Create zip and queue for upload
      const zipCreated = await createZipAndQueueJob(
        vin || "",
        selectedEcu?.ecuName || "",
        status
      );

      if (!zipCreated) {
        console.log("[ECUDump] No files to upload");
        setProgress((prev) => ({
          ...prev,
          uploadStatus: "failed",
          message: "No files collected. Please try again.",
        }));
        return;
      }

      // Trigger upload
      await uploadDumps({});

      // Check remaining jobs
      const remainingJobs = getPendingJobs();

      if (remainingJobs.length === 0) {
        console.log("[ECUDump] All files uploaded successfully");
        setProgress((prev) => ({
          ...prev,
          uploadStatus: "success",
          message: "All files have been successfully uploaded to the server.",
        }));
      } else {
        console.log(`[ECUDump] ${remainingJobs.length} job(s) pending upload`);
        setProgress((prev) => ({
          ...prev,
          uploadStatus: "failed",
          message:
            "Failed to upload offline analytics data.\nPlease check your internet connectivity and try again later.",
        }));
      }
    } catch (error) {
      console.error("[ECUDump] Finalize collection error:", error);
      setProgress((prev) => ({
        ...prev,
        uploadStatus: "failed",
        message:
          "Failed to upload offline analytics data.\nPlease move to an area with better connectivity and try again later.",
      }));
    }
  };

  // ============================================
  // Failure Handling
  // ============================================

  /**
   * Handle collection failure with cleanup and status update
   */
  const handleCollectionFailure = async (
    message: string,
    statusCode: OACollectionStatusCode
  ): Promise<void> => {
    console.log(`[ECUDump] Collection failed - Status: ${statusCode}`);

    isCollectionActive = false;

    // Log failure to Sentry
    captureMessage("Offline analytics collection failed", {
      level: "error",
      tags: {
        operation: "oa_collection_failure",
        ecu_name: selectedEcu?.ecuName || "unknown",
        status_code: statusCode,
      },
      extra: {
        ecu_index: selectedEcu?.index,
        vin_number: vin,
        failure_message: message,
        collection_duration_ms: collectionStartTimeRef.current
          ? dayjs().valueOf() - collectionStartTimeRef.current.valueOf()
          : null,
      },
    });

    // Save failure status
    saveCollectionStatus(statusCode);

    // Finalize and attempt upload of error logs
    await finalizeCollection("Failure");

    // Clean up dump folder
    cleanupPreviousEEDump();

    // Show failure modal
    setFailureMessage(message);
    setShowFailureModal(true);

    setProgress({
      state: "COMPLETE",
      percent: 0,
      message,
      uploadStatus: "failed",
    });
  };

  // ============================================
  // Dump Response Handler
  // ============================================

  /**
   * Handle eeDump events from native module
   */
  const handleDumpResponse = (response: {
    name: string;
    value: string;
  }): void => {
    if (response.name !== "eeDump") {
      return;
    }

    try {
      // Update last response time for timeout tracking
      lastResponseTime = dayjs().valueOf();

      // Check for NRC errors
      if (isNRCError(response.value)) {
        console.log(`[ECUDump] NRC Error: ${response.value}`);
        handleCollectionFailure(
          response.value,
          OACollectionStatus.LIBRARY_ERROR
        );
        return;
      }

      // Parse JSON response
      if (response.value[0] !== "{") {
        return;
      }

      const dumpData = JSON.parse(response.value) as DumpResponse;

      // Handle failure response
      if (!dumpData.status) {
        const statusCode =
          dumpData.EEDumpPosOn === -2
            ? OACollectionStatus.LIBRARY_ERROR_NEG2
            : OACollectionStatus.LIBRARY_ERROR;

        handleCollectionFailure(
          dumpData.message || "Collection failed",
          statusCode
        );
        return;
      }

      // Handle upload ready
      if (dumpData.processStatus === "upload") {
        if (dumpData.isReadyToUpload) {
          console.log("[ECUDump] Collection complete, ready for upload");

          isCollectionActive = false;

          setProgress({
            state: "COMPLETE",
            percent: 100,
            message: "Completed",
            uploadStatus: "pending",
          });

          saveCollectionStatus(OACollectionStatus.SUCCESS);
          finalizeCollection("Success");
        } else {
          handleCollectionFailure(
            dumpData.message || "Upload not ready",
            OACollectionStatus.LIBRARY_ERROR
          );
        }
        return;
      }

      // Handle progress updates
      if (dumpData.message && dumpData.message.length > 0) {
        const progressKey = `${dumpData.EEDumpPercent},${dumpData.message}`;

        // Skip duplicate progress messages
        if (
          lastProgressMessageRef.current === progressKey ||
          dumpData.message.startsWith("Collected the data")
        ) {
          return;
        }

        lastProgressMessageRef.current = progressKey;

        console.log(
          `[ECUDump] Progress: ${dumpData.EEDumpPercent}% - ${dumpData.message}`
        );

        setProgress({
          state: "COLLECTING",
          percent: dumpData.EEDumpPercent || 0,
          message: dumpData.message,
        });
      }
    } catch (error) {
      console.error("[ECUDump] Response handler error:", error);

      captureException(error, {
        tags: {
          operation: "oa_response_handler_error",
          ecu_name: selectedEcu?.ecuName || "unknown",
        },
        extra: {
          ecu_index: selectedEcu?.index,
          vin_number: vin,
          response_value: response.value,
        },
      });

      handleCollectionFailure(
        "There is an issue collecting data. Please toggle the ignition and try again.",
        OACollectionStatus.EXCEPTION
      );
    }
  };

  // ============================================
  // Timeout Monitoring
  // ============================================

  /**
   * Monitor collection progress with multiple timeout conditions
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex timeout monitoring logic required
  const monitorTimeouts = async (): Promise<void> => {
    let elapsedTime = 0;
    const ecuTimeout = (selectedEcu?.dynamicWaitTime || 480) * 1000;

    console.log(
      `[ECUDump] Timeout monitoring started - ECU timeout: ${ecuTimeout}ms, Max: ${TIMEOUT_CONFIG.ABSOLUTE_MAX_WAIT}ms`
    );

    while (isCollectionActive) {
      await sleep(TIMEOUT_CONFIG.POLL_INTERVAL);

      const now = dayjs().valueOf();
      const timeSinceLastResponse = now - lastResponseTime;
      const totalElapsed =
        now - (collectionStartTimeRef.current?.valueOf() || now);

      // Check timeout conditions
      if (
        timeSinceLastResponse > ecuTimeout ||
        totalElapsed > TIMEOUT_CONFIG.ABSOLUTE_MAX_WAIT ||
        elapsedTime > TIMEOUT_CONFIG.MAX_TOTAL_WAIT
      ) {
        console.log(
          `[ECUDump] Timeout detected - Since last response: ${timeSinceLastResponse}ms, Total: ${totalElapsed}ms`
        );

        isCollectionActive = false;

        // Determine timeout type and status
        let statusCode: OACollectionStatusCode;
        let message: string;

        if (timeSinceLastResponse > ecuTimeout) {
          statusCode = OACollectionStatus.TIMEOUT_NO_RESPONSE;
          message = `Timeout: ${selectedEcu?.ecuName || "ECU"} did not respond for ${ecuTimeout}ms.\nPlease check the BT dongle or toggle the ignition and try again.`;
        } else if (totalElapsed > TIMEOUT_CONFIG.ABSOLUTE_MAX_WAIT) {
          statusCode = OACollectionStatus.TIMEOUT_MAX;
          message =
            "Timeout after waiting for 10 minutes.\nPlease check the BT dongle or toggle the ignition and try again.";
        } else {
          statusCode = OACollectionStatus.TIMEOUT_GENERAL;
          message =
            "Timeout occurred after 10 minutes or more.\nPlease check the BT dongle or toggle the ignition and try again.";
        }

        // Log timeout to Sentry
        captureMessage("Offline analytics collection timeout", {
          level: "warning",
          tags: {
            operation: "oa_collection_timeout",
            ecu_name: selectedEcu?.ecuName || "unknown",
            timeout_type: statusCode,
          },
          extra: {
            ecu_index: selectedEcu?.index,
            vin_number: vin,
            time_since_last_response_ms: timeSinceLastResponse,
            total_elapsed_ms: totalElapsed,
            ecu_timeout_ms: ecuTimeout,
          },
        });

        handleCollectionFailure(message, statusCode);
        BluetoothModule.saveAppLog(selectedEcu?.index || 0);
        break;
      }

      elapsedTime += TIMEOUT_CONFIG.POLL_INTERVAL;
    }
  };

  // ============================================
  // Main Collection Function
  // ============================================

  /**
   * Start offline analytics collection process
   */
  const startCollection = () => {
    try {
      console.log(
        `[ECUDump] Starting collection - ECU: ${selectedEcu?.ecuName}, VIN: ${vin}`
      );

      // Clean up previous attempts
      cleanupPreviousEEDump();

      // Mark collection as started
      saveCollectionStatus(OACollectionStatus.STARTED);

      // Subscribe to dump events
      BluetoothModule.subscribeToDump(selectedEcu?.index || 0);

      // Initialize state
      isCollectionActive = true;
      lastResponseTime = dayjs().valueOf();
      collectionStartTimeRef.current = dayjs();

      setProgress({
        state: "COLLECTING",
        percent: 0,
        message: "Starting offline analytics collection...",
      });

      // Start timeout monitoring
      monitorTimeouts();
    } catch (error) {
      console.error("[ECUDump] Start collection error:", error);

      captureException(error, {
        tags: {
          operation: "oa_start_collection_error",
          ecu_name: selectedEcu?.ecuName || "unknown",
        },
        extra: {
          ecu_index: selectedEcu?.index,
          vin_number: vin,
        },
      });

      handleCollectionFailure(
        "Failed to start collection. Please try again.",
        OACollectionStatus.EXCEPTION
      );
    }
  };

  // ============================================
  // Navigation Guards
  // ============================================

  /**
   * Check if collection is currently active
   */
  const checkIsCollecting = (): boolean => isCollectionActive;

  /**
   * Prevent back navigation during active collection
   */
  const handleBackPress = (): boolean => {
    if (checkIsCollecting()) {
      toastInfo(
        "Collection in Progress",
        "Please wait for the offline analytics collection to complete"
      );
      return true;
    }
    return false;
  };

  /**
   * Handle completion button press
   */
  const handleComplete = (): void => {
    if (showFailureModal) {
      setShowFailureModal(false);
    }
    router.replace("/(main)/controllers");
  };

  // ============================================
  // Effects
  // ============================================

  /**
   * Start collection on mount and cleanup on unmount
   */
  useFocusEffect(
    // biome-ignore lint/correctness/useExhaustiveDependencies: Effect only needs to run on mount/unmount
    useCallback(() => {
      // Create event emitter and subscribe to dump events
      const eventEmitter = new NativeEventEmitter(BluetoothModule);
      const subscription = eventEmitter.addListener(
        "eeDump",
        handleDumpResponse
      );

      startCollection();

      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackPress
      );

      const unsubscribeBeforeRemove = navigation.addListener(
        "beforeRemove",
        (e) => {
          if (checkIsCollecting()) {
            e.preventDefault();
            toastInfo(
              "Collection in Progress",
              "Please wait for the offline analytics collection to complete"
            );
          }
        }
      );

      return () => {
        backHandler.remove();
        unsubscribeBeforeRemove();
        subscription.remove();

        BluetoothModule.unsubscribeToDump();
        BluetoothModule.stopAllTimersFromReact();
      };
    }, [navigation])
  );

  // ============================================
  // Render
  // ============================================

  const FailureModal = () => (
    <View className="absolute inset-0 items-center justify-center">
      <View
        className="items-center rounded-lg bg-white px-4 py-4"
        style={{ width: SCREEN_WIDTH / 1.2 }}
      >
        <Image className="h-10 w-10" source={infoIcon} />
        <Text className="mx-4 mt-4 mb-4 text-center font-bold text-lg">
          {failureMessage}
        </Text>
        <View className="mt-6">
          <PrimaryButton onPress={handleComplete} text="OKAY" />
        </View>
      </View>
    </View>
  );

  return (
    <>
      <CustomHeader
        leftButtonFunction={() => {
          if (checkIsCollecting()) {
            toastInfo(
              "Collection in Progress",
              "Please wait for the offline analytics collection to complete"
            );
          } else {
            router.replace("/(main)/controllers");
          }
        }}
        leftButtonType="back"
        onDisconnect={() => updateDongleToDisconnected(true)}
        renderLeftButton={true}
        renderRightButton={isDonglePhase3State && !checkIsCollecting()}
        rightButtonType="menu"
        title="CONTROLLER"
      />

      <View style={{ flex: 1 }}>
        {/* ECU Name Header */}
        <Text className="my-4 text-center font-bold text-xl">
          {selectedEcu?.ecuName || ""}
        </Text>

        {/* Main Content */}
        <View
          className="mx-4 flex-1 items-center justify-center"
          style={{ backgroundColor: "#f3f3f3" }}
        >
          {/* Collecting State */}
          {progress.state === "COLLECTING" && (
            <View
              className="items-center justify-center rounded-lg bg-white p-4"
              style={{
                width: SCREEN_WIDTH - 64,
                minHeight: 200,
                borderWidth: 0.4,
                top: -34,
                marginHorizontal: 32,
              }}
            >
              <Text className="mb-2 font-bold text-lg">{progress.message}</Text>
              <Text className="mb-2 font-bold text-lg">Progress:</Text>

              <View className="w-full flex-row items-center justify-center px-2">
                <ProgressBar
                  animated={false}
                  borderColor="#f4f4f4"
                  color="#4CAF50"
                  progress={clampPercent(progress.percent) / 100}
                  unfilledColor="#f4f4f4"
                  width={SCREEN_WIDTH / 1.5}
                />
                <Text className="ml-2 w-14 text-center">
                  {clampPercent(progress.percent)} %
                </Text>
              </View>
            </View>
          )}

          {/* Complete State */}
          {progress.state === "COMPLETE" && (
            <View className="bg-white py-4">
              {progress.uploadStatus === "pending" && (
                <View className="items-center bg-white">
                  <Text className="mx-4 mt-4 mb-4 text-center font-bold text-lg">
                    Finished offline analytics successfully.{"\n"}
                    Please wait, uploading the file...
                  </Text>
                </View>
              )}

              {progress.uploadStatus !== "pending" && (
                <>
                  <View className="items-center">
                    <Image className="h-10 w-10" source={infoIcon} />
                  </View>
                  <Text className="mx-4 mt-4 mb-4 text-center font-bold text-lg">
                    {progress.message}
                  </Text>
                  <PrimaryButton
                    className="mx-4 mt-6"
                    onPress={handleComplete}
                    text="OKAY"
                  />
                </>
              )}
            </View>
          )}

          {showFailureModal && <FailureModal />}
        </View>
      </View>
    </>
  );
}
