import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Image } from "expo-image";
import { useKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useRef, useState } from "react";
import {
  BackHandler,
  NativeEventEmitter,
  NativeModules,
  Text,
  View,
} from "react-native";
import { Bar as ProgressBar } from "react-native-progress";
import { FMSApi } from "@/api/fms";
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

  const [isVisible, setIsVisible] = useState(false);
  const [flashingState, setFlashingState] = useState<FlashingState | null>(
    null
  );
  const [isFlashing, setIsFlashing] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [failureMessage, setFailureMessage] = useState("");
  const [flashDuration, setFlashDuration] = useState<duration.Duration | null>(
    null
  );
  const [isTimeTextVisible, setTimeTextVisible] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const timeStartRef = useRef<dayjs.Dayjs | null>(null);
  const isFlashingUpdatedRef = useRef(false);

  const handleStartTimeout = (delay = 5000) => {
    handleCancelTimeout();
    if (timeoutRef.current !== null) {
      return;
    }

    const id = setTimeout(() => {
      console.log("Flash timeout reached");
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
        await FMSApi.post(
          "/api/v4/app-logs",
          {
            serial_number: userInfo.serial_number,
            vin_number: ecu.vinNumber,
            hex_file: ecu.oldHexFileName,
          },
          {
            headers: { Authorization: `Bearer ${userInfo.token}` },
            timeout: 30_000,
          }
        );
      }
    } catch (error) {
      console.log("Upload logs error:", error);
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
        await FMSApi.post(
          "/api/v4/app-logs",
          {
            serial_number: userInfo.serial_number,
            vin_number: ecu.vinNumber,
            hex_file: ecu.oldHexFileName,
          },
          {
            headers: { Authorization: `Bearer ${userInfo.token}` },
            timeout: 30_000,
          }
        );
      }
    } catch (error) {
      console.log("Upload logs on success error:", error);
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
      await FMSApi({
        method: "post",
        url: "/api/v4/vin/hexfile/install",
        headers: { Authorization: `Bearer ${userInfo.token}` },
        data: {
          serial_number: userInfo.serial_number,
          vin_number: ecu.vinNumber,
          hexfiles: [
            {
              hexfile_name: ecu.oldHexFileName,
              status: "1",
              logfile: "",
              comments: "Done",
            },
          ],
        },
        timeout: 30_000,
      });

      await uploadLogsOnSuccess();
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        const err = error as { response?: { status?: number } };
        if (err.response?.status === 401) {
          toastError("You've been inactive for a while, Please login again.");
          handleLogout();
          return;
        }
      }
      console.log("Post success flash error:", error);
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

  const updateFlashProgress = () => {
    if (isTimeTextVisible && selectedEcu?.dynamicWaitTime) {
      handleStartTimeout(selectedEcu.dynamicWaitTime);
    }

    if (timeStartRef.current) {
      const now = dayjs();
      const diff = now.diff(timeStartRef.current);
      setFlashDuration(dayjs.duration(diff));
    }
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

      updateFlashProgress();

      // Failure condition
      if (
        flashResponse.mainProgress === -1 ||
        flashResponse.subProgress === -1
      ) {
        handleFlashFailure(flashResponse);
        return;
      }

      // Success condition
      if (
        flashResponse.mainProgress === 100 &&
        handleFlashSuccess(flashResponse)
      ) {
        return;
      }

      setFlashingState(flashResponse);
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
      setTimeTextVisible(selectedEcu.isShowUpdatePerFrameTime);

      if (selectedEcu.isShowUpdatePerFrameTime && selectedEcu.dynamicWaitTime) {
        handleStartTimeout(selectedEcu.dynamicWaitTime);
      } else {
        let totalTime = 0;
        const checkTimeout = async () => {
          while (isFlashingUpdatedRef.current) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            if (totalTime > 9_000_000) {
              isFlashingUpdatedRef.current = false;
              setIsVisible(false);
              setIsFlashing(false);
              handleFailure("Timeout Please Try Again");
              break;
            }
            totalTime += 10;
          }
        };
        await checkTimeout();
      }
    } catch (error) {
      console.log("reProgram error:", error);
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

  useFocusEffect(
    React.useCallback(() => {
      const handleBackButton = () => {
        if (isFlashing) {
          return true;
        }
        router.push("/(main)/controllers/operations");
        return true;
      };

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
    }, [isFlashing, cleanup])
  );

  const FailureModal = () => (
    <View className="absolute inset-0 items-center justify-center bg-black/50">
      <View className="w-[83.33%] rounded-lg bg-white px-4 py-4">
        <Image
          className="h-10 w-10 self-center"
          contentFit="contain"
          source={infoIcon}
        />
        <Text className="mt-4 text-center font-proximanova text-lg">
          {failureMessage}
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
        {isTimeTextVisible && flashDuration && (
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
                  setIsVisible(true);
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
                    router.push("/(main)/controllers/operations");
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
