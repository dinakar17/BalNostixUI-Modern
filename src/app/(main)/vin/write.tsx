import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  type EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  ScrollView,
  Text,
  TextInput,
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
import type {
  BluetoothModuleType,
  WriteVinUpdatePayload,
} from "@/types/bluetooth.types";
import type { USBModuleType } from "@/types/usb.types";

const { BluetoothModule, USBModule } = NativeModules as {
  BluetoothModule: BluetoothModuleType;
  USBModule: USBModuleType;
};

export default function WriteVinScreen() {
  const router = useRouter();
  const { dataTransferMode } = useAuthStore();
  const { selectedEcu } = useDataTransferStore();

  const [vinValue, setVinValue] = useState("");
  const [isManualEntry, setIsManualEntry] = useState(false);
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

  const validateVIN = async (vin: string): Promise<boolean> => {
    try {
      const Module = dataTransferMode === "USB" ? USBModule : BluetoothModule;
      // biome-ignore lint/suspicious/noExplicitAny: USBModule doesn't have this method yet
      const result = await (Module as any).validateVIN(vin);
      return result === true;
    } catch (error) {
      console.error("VIN validation error:", error);
      return false;
    }
  };

  const handleFlashPress = () => {
    if (!selectedEcu) {
      toastError("Please select an ECU first");
      return;
    }

    if (isManualEntry && vinValue.length !== 17) {
      toastError("VIN must be 17 characters");
      return;
    }

    setShowOverlay(true);
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex VIN write flow required
  const handleConfirm = async () => {
    setShowOverlay(false);

    try {
      const Module = dataTransferMode === "USB" ? USBModule : BluetoothModule;

      // Validate VIN first
      const isValid = await validateVIN(vinValue);

      if (!(isValid || isManualEntry)) {
        // Invalid VIN detected, show manual entry
        setIsManualEntry(true);
        toastError("Invalid VIN detected. Please enter manually.");
        return;
      }

      if (isManualEntry && vinValue.length !== 17) {
        toastError("VIN must be 17 characters");
        return;
      }

      setIsProcessing(true);
      setMainProgress(0);
      setSubProgress(0);

      // Subscribe to write VIN updates
      const eventEmitter = new NativeEventEmitter(Module);
      eventSubscriptionRef.current = eventEmitter.addListener(
        "updateWriteVin",
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Event handler requires conditional logic for progress tracking
        (event: WriteVinUpdatePayload) => {
          console.log("Write VIN update:", event);

          if (event.value) {
            setMainProgress((event.value.mainProgress || 0) / 100);
            setSubProgress((event.value.subProgress || 0) / 100);

            if (event.value.status === "success") {
              if (eventSubscriptionRef.current) {
                eventSubscriptionRef.current.remove();
                eventSubscriptionRef.current = null;
              }

              toastSuccess("VIN written successfully");

              setTimeout(() => {
                router.push("/(main)/flashing/flash-success");
              }, 500);
            } else if (event.value.status === "error") {
              if (eventSubscriptionRef.current) {
                eventSubscriptionRef.current.remove();
                eventSubscriptionRef.current = null;
              }

              setIsProcessing(false);
              toastError("Failed to write VIN");
            }
          }
        }
      );

      // Start write VIN process
      const index = selectedEcu?.index || 0;
      // biome-ignore lint/suspicious/noExplicitAny: USBModule doesn't have this method yet
      await (Module as any).subscribeToWriteVinUpdate(index, vinValue);

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
        toastError("Write VIN timeout");
      }
    } catch (error) {
      console.error("Write VIN error:", error);

      if (eventSubscriptionRef.current) {
        eventSubscriptionRef.current.remove();
        eventSubscriptionRef.current = null;
      }

      setIsProcessing(false);
      const message =
        error instanceof Error ? error.message : "Failed to write VIN";
      toastError(message);
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
        title="Write VIN"
      />

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
      >
        {/* VIN Input Section */}
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
            VIN Number
          </Text>

          {isManualEntry ? (
            <View>
              <Text className="mb-3 font-primaryRegular text-sm text-textSecondary">
                Enter 17-character VIN manually:
              </Text>
              <TextInput
                autoCapitalize="characters"
                className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-primaryRegular text-base text-textPrimary"
                editable={!isProcessing}
                maxLength={17}
                onChangeText={(text) => setVinValue(text.toUpperCase())}
                placeholder="Enter VIN (17 characters)"
                placeholderTextColor={colors.lightText}
                value={vinValue}
              />
              <Text className="mt-2 font-primaryRegular text-textSecondary text-xs">
                {vinValue.length}/17 characters
              </Text>
            </View>
          ) : (
            <View>
              <Text className="mb-3 font-primaryRegular text-sm text-textSecondary">
                VIN will be read from the controller automatically
              </Text>
              {vinValue && (
                <View className="rounded-lg bg-gray-50 px-4 py-3">
                  <Text className="font-primaryMedium text-base text-textPrimary">
                    {vinValue}
                  </Text>
                </View>
              )}
            </View>
          )}
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
              Writing VIN...
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
                color={colors.primaryColor}
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

        {/* Flash Button */}
        {!isProcessing && (
          <PrimaryButton
            inactive={isManualEntry && vinValue.length !== 17}
            onPress={handleFlashPress}
            text="WRITE VIN"
          />
        )}
      </ScrollView>

      {/* Confirmation Overlay */}
      <OverlayView
        description={`Are you sure you want to write VIN ${vinValue} to ${selectedEcu?.ecuName}?`}
        primaryButtonOnPress={handleConfirm}
        primaryButtonText="CONFIRM"
        secondaryButtonOnPress={handleCancel}
        secondaryButtonText="CANCEL"
        title="Confirm Write VIN"
        visible={showOverlay}
      />
    </View>
  );
}
