import { useFocusEffect } from "@react-navigation/core";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  type EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  Text,
  View,
} from "react-native";
import { Bar as ProgressBar } from "react-native-progress";
import { FMSApi } from "@/api/fms";
import { PrimaryButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { OverlayView } from "@/components/ui/overlay";
import { colors } from "@/constants/colors";
import { toastSuccess } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";

const { BluetoothModule } = NativeModules;

type FlashingState = {
  mainProgress: number;
  subProgress: number;
  status: string;
};

export default function UpdateBootScreen() {
  const router = useRouter();
  const { userInfo } = useAuthStore();
  const { selectedEcu } = useDataTransferStore();

  const [showOverlay, setShowOverlay] = useState(true);
  const [flashingState, setFlashingState] = useState<FlashingState | null>(
    null
  );
  const [isFlashing, setIsFlashing] = useState(false);
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureMessage, setFailureMessage] = useState("");
  const [timeTaken, setTimeTaken] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [showTimeText, setShowTimeText] = useState(false);

  const eventSubscriptionRef = useRef<EmitterSubscription | null>(null);
  const isProcessingRef = useRef(false);
  const startTimeRef = useRef<Date | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Check selectedEcu on mount
  useEffect(() => {
    if (!selectedEcu) {
      router.replace("/(main)/devices/select");
    }
  }, [selectedEcu]);

  useEffect(
    () => () => {
      if (eventSubscriptionRef.current) {
        eventSubscriptionRef.current.remove();
      }
      BluetoothModule.unSubscribeToFlashingBoot?.();
      BluetoothModule.stopAllTimersFromReact?.();
    },
    []
  );

  // Prevent back button during flashing
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          return isFlashing; // Return true to prevent back if flashing
        }
      );
      return () => subscription.remove();
    }, [isFlashing])
  );

  const calculateTimeDifference = (startDate: Date, endDate: Date) => {
    const differenceInMilliseconds = endDate.getTime() - startDate.getTime();
    const differenceInSeconds = Math.floor(differenceInMilliseconds / 1000);
    const differenceInMinutes = Math.floor(differenceInSeconds / 60);
    const differenceInHours = Math.floor(differenceInMinutes / 60);

    return {
      hours: differenceInHours,
      minutes: differenceInMinutes % 60,
      seconds: differenceInSeconds % 60,
    };
  };

  const getBootFlashingUpdate = async () => {
    try {
      setShowOverlay(false);
      setIsFlashing(true);
      isProcessingRef.current = true;
      startTimeRef.current = new Date();
      setShowTimeText(selectedEcu?.isShowUpdatePerFrameTime);

      const eventEmitter = new NativeEventEmitter(BluetoothModule);
      eventSubscriptionRef.current = eventEmitter.addListener(
        "updateBoot",
        (response: {
          name: string;
          value: { mainProgress: number; subProgress: number; status?: string };
        }) => {
          if (response.name === "updateBoot") {
            const flashResponse: FlashingState = {
              mainProgress: response.value.mainProgress,
              subProgress: response.value.subProgress,
              status: response.value.status || "",
            };

            // Update time taken
            if (startTimeRef.current) {
              const timeDiff = calculateTimeDifference(
                startTimeRef.current,
                new Date()
              );
              setTimeTaken(timeDiff);
            }

            // Handle completion or error
            if (
              flashResponse.mainProgress === -1 ||
              flashResponse.subProgress === -1
            ) {
              handleFlashComplete(flashResponse, false);
            } else if (flashResponse.mainProgress === 100) {
              const statusLower = flashResponse.status.toLowerCase();
              if (
                statusLower.includes(selectedEcu?.ecuName?.toLowerCase() || "")
              ) {
                handleFlashComplete(flashResponse, true);
              } else {
                setFlashingState(flashResponse);
              }
            } else {
              setFlashingState(flashResponse);
            }
          }
        }
      );

      await BluetoothModule.subscribeToBootFlashingUpdate(
        selectedEcu?.index || 0
      );

      // Timeout mechanism
      const timeout = 9_000_000;
      const startTime = Date.now();

      while (isProcessingRef.current && Date.now() - startTime < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      if (isProcessingRef.current) {
        handleTimeout();
      }
    } catch (error) {
      console.error("Boot flashing error:", error);
      handleFailure("Boot flashing failed");
    }
  };

  const handleFlashComplete = async (
    flashResponse: FlashingState,
    success: boolean
  ) => {
    if (eventSubscriptionRef.current) {
      eventSubscriptionRef.current.remove();
      eventSubscriptionRef.current = null;
    }

    BluetoothModule.unSubscribeToFlashingBoot?.();
    BluetoothModule.stopAllTimersFromReact?.();
    isProcessingRef.current = false;
    setIsFlashing(false);

    if (success) {
      setFlashingState({ ...flashResponse, status: "DONE" });
      await postSuccessFlash();
    } else {
      handleFailure(flashResponse.status);
    }
  };

  const handleTimeout = () => {
    if (eventSubscriptionRef.current) {
      eventSubscriptionRef.current.remove();
      eventSubscriptionRef.current = null;
    }

    isProcessingRef.current = false;
    setIsFlashing(false);
    handleFailure("Timeout. Please try again.");
  };

  const handleFailure = (message: string) => {
    setFailureMessage(message);
    setShowFailureModal(true);
    uploadLogs();
  };

  const uploadLogs = async () => {
    try {
      if (!(selectedEcu && userInfo)) {
        return;
      }

      await BluetoothModule.saveAppLog?.(selectedEcu.index);
      // Upload logs via API if needed
    } catch (error) {
      console.error("Log upload error:", error);
    }
  };

  const postSuccessFlash = async () => {
    try {
      if (!(selectedEcu && userInfo)) {
        return;
      }

      await FMSApi({
        method: "post",
        url: "/api/v4/vin/hexfile/install",
        data: {
          serial_number: userInfo.serial_number,
          vin_number: selectedEcu.vinNumber,
          hexfiles: [
            {
              hexfile_name: selectedEcu.oldHexFileName,
              status: "1",
              logfile: "",
              comments: "Done",
            },
          ],
        },
      });

      toastSuccess("Boot updated successfully");
    } catch (error) {
      console.error("Post success flash error:", error);
    }
  };

  const handleRetry = () => {
    setShowFailureModal(false);
    setFlashingState(null);
    getBootFlashingUpdate();
  };

  const handleFailureOkay = () => {
    setShowFailureModal(false);
    router.back();
  };

  const handleSuccessOkay = () => {
    router.push("/(main)/flashing/controller-flash");
  };

  const getPercentage = (value: number): number =>
    Number.isNaN(value) ? 0 : Math.max(0, Math.min(100, value));

  return (
    <>
      <CustomHeader
        leftButtonFunction={() => router.back()}
        leftButtonType="back"
        renderLeftButton
        title="Update Boot"
      />

      <View className="absolute top-20 z-10 w-full">
        <Text className="my-4 text-center font-primaryBold text-textPrimary text-xl">
          {selectedEcu?.ecuName}
        </Text>
        {showTimeText && timeTaken && (
          <Text className="my-4 text-center font-primaryBold text-textPrimary text-xl">
            Flashing Time: {timeTaken.hours > 0 && `${timeTaken.hours} hr `}
            {timeTaken.minutes > 0 && `${timeTaken.minutes} min `}
            {timeTaken.seconds} sec
          </Text>
        )}
      </View>

      <View className="flex-1 justify-center bg-primaryBg px-4">
        {/* Initial Confirmation */}
        {!isFlashing &&
          flashingState?.status !== "DONE" &&
          !showFailureModal && (
            <OverlayView
              description="RF Noise may lead to flashing failure, you may need to re-attempt flashing"
              primaryButtonOnPress={getBootFlashingUpdate}
              primaryButtonText="OKAY"
              secondaryButtonOnPress={() => router.back()}
              secondaryButtonText="CANCEL"
              secondDescription={`Ensure that "BTL_${selectedEcu?.oldHexFileName}" is associated with ${selectedEcu?.ecuName}?`}
              title="NOTE"
              visible={showOverlay}
            />
          )}

        {/* Flashing Progress */}
        {isFlashing && flashingState && flashingState.status !== "DONE" && (
          <View
            className="rounded-2xl bg-white p-5"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="mb-2 font-primaryBold text-2xl text-textPrimary">
              {flashingState.status}
            </Text>

            <Text className="mt-4 mb-2 font-primaryBold text-lg text-textPrimary">
              Block Progress:
            </Text>
            <View className="flex-row items-center">
              <ProgressBar
                animated={false}
                borderColor="#f4f4f4"
                borderRadius={4}
                color={colors.primaryColor}
                height={8}
                progress={getPercentage(flashingState.mainProgress) / 100}
                unfilledColor="#f4f4f4"
                width={280}
              />
              <Text className="ml-3 w-14 font-primaryMedium text-base text-textPrimary">
                {getPercentage(flashingState.mainProgress)}%
              </Text>
            </View>

            <Text className="mt-4 mb-2 font-primaryBold text-lg text-textPrimary">
              Segment Progress:
            </Text>
            <View className="flex-row items-center">
              <ProgressBar
                animated={false}
                borderColor="#f4f4f4"
                borderRadius={4}
                color={colors.primaryColor}
                height={8}
                progress={getPercentage(flashingState.subProgress) / 100}
                unfilledColor="#f4f4f4"
                width={280}
              />
              <Text className="ml-3 w-14 font-primaryMedium text-base text-textPrimary">
                {getPercentage(flashingState.subProgress)}%
              </Text>
            </View>
          </View>
        )}

        {/* Success Message */}
        {flashingState?.status === "DONE" && (
          <View
            className="rounded-2xl bg-white p-5"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="mb-4 text-center font-primaryBold text-textPrimary text-xl">
              Successfully completed the boot flashing.
            </Text>
            <Text className="mb-6 text-center font-primaryRegular text-base text-textSecondary">
              Boot Updated, Must re-program the Controller now otherwise Vehicle
              will be NON functional!!
            </Text>
            <PrimaryButton onPress={handleSuccessOkay} text="OKAY" />
          </View>
        )}

        {/* Failure Modal */}
        {showFailureModal && (
          <OverlayView
            description={failureMessage}
            primaryButtonOnPress={handleFailureOkay}
            primaryButtonText="Okay"
            secondaryButtonOnPress={handleRetry}
            secondaryButtonText="Retry"
            title="Error"
            visible={showFailureModal}
          />
        )}
      </View>
    </>
  );
}
