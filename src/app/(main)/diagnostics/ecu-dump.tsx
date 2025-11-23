import dayjs from "dayjs";
import { Directory, Paths } from "expo-file-system";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Dimensions,
  type EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  Text,
  View,
} from "react-native";
import { useMMKVObject, useMMKVString } from "react-native-mmkv";
import { Bar as ProgressBar } from "react-native-progress";
import { zip } from "react-native-zip-archive";

import { infoIcon } from "@/assets/images/index";
import { PrimaryButton } from "@/components/ui/button";
import { OverlayLoading } from "@/components/ui/overlay";
import { colors } from "@/constants/colors";
import { useDataTransferStore } from "@/store/data-transfer-store";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const { BluetoothModule } = NativeModules;

let todayDateTimeF: number;
let isFlashingUpdated: boolean;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Status codes for OAC tracking
const OACStatus = {
  START: 0,
  COMPLETE: 1,
  LIB_ERROR: 2,
  LIB_ERROR_NEG2: -2,
  LIB_ERROR_NEG3: -3,
  EXCEPTION: 3,
  TIMEOUT_10MIN: 4,
  NO_RESPONSE_5SEC: 5,
  TIMEOUT_UI: 6,
} as const;

type OACStatus = (typeof OACStatus)[keyof typeof OACStatus];

type EDumpState = {
  status: "WAITING" | "LOADING" | "DONE" | null;
  message: string;
  mainProgress: number;
  responseMsg: string;
  isUploadStatus?: boolean;
};

type EeDumpJob = {
  filePath: string;
  time: string;
  vin_number: string;
  ecu_name: string;
  status: string;
};

type OACData = {
  [vin: string]: {
    [ecu: string]: {
      oaDate: string;
      oaDataStatus: number;
    };
  };
};

