import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  type EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Bar as ProgressBar } from "react-native-progress";
import { PrimaryButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { OverlayView } from "@/components/ui/overlay";
import { colors } from "@/constants/colors";
import { toastError, toastSuccess } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";

const { BluetoothModule, USBModule } = NativeModules;

export default function WriteProgConstScreen() {
  const router = useRouter();
  const { dataTransferMode } = useAuthStore();
  const { selectedEcu } = useDataTransferStore();

  const [showOverlay, setShowOverlay] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mainProgress, setMainProgress] = useState(0);
  const [subProgress, setSubProgress] = useState(0);

  const eventSubscriptionRef = useRef<EmitterSubscription | null>(null);

  useEffect(() => {
    if (!selectedEcu) {
      router.replace("/(main)/devices/select");
    }
  }, [selectedEcu, router]);

  useEffect(
    () => () => {
      if (eventSubscriptionRef.current) {
        eventSubscriptionRef.current.remove();
      }
    },
    []
  );

  const handleUpdatePress = () => {
    if (!selectedEcu) {
      toastError("Please select an ECU first");
      return;
    }

    setShowOverlay(true);
  };

  const handleConfirm = async () => {
    setShowOverlay(false);

    try {
      const Module = dataTransferMode === "USB" ? USBModule : BluetoothModule;

      setIsProcessing(true);
      setMainProgress(0);
      setSubProgress(0);

      // Subscribe to write PC updates
      const eventEmitter = new NativeEventEmitter(Module);
      eventSubscriptionRef.current = eventEmitter.addListener(
        "updateWritePC",
        (event: {
          mainProgress: number;
          subProgress: number;
          status: string;
        }) => {
          console.log("Write PC update:", event);

          setMainProgress(event.mainProgress / 100);
          setSubProgress(event.subProgress / 100);

          if (event.status === "success") {
            if (eventSubscriptionRef.current) {
              eventSubscriptionRef.current.remove();
              eventSubscriptionRef.current = null;
            }

            toastSuccess("Programming constants written successfully");

            setTimeout(() => {
              router.push("/(main)/flashing/flash-success");
            }, 500);
          } else if (event.status === "error") {
            if (eventSubscriptionRef.current) {
              eventSubscriptionRef.current.remove();
              eventSubscriptionRef.current = null;
            }

            setIsProcessing(false);
            toastError("Failed to write programming constants");
          }
        }
      );

      // Start write PC process
      const index = selectedEcu.index || 0;
      // biome-ignore lint/suspicious/noExplicitAny: Native module method not fully typed
      await (Module as any).subscribeToWritePCUpdate(index);

      // Timeout mechanism
      const timeout = 9_000_000;
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!eventSubscriptionRef.current) {
          // Process completed or errored
          break;
        }
      }

      // If still processing after timeout
      if (eventSubscriptionRef.current) {
        eventSubscriptionRef.current.remove();
        eventSubscriptionRef.current = null;
        setIsProcessing(false);
        toastError("Write programming constants timeout");
      }
    } catch (error: unknown) {
      console.error("Write PC error:", error);

      if (eventSubscriptionRef.current) {
        eventSubscriptionRef.current.remove();
        eventSubscriptionRef.current = null;
      }

      setIsProcessing(false);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to write programming constants";
      toastError(errorMessage);
    }
  };

  const handleCancel = () => {
    setShowOverlay(false);
  };

  return (
    <View className="flex-1 bg-primaryBg">
      <CustomHeader
        leftButtonFunction={() => router.back()}
        leftButtonType="back"
        title="Write Programming Constants"
      />

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
      >
        {/* Info Section */}
        <View
          className="mb-5 rounded-2xl bg-white p-5"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Text className="mb-3 font-primarySemiBold text-base text-textPrimary">
            Programming Constants
          </Text>
          <Text className="font-primaryRegular text-sm text-textSecondary">
            This will write programming constants to the selected controller.
            The process may take several minutes.
          </Text>
        </View>

        {/* Controller Info */}
        {selectedEcu && (
          <View
            className="mb-5 rounded-2xl bg-white p-5"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="mb-3 font-primarySemiBold text-base text-textPrimary">
              Selected Controller
            </Text>
            <View className="space-y-2">
              <View className="flex-row justify-between">
                <Text className="font-primaryRegular text-sm text-textSecondary">
                  Name:
                </Text>
                <Text className="font-primaryMedium text-sm text-textPrimary">
                  {selectedEcu.ecuName}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="font-primaryRegular text-sm text-textSecondary">
                  Index:
                </Text>
                <Text className="font-primaryMedium text-sm text-textPrimary">
                  {selectedEcu.index}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Progress Section */}
        {isProcessing && (
          <View
            className="mb-5 rounded-2xl bg-white p-5"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="mb-4 font-primarySemiBold text-base text-textPrimary">
              Writing Programming Constants...
            </Text>

            <View className="mb-4">
              <View className="mb-2 flex-row justify-between">
                <Text className="font-primaryRegular text-sm text-textSecondary">
                  Overall Progress
                </Text>
                <Text className="font-primaryMedium text-sm text-textPrimary">
                  {Math.round(mainProgress * 100)}%
                </Text>
              </View>
              <ProgressBar
                borderRadius={4}
                borderWidth={0}
                color={colors.successGreen}
                height={8}
                progress={mainProgress}
                unfilledColor={colors.lightGrey}
                width={null}
              />
            </View>

            <View>
              <View className="mb-2 flex-row justify-between">
                <Text className="font-primaryRegular text-sm text-textSecondary">
                  Current Step
                </Text>
                <Text className="font-primaryMedium text-sm text-textPrimary">
                  {Math.round(subProgress * 100)}%
                </Text>
              </View>
              <ProgressBar
                borderRadius={4}
                borderWidth={0}
                color={colors.primaryColor}
                height={8}
                progress={subProgress}
                unfilledColor={colors.lightGrey}
                width={null}
              />
            </View>
          </View>
        )}

        {/* Update Button */}
        {!isProcessing && (
          <PrimaryButton onPress={handleUpdatePress} text="UPDATE" />
        )}
      </ScrollView>

      {/* Confirmation Overlay */}
      <OverlayView
        description={`Are you sure you want to write programming constants to ${selectedEcu?.ecuName}? This process cannot be interrupted.`}
        primaryButtonOnPress={handleConfirm}
        primaryButtonText="CONFIRM"
        secondaryButtonOnPress={handleCancel}
        secondaryButtonText="CANCEL"
        title="Confirm Write Programming Constants"
        visible={showOverlay}
      />
    </View>
  );
}
