import { captureException, captureMessage } from "@sentry/react-native";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Image } from "expo-image";
import { useKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  NativeEventEmitter,
  NativeModules,
  Text,
  View,
} from "react-native";
import { Bar as ProgressBar } from "react-native-progress";
import { usePostFlashSuccess, useUploadFlashLogs } from "@/api/data-transfer";
import { infoIcon } from "@/assets/images/index";
import { PrimaryButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { OverlayView } from "@/components/ui/overlay";
import { colors } from "@/constants/colors";
import { metrics } from "@/constants/metrics";
import { toastError } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";

// Extend dayjs with duration plugin
dayjs.extend(duration);

const { BluetoothModule } = NativeModules;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type FlashingState = {
  mainProgress: number;
  subProgress: number;
  status: string;
};

export default function ControllerFlashScreen() {
  // Keep screen awake during flashing
  useKeepAwake();

  const { selectedEcu, controllersData, setIsUpdateAvailableToFalse } =
    useDataTransferStore();
  const { userInfo, handleLogout } = useAuthStore();
  const { trigger: uploadFlashLogs } = useUploadFlashLogs();
  const { trigger: postFlashSuccess } = usePostFlashSuccess();

  const [isVisible, setIsVisible] = useState(false);
  const [flashingState, setFlashingState] = useState<FlashingState | null>(
    null
  );
  const [_, setPrevFlashingState] = useState<FlashingState | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [failureMessage, setFailureMessage] = useState("");
  const [flashDuration, setFlashDuration] = useState<duration.Duration | null>(
    null
  );
  const [isPerFrameUpdateEnabled, setPerFrameUpdateEnabled] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const timeStartRef = useRef<dayjs.Dayjs | null>(null);
  const isFlashingUpdatedRef = useRef(false);

  const toggleOverlay = () => {
    setIsVisible(!isVisible);
  };

  const handleStartTimeout = (delay = 5000) => {
    handleCancelTimeout();
    if (timeoutRef.current !== null) {
      return;
    }

    // Timeout to detect unresponsive ECU during flashing
    // Uses dynamicWaitTime from ECU config (default: 6000ms)
    const id = setTimeout(() => {
      console.log("[ControllerFlash] Flash timeout reached");

      captureMessage("Controller flash timeout", {
        level: "warning",
        tags: {
          operation: "controller_flash",
          ecu_name: selectedEcu?.ecuName || "unknown",
        },
        extra: {
          timeout_duration: delay,
          ecu_index: selectedEcu?.index,
        },
      });

      isFlashingUpdatedRef.current = false;
      setIsVisible(false);
      setIsFlashing(false);
      handleFailure("Timeout Please Try Again");
    }, delay);

    timeoutRef.current = id;
  };

  const handleCancelTimeout = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleFailure = (message = "") => {
    setFailureMessage(message);
    setShowConfirmationModal(true);
  };

  const formatDuration = (dur: duration.Duration): string => {
    const hours = Math.floor(dur.asHours());
    const minutes = dur.minutes();
    const seconds = dur.seconds();

    let result = "";
    if (hours > 0) {
      result += ` ${hours} hr :`;
    }
    if (minutes > 0) {
      result += ` ${minutes} min :`;
    }
    result += ` ${seconds} sec`;
    return result;
  };

  const uploadLogs = async () => {
    try {
      if (selectedEcu && userInfo) {
        const ecu = selectedEcu as unknown as {
          vinNumber: string;
          oldHexFileName: string;
        };
        await uploadFlashLogs({
          serialNumber: userInfo.serial_number,
          vinNumber: ecu.vinNumber,
          hexFile: ecu.oldHexFileName,
        });
      }
    } catch (error) {
      console.log("[ControllerFlash] Upload logs error:", error);
      captureException(error, {
        tags: {
          operation: "upload_flash_logs",
          ecu_name: selectedEcu?.ecuName || "unknown",
        },
        extra: {
          ecu_index: selectedEcu?.index,
          serial_number: userInfo?.serial_number,
        },
      });
    }
  };

  const uploadLogsOnSuccess = async () => {
    try {
      if (!selectedEcu) {
        return;
      }
      // const moduleToUse =
      //   dataTransferMode === "Bluetooth" ? BluetoothModule : USBModule;
      const isUploadRequired = await BluetoothModule.isUploadBothLog(
        selectedEcu.index
      );

      if (isUploadRequired && userInfo) {
        const ecu = selectedEcu as unknown as {
          vinNumber: string;
          oldHexFileName: string;
        };
        await uploadFlashLogs({
          serialNumber: userInfo.serial_number,
          vinNumber: ecu.vinNumber,
          hexFile: ecu.oldHexFileName,
        });
      }
    } catch (error) {
      console.log("[ControllerFlash] Upload logs on success error:", error);
      captureException(error, {
        tags: {
          operation: "upload_logs_on_success",
          ecu_name: selectedEcu?.ecuName || "unknown",
        },
        extra: {
          ecu_index: selectedEcu?.index,
          serial_number: userInfo?.serial_number,
        },
      });
    }
  };

  const postSuccessFlash = async () => {
    try {
      if (!(selectedEcu && userInfo)) {
        return;
      }

      setIsUpdateAvailableToFalse(controllersData, selectedEcu.index);

      const ecu = selectedEcu as unknown as {
        vinNumber: string;
        oldHexFileName: string;
      };

      const response = await postFlashSuccess({
        serialNumber: userInfo.serial_number,
        vinNumber: ecu.vinNumber,
        hexFileName: ecu.oldHexFileName,
      });

      if (response.error === 401) {
        toastError("You've been inactive for a while, Please login again.");
        handleLogout();
        return;
      }

      await uploadLogsOnSuccess();

      // Log successful flash completion to Sentry
      captureMessage("Controller flash completed successfully", {
        level: "info",
        tags: {
          operation: "controller_flash_success",
          ecu_name: selectedEcu?.ecuName || "unknown",
        },
        extra: {
          ecu_index: selectedEcu?.index,
          hex_file: ecu.oldHexFileName,
          vin_number: ecu.vinNumber,
        },
      });
    } catch (error: unknown) {
      console.log("[ControllerFlash] Post success flash error:", error);
      captureException(error, {
        tags: {
          operation: "post_flash_success",
          ecu_name: selectedEcu?.ecuName || "unknown",
        },
        extra: {
          ecu_index: selectedEcu?.index,
          serial_number: userInfo?.serial_number,
        },
      });
    }
  };

  const postDongleFlash = () => {
    if (selectedEcu?.ecuName.toLowerCase().includes("dongle")) {
      // const moduleToUse =
      //   dataTransferMode === "Bluetooth" ? BluetoothModule : USBModule;
      BluetoothModule.checkIsDongleStuckInBoot();
    }
  };

  const getStatus = (message: unknown): string => {
    if (message == null) {
      return "";
    }

    const trimmedMessage = String(message).trim();
    if (trimmedMessage[0] === "{") {
      try {
        const json = JSON.parse(trimmedMessage) as { value?: unknown };
        return String(json.value ?? message);
      } catch {
        return String(message);
      }
    }
    return String(message);
  };

  const handleFlashFailure = (flashResponse: FlashingState) => {
    if (flashResponse?.status?.toLowerCase()?.includes("same version")) {
      postSuccessFlash();
    } else {
      // Capture flash failure in Sentry
      captureMessage("Controller flash failed", {
        level: "error",
        tags: {
          operation: "controller_flash_failure",
          ecu_name: selectedEcu?.ecuName || "unknown",
        },
        extra: {
          failure_status: flashResponse.status,
          main_progress: flashResponse.mainProgress,
          sub_progress: flashResponse.subProgress,
          ecu_index: selectedEcu?.index,
        },
      });
    }

    cleanup();
    setFailureMessage(flashResponse.status);
    setShowConfirmationModal(true);
    BluetoothModule.saveAppLog(selectedEcu?.index);
  };

  const handleFlashSuccess = (flashResponse: FlashingState) => {
    const statusLowerCase = flashResponse?.status?.toLowerCase();
    if (statusLowerCase?.includes(selectedEcu?.ecuName?.toLowerCase())) {
      postSuccessFlash();
      setFlashingState({ ...flashResponse, status: "DONE" });
      cleanup();
      return true;
    }
    return false;
  };

  const onResponse = (response: {
    name: string;
    value: { mainProgress: number; subProgress: number; status: string };
  }) => {
    if (response.name === "updateFlash") {
      const flashResponse: FlashingState = {
        ...response.value,
        status: getStatus(response.value.status),
      };

      if (isPerFrameUpdateEnabled) {
        console.log(
          "[ControllerFlash] handleStartTimeout onresponse cancel old and new start",
          ", delay:",
          selectedEcu?.dynamicWaitTime
        );
        // Reset timeout on each frame update to detect ECU unresponsiveness
        if (selectedEcu?.dynamicWaitTime) {
          handleStartTimeout(selectedEcu.dynamicWaitTime);
        }
      }

      // Store previous state for error reporting
      if (
        flashResponse.mainProgress !== -1 &&
        flashResponse.subProgress !== -1
      ) {
        setPrevFlashingState(flashResponse);
      }

      // Reset timeout when progress update received (ECU is still responding)
      if (isPerFrameUpdateEnabled && selectedEcu?.dynamicWaitTime) {
        handleStartTimeout(selectedEcu.dynamicWaitTime);
      }

      // Update elapsed flashing duration for display
      if (timeStartRef.current) {
        const now = dayjs();
        const diff = now.diff(timeStartRef.current);
        setFlashDuration(dayjs.duration(diff));
      }

      // Failure condition
      if (
        flashResponse.mainProgress === -1 ||
        flashResponse.subProgress === -1
      ) {
        handleFlashFailure(flashResponse);
        handleCancelTimeout();
        return;
      }

      // Success condition
      if (
        flashResponse.mainProgress === 100 &&
        handleFlashSuccess(flashResponse)
      ) {
        handleCancelTimeout();
        return;
      }

      setFlashingState(flashResponse);
    } else if (response.name === "bootFlash") {
      console.log("[ControllerFlash] bootFlash response:", response?.value);
    }
  };

  const cleanup = React.useCallback(() => {
    // const moduleToUse =
    //   dataTransferMode === "Bluetooth" ? BluetoothModule : USBModule;

    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }

    BluetoothModule.unSubscribeToFlashingUpdate();
    BluetoothModule.stopAllTimersFromReact();

    isFlashingUpdatedRef.current = false;
    setIsVisible(false);
    setIsFlashing(false);
    handleCancelTimeout();
  }, [handleCancelTimeout]);

  const reProgram = async () => {
    if (!selectedEcu) {
      return;
    }

    try {
      // const moduleToUse =
      //   dataTransferMode === "Bluetooth" ? BluetoothModule : USBModule;
      const eventEmitter = new NativeEventEmitter(BluetoothModule);

      BluetoothModule.subscribeToFlashingUpdate(selectedEcu.index);
      subscriptionRef.current = eventEmitter.addListener(
        "updateFlash",
        onResponse
      );

      setIsFlashing(true);
      isFlashingUpdatedRef.current = true;
      timeStartRef.current = dayjs();

      // isShowUpdatePerFrameTime: Enable per-frame progress updates (default: true)
      // dynamicWaitTime: Max time to wait for ECU response (default: 6000ms)
      setPerFrameUpdateEnabled(selectedEcu.isShowUpdatePerFrameTime);

      // Log flash start to Sentry
      captureMessage("Controller flash started", {
        level: "info",
        tags: {
          operation: "controller_flash_start",
          ecu_name: selectedEcu?.ecuName || "unknown",
        },
        extra: {
          ecu_index: selectedEcu?.index,
          is_per_frame_update: selectedEcu.isShowUpdatePerFrameTime,
          dynamic_wait_time: selectedEcu.dynamicWaitTime,
        },
      });

      console.log("[ControllerFlash] Starting reprogramming", {
        isShowUpdatePerFrameTime: selectedEcu.isShowUpdatePerFrameTime,
        dynamicWaitTime: selectedEcu.dynamicWaitTime,
      });

      if (isPerFrameUpdateEnabled && selectedEcu.dynamicWaitTime) {
        // Use ECU-specific timeout for monitoring responsiveness
        handleStartTimeout(selectedEcu.dynamicWaitTime);
      } else {
        // Fallback: Use long timeout when per-frame updates disabled
        let totalTime = 0;
        while (isFlashingUpdatedRef.current) {
          await sleep(10);
          if (totalTime > 9_000_000) {
            isFlashingUpdatedRef.current = false;
            setIsVisible(false);
            setIsFlashing(false);
            handleFailure("Timeout Please Try Again");
            break;
          }
          totalTime += 10;
        }
      }
    } catch (error) {
      console.log("[ControllerFlash] reProgram error:", error);
      captureException(error, {
        tags: {
          operation: "reprogram_start",
          ecu_name: selectedEcu?.ecuName || "unknown",
        },
        extra: {
          ecu_index: selectedEcu?.index,
        },
      });
      handleFailure("Failed to start flashing");
    }
  };

  const getPercentage = (input: number): number => {
    const parsedNumber = Number.parseInt(String(input), 10);
    if (Number.isNaN(parsedNumber)) {
      return 0;
    }
    return Math.min(100, Math.max(0, parsedNumber));
  };

  // Cleanup on unmount
  useEffect(() => {
    if (isFlashing) {
      return () => {
        subscriptionRef.current?.remove();
        BluetoothModule.unSubscribeToFlashingUpdate();
        BluetoothModule.stopAllTimersFromReact();
      };
    }
  }, [isFlashing]);

  // Handle back button
  const handleBackButton = React.useCallback(() => {
    if (isFlashing) {
      return true;
    }
    router.push("/(main)/controllers/operations");
    return true;
  }, [isFlashing]);

  useFocusEffect(
    React.useCallback(() => {
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackButton
      );
      return () => {
        backHandler.remove();
        if (isFlashing) {
          cleanup();
        }
      };
    }, [isFlashing, handleBackButton, cleanup])
  );

  const FailureModal = () => (
    <View className="absolute inset-0 items-center justify-center bg-black/50">
      <View
        className="rounded-lg bg-white px-4 py-4"
        style={{ width: metrics.width / 1.2 }}
      >
        <View className="items-center">
          <Image className="h-10 w-10" contentFit="contain" source={infoIcon} />
        </View>
        <Text className="mt-4 text-center font-proximanova text-lg">
          {failureMessage}
          {/* {prevFlashingState?.mainProgress || prevFlashingState?.subProgress
            ? `#B${prevFlashingState.mainProgress}#S${prevFlashingState.subProgress}`
            : ""} */}
        </Text>
        <View className="mt-4">
          <PrimaryButton
            onPress={() => {
              uploadLogs();
              postDongleFlash();
              router.push("/(main)/controllers/operations");
            }}
            text="Okay"
          />
        </View>
      </View>
    </View>
  );

  return (
    <>
      <CustomHeader leftButtonType="back" renderLeftButton title="CONTROLLER" />

      <View className="absolute top-20 z-[100] w-full">
        <Text className="my-4 pt-5 text-center font-helveticaBold text-xl">
          {selectedEcu?.ecuName}
        </Text>
        {isPerFrameUpdateEnabled && flashDuration && (
          <Text className="my-4 text-center font-helveticaBold text-xl">
            Flashing Time:{formatDuration(flashDuration)}
          </Text>
        )}
      </View>

      <View className="mx-4 flex-1 justify-center bg-[#f3f3f3]">
        <View className="items-center justify-center">
          {!isFlashing &&
            flashingState?.status !== "DONE" &&
            !showConfirmationModal && (
              <OverlayView
                description="RF Noise may lead to flashing failure, you may need to re-attempt flashing"
                primaryButtonOnPress={() => {
                  reProgram();
                  toggleOverlay();
                  // BluetoothModule.updateBootLoader(); // not needed
                }}
                primaryButtonText="OKAY"
                secondDescription={`Ensure that ${(selectedEcu as unknown as { oldHexFileName: string })?.oldHexFileName} is associated with ${selectedEcu?.ecuName}?`}
                title="NOTE"
                whiteButtonOnPress={() =>
                  router.push("/(main)/controllers/operations")
                }
                whiteButtonText="CANCEL"
              />
            )}

          <LinearGradient
            className="flex-1"
            colors={["#4c669f", "#3b5998", "#192f6a"]}
          />

          {flashingState?.status !== "DONE" && isVisible && (
            <View className="rounded-lg bg-white p-4">
              <View className="min-w-[76.92%]">
                <Text className="mb-2 font-helveticaBold text-2xl">
                  {flashingState?.status}
                </Text>

                <Text className="mb-2 font-helveticaBold text-lg">
                  Block Progress:
                </Text>
                <View className="flex-row items-center">
                  <ProgressBar
                    animated={false}
                    borderColor="#f4f4f4"
                    color={colors.primaryColor}
                    progress={
                      getPercentage(flashingState?.mainProgress || 0) / 100
                    }
                    unfilledColor="#f4f4f4"
                    width={metrics.width / 1.5}
                  />
                  <Text className="ml-2.5 w-14">
                    {getPercentage(flashingState?.mainProgress || 0)} %
                  </Text>
                </View>

                <Text className="mt-4 mb-2 font-helveticaBold text-lg">
                  Segment Progress:
                </Text>
                <View className="flex-row items-center">
                  <ProgressBar
                    animated={false}
                    borderColor="#f4f4f4"
                    color={colors.primaryColor}
                    progress={
                      getPercentage(flashingState?.subProgress || 0) / 100
                    }
                    unfilledColor="#f4f4f4"
                    width={metrics.width / 1.5}
                  />
                  <Text className="ml-2.5 w-14">
                    {getPercentage(flashingState?.subProgress || 0)} %
                  </Text>
                </View>
              </View>
            </View>
          )}

          {flashingState?.status === "DONE" && (
            <View className="rounded-lg bg-white px-4 py-4">
              <Text className="my-4 text-center font-helveticaBold text-xl">
                Finished Flashing
              </Text>
              <Text className="mx-4 my-2 text-center text-[#5d5d5d] text-base">
                Controller Flashed Successfully ... Toggle the ignition please!
              </Text>
              <View className="mx-4 mt-6">
                <PrimaryButton
                  onPress={() => {
                    postDongleFlash();
                    router.push("/(main)/flashing/flash-success");
                  }}
                  text="OKAY"
                />
              </View>
            </View>
          )}

          {showConfirmationModal && <FailureModal />}
        </View>
      </View>
    </>
  );
}