export default function ECUDumpScreen() {
  // Zustand stores
  const { selectedEcu } = useDataTransferStore();
  const currentVIN = selectedEcu?.vinNumber || "";

  // MMKV storage
  const [jsonDataOAC, setJsonDataOAC] = useMMKVObject<OACData>("jsonDataOAC");
  const [eeDumpJobs, setEeDumpJobs] = useMMKVObject<EeDumpJob[]>("eeDumpJobs");
  const [visibleDisConnectBtn] = useMMKVString("visibleDisConnectBtn");

  // State
  const [eDumpState, setEDumpState] = useState<EDumpState>({
    status: null,
    message: "",
    mainProgress: 0,
    responseMsg: "",
  });
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [preResMsg, setPreResMsg] = useState("");

  // Refs
  const totalWaitTime5IntervalRef = useRef<NodeJS.Timeout | null>(null);
  const totalWaitTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ecuCustomTimeOutRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<EmitterSubscription | null>(null);
  const startTimeRef = useRef<dayjs.Dayjs | null>(null);

  // Save OAC status to MMKV
  const OfflineAnalysticCollectedSaveDetails = (
    vin: string,
    status: OACStatus
  ) => {
    if (!(vin && selectedEcu)) {
      return;
    }

    const currentDate = dayjs().format("YYYY-MM-DD");
    const updatedOACData = { ...(jsonDataOAC || {}) };

    if (!updatedOACData[vin]) {
      updatedOACData[vin] = {};
    }

    updatedOACData[vin][selectedEcu.ecuName] = {
      oaDate: currentDate,
      oaDataStatus: status,
    };

    setJsonDataOAC(updatedOACData);
  };

  // Delete previous EEDUMP folder using modern API
  const deleteEEDumpPreviousTry = () => {
    try {
      const eeDumpDir = new Directory(Paths.document, "EEDUMP");

      if (eeDumpDir.exists) {
        eeDumpDir.delete();
        console.log("Previous EEDUMP deleted");
      }
    } catch (error) {
      console.log("Delete EEDUMP error:", error);
    }
  };

  // Create zip file job
  const createJob = async () => {
    try {
      const timestamp = dayjs().valueOf();
      const fileName = `${timestamp}_${currentVIN}.zip`;
      const sourceDir = new Directory(Paths.document, "EEDUMP");
      const jobsDir = new Directory(Paths.document, "EE_DUMP_Jobs");
      const targetPath = `${jobsDir.uri}/${fileName}`;

      // Ensure EE_DUMP_Jobs directory exists using modern API
      if (!jobsDir.exists) {
        jobsDir.create();
      }

      // Check if EEDUMP exists
      if (!sourceDir.exists) {
        console.log("EEDUMP folder does not exist");
        return false;
      }

      // Create zip (react-native-zip-archive still uses URI strings)
      await zip(sourceDir.uri, targetPath);

      // Add to job queue with dayjs for ISO string
      const newJob: EeDumpJob = {
        filePath: targetPath,
        time: dayjs().toISOString(),
        vin_number: currentVIN || "",
        ecu_name: selectedEcu?.ecuName || "",
        status: "pending",
      };

      const updatedJobs = [...(eeDumpJobs || []), newJob];
      setEeDumpJobs(updatedJobs);

      console.log("Job created:", newJob);
      return true;
    } catch (error) {
      console.log("Create job error:", error);
      return false;
    }
  };

  // Post success flash - upload and cleanup
  const postSucessFlash = async () => {
    try {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      BluetoothModule.unsubscribeToDump();
      BluetoothModule.stopAllTimersFromReact();
      // biome-ignore lint/suspicious/noExplicitAny: Native module method not fully typed
      (BluetoothModule as any).saveAppLog(selectedEcu?.index || 0);

      await createJob();

      // Check remaining jobs after upload attempt
      const failJobMap = eeDumpJobs;
      if (failJobMap) {
        if (failJobMap.length === 0) {
          setEDumpState((prev) => ({
            ...prev,
            isUploadStatus: true,
            message: "All files have been successfully uploaded to the server.",
          }));
        } else {
          console.log("Failed jobs:", failJobMap);
          setEDumpState((prev) => ({
            ...prev,
            isUploadStatus: false,
            message:
              "Failed to Upload Offline Analystics Data, \nPlease check your Internet Connectivity.\n\nTry again later",
          }));
        }
      } else {
        setEDumpState((prev) => ({
          ...prev,
          isUploadStatus: false,
          message:
            "No File to Upload. Please try collecting offline analytics data.",
        }));
      }
    } catch (error) {
      console.log("Post success flash error:", error);
      setEDumpState((prev) => ({
        ...prev,
        isUploadStatus: false,
        message:
          "Failed to Upload Offline Analystics Data.\nPlease move to good connectivity area \n\nPlease Try again later",
      }));
    }
  };

  // Get percentage for progress bar
  const getPercentage = (value: number): number => {
    if (!value) {
      return 0;
    }
    return Math.min(100, Math.max(0, value));
  };

  // Handle eeDump response
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex response handling required for dump protocol
  const onResponse = (response: { name: string; value: string }) => {
    if (response.name === "eeDump") {
      try {
        todayDateTimeF = dayjs().valueOf(); // Update last response time using dayjs

        if (response.value[0] === "{") {
          const eeDumpResponse = JSON.parse(response.value);

          if (eeDumpResponse.status === true) {
            if (eeDumpResponse.processStatus === "upload") {
              if (eeDumpResponse.isReadyToUpload === true) {
                // Success - collection complete
                setEDumpState({
                  mainProgress: eeDumpResponse.EEDumpPercent,
                  message: "Completed",
                  status: "DONE",
                  responseMsg: "",
                  isUploadStatus: undefined,
                });

                OfflineAnalysticCollectedSaveDetails(
                  currentVIN || "",
                  OACStatus.COMPLETE
                );

                postSucessFlash();
                isFlashingUpdated = false;
                return;
              }
              handleFailure(eeDumpResponse.message || "Upload failed");
            } else {
              // In progress update
              if (eeDumpResponse?.message?.length !== 0) {
                // Avoid duplicate updates
                const currentMsg = `${eeDumpResponse.EEDumpPercent},${eeDumpResponse.message}`;
                if (
                  preResMsg === currentMsg ||
                  eeDumpResponse.message.startsWith("Collected the data ")
                ) {
                  return;
                }

                setPreResMsg(currentMsg);
                setEDumpState({
                  mainProgress: eeDumpResponse.EEDumpPercent,
                  message: eeDumpResponse.message,
                  status: "LOADING",
                  responseMsg: "",
                });
              }
              return;
            }
          } else {
            // Status is false - error from lib
            const statusCode =
              eeDumpResponse.EEDumpPosOn === -2
                ? OACStatus.LIB_ERROR_NEG2
                : OACStatus.LIB_ERROR;
            OfflineAnalysticCollectedSaveDetails(currentVIN || "", statusCode);
            handleFailure(eeDumpResponse.message || "Collection failed");
          }
        } else if (response.value.toLowerCase().includes("nrc")) {
          // NRC error
          OfflineAnalysticCollectedSaveDetails(
            currentVIN || "",
            OACStatus.LIB_ERROR
          );
          handleFailure(response.value);
        }
      } catch (error) {
        console.log("onResponse error:", error);
        OfflineAnalysticCollectedSaveDetails(
          currentVIN || "",
          OACStatus.EXCEPTION
        );
        handleFailure(
          "There is an issue collecting data. Please toggle the ignition and try again."
        );
      }
    }
  };

  // Handle failure scenarios
  const handleFailure = async (
    failureMessage: string,
    status: OACStatus = OACStatus.EXCEPTION
  ) => {
    if (totalWaitTimeIntervalRef.current) {
      clearInterval(totalWaitTimeIntervalRef.current);
      totalWaitTimeIntervalRef.current = null;
    }
    if (totalWaitTime5IntervalRef.current) {
      clearInterval(totalWaitTime5IntervalRef.current);
      totalWaitTime5IntervalRef.current = null;
    }
    if (ecuCustomTimeOutRef.current) {
      clearTimeout(ecuCustomTimeOutRef.current);
      ecuCustomTimeOutRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }

    BluetoothModule.unsubscribeToDump();
    BluetoothModule.stopAllTimersFromReact();
    isFlashingUpdated = false;

    OfflineAnalysticCollectedSaveDetails(currentVIN || "", status);

    // Upload failure logs
    await postSucessFlash();

    deleteEEDumpPreviousTry();

    setEDumpState({
      status: "DONE",
      message: failureMessage,
      mainProgress: 0,
      responseMsg: "",
      isUploadStatus: false,
    });

    setShowConfirmationModal(true);
  };

  // Main reprogram function
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex timeout and polling logic required
  const reProgram = async () => {
    try {
      deleteEEDumpPreviousTry();

      OfflineAnalysticCollectedSaveDetails(currentVIN || "", OACStatus.START);

      // Subscribe to dump with just the index parameter like original
      // biome-ignore lint/suspicious/noExplicitAny: Native module method not fully typed
      (BluetoothModule as any).subscribeToDump(selectedEcu?.index || 0);

      const eventEmitter = new NativeEventEmitter(BluetoothModule);
      subscriptionRef.current = eventEmitter.addListener("eeDump", onResponse);

      setEDumpState({
        status: "LOADING",
        message: "Starting Offline Analytics Collection...",
        mainProgress: 0,
        responseMsg: "",
      });

      isFlashingUpdated = true;
      let totalTime = 0;
      todayDateTimeF = dayjs().valueOf();
      startTimeRef.current = dayjs();

      const totalWaitTime = 8 * 60 * 1000; // 8 minutes
      const totalWaitTime5 = 10 * 60 * 1000; // 10 minutes
      const ecuCustomTimeOut = (selectedEcu?.dynamicWaitTime || 480) * 1000;

      // Main polling loop like original
      while (isFlashingUpdated) {
        await sleep(10);

        const curtime = dayjs().valueOf();
        const diff = curtime - todayDateTimeF; // Time since last response
        const startbe = startTimeRef.current?.valueOf() || 0;
        const diffv = curtime - startbe; // Time since start

        if (
          diff > ecuCustomTimeOut ||
          diffv > totalWaitTime5 ||
          totalTime > totalWaitTime
        ) {
          console.log(
            "Timeout - diff:",
            diff,
            "diffv:",
            diffv,
            "startbe:",
            startbe,
            "now:",
            curtime,
            "lastres:",
            todayDateTimeF,
            "ecuCustomTimeOut:",
            ecuCustomTimeOut,
            "totalwait:",
            totalWaitTime,
            "totalWaitTime5:",
            totalWaitTime5
          );

          isFlashingUpdated = false;

          let failstatus: OACStatus = OACStatus.TIMEOUT_10MIN;
          let msgTimeout =
            "\nTimeout occurred after 10 minutes or more. \nPlease check the BT dongle or toggle the ignition, \nthen try again.";

          if (diff > ecuCustomTimeOut) {
            failstatus = OACStatus.NO_RESPONSE_5SEC;
            msgTimeout = `\nTimeout because ${selectedEcu?.ecuName || "ECU"} not responded for ${ecuCustomTimeOut}ms,\nPlease check btdongle or Toggle the ignition please and \nPlease Try Again.`;
          }

          if (diffv > totalWaitTime5) {
            failstatus = OACStatus.TIMEOUT_UI;
            msgTimeout =
              "\nTimeout after waiting for 10 minutes.\nPlease check the BT dongle or toggle the ignition, \nthen try again.";
          }

          OfflineAnalysticCollectedSaveDetails(currentVIN || "", failstatus);
          handleFailure(msgTimeout, failstatus);
          // biome-ignore lint/suspicious/noExplicitAny: Native module method not fully typed
          (BluetoothModule as any).saveAppLog(selectedEcu?.index || 0);
        } else {
          totalTime += 10;
        }
      }
    } catch (error) {
      console.log("reProgram error:", error);
      OfflineAnalysticCollectedSaveDetails(
        currentVIN || "",
        OACStatus.EXCEPTION
      );
      handleFailure(
        "There is an issue collecting data. Please toggle the ignition and try again.",
        OACStatus.EXCEPTION
      );
    }
  };

  const FailureModal = () => (
    <View className="absolute top-0 right-0 bottom-0 left-0 items-center justify-center bg-black/50">
      <View className="mx-8 items-center rounded-lg bg-white p-6">
        <Image className="mb-4 h-12 w-12" source={infoIcon} />
        <Text className="mb-2 text-center font-bold text-xl">
          Collection Failed
        </Text>
        <Text className="mb-4 text-center text-base text-gray-600">
          {eDumpState.message}
        </Text>
        <View className="mt-2">
          <PrimaryButton
            onPress={() => {
              setShowConfirmationModal(false);
              router.back();
            }}
            text="OKAY"
          />
        </View>
      </View>
    </View>
  );

  useFocusEffect(
    // biome-ignore lint/correctness/useExhaustiveDependencies: Functions intentionally recreated on each render to access latest state
    useCallback(() => {
      const handleBackPress = () => {
        if (eDumpState.status === "LOADING") {
          Alert.alert(
            "Cancel Collection",
            "Are you sure you want to cancel the ongoing collection?",
            [
              { text: "No", style: "cancel" },
              {
                text: "Yes",
                onPress: () => {
                  handleFailure(
                    "Collection cancelled by user",
                    OACStatus.EXCEPTION
                  );
                  router.back();
                },
              },
            ]
          );
          return true;
        }
        return false;
      };

      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackPress
      );

      reProgram();

      return () => {
        backHandler.remove();

        if (totalWaitTimeIntervalRef.current) {
          clearInterval(totalWaitTimeIntervalRef.current);
        }
        if (totalWaitTime5IntervalRef.current) {
          clearInterval(totalWaitTime5IntervalRef.current);
        }
        if (ecuCustomTimeOutRef.current) {
          clearTimeout(ecuCustomTimeOutRef.current);
        }
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
        if (subscriptionRef.current) {
          subscriptionRef.current.remove();
        }
      };
    }, [])
  );

  return (
    <View className="flex-1 bg-gray-50">
      {eDumpState.status === "LOADING" && (
        <View className="flex-1 items-center justify-center">
          <OverlayLoading loading />
          <View
            className="mx-4 rounded-lg bg-white p-4"
            style={{ width: SCREEN_WIDTH - 32 }}
          >
            <Text className="mb-2 text-center font-bold text-lg">
              {eDumpState.message}
            </Text>
            <Text className="mb-4 text-center text-gray-600 text-sm">
              {eDumpState.responseMsg}
            </Text>

            <View className="mt-4">
              <Text className="mb-2 font-bold text-lg">Progress:</Text>
              <View className="flex-row items-center">
                <ProgressBar
                  animated={false}
                  borderColor="#f4f4f4"
                  color={colors.primaryColor}
                  progress={getPercentage(eDumpState.mainProgress) / 100}
                  unfilledColor="#f4f4f4"
                  width={SCREEN_WIDTH / 1.5}
                />
                <Text className="ml-2 w-14 text-sm">
                  {getPercentage(eDumpState.mainProgress)} %
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {eDumpState.status === "DONE" && (
        <View className="flex-1 items-center justify-center bg-white py-4">
          {eDumpState.isUploadStatus === undefined ? (
            <View className="items-center bg-white">
              <OverlayLoading loading />
            </View>
          ) : (
            <View className="items-center">
              <Image className="h-10 w-10" source={infoIcon} />
            </View>
          )}

          <Text className="mx-4 mt-4 mb-4 text-center font-bold text-xl">
            {eDumpState.isUploadStatus === undefined
              ? "Finished Offline Analytic Successfully, \nPlease wait, uploading the file"
              : eDumpState.message}
          </Text>

          <View className="mx-4 mt-6">
            <PrimaryButton
              inactive={eDumpState.isUploadStatus === undefined}
              onPress={() => {
                if (visibleDisConnectBtn) {
                  // Set disconnect button visible
                }
                router.back();
              }}
              text="OKAY"
            />
          </View>
        </View>
      )}

      {showConfirmationModal && <FailureModal />}
    </View>
  );
}
