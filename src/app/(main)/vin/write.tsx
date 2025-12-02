import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  type EmitterSubscription,
  Modal,
  NativeEventEmitter,
  NativeModules,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { Bar as ProgressBar } from "react-native-progress";
import { useUploadAppLogs } from "@/api/data-transfer";
import { infoIcon } from "@/assets/images/index";
import { PrimaryButton, WhiteButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { OverlayView } from "@/components/ui/overlay";
import { colors } from "@/constants/colors";
import { toastError } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";
import type { BluetoothModuleType } from "@/types/bluetooth.types";
import type { USBModuleType } from "@/types/usb.types";

const { BluetoothModule, USBModule } = NativeModules as {
  BluetoothModule: BluetoothModuleType;
  USBModule: USBModuleType;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type FlashingState = {
  mainProgress: number;
  subProgress: number;
  status: string;
};

const getStatus = (message: string | null): string => {
  if (message == null) {
    return "";
  }
  const trimmedMessage = message.trim();
  if (trimmedMessage[0] === "{") {
    try {
      const json = JSON.parse(message);
      return json.value || message;
    } catch {
      return message;
    }
  }
  return message;
};

const getPercentage = (input: number | string): number => {
  const parsedNumber =
    typeof input === "string" ? Number.parseInt(input, 10) : input;
  if (Number.isNaN(parsedNumber)) {
    return 0;
  }
  return parsedNumber;
};

export default function WriteVinScreen() {
  const router = useRouter();
  const { dataTransferMode, userInfo } = useAuthStore();
  const { selectedEcu } = useDataTransferStore();
  const { trigger: uploadAppLogs } = useUploadAppLogs();

  const [vinValue, setVinValue] = useState(selectedEcu?.vinNumber || "");
  const [isValidVIN, setIsValidVIN] = useState(true);
  const [newVinStatus, setNewVinStatus] = useState(false);
  const [showConfirmationOverlay, setShowConfirmationOverlay] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashingState, setFlashingState] = useState<FlashingState | null>(
    null
  );
  const [showProgressOverlay, setShowProgressOverlay] = useState(false);
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [failureMessage, setFailureMessage] = useState("");

  const eventSubscriptionRef = useRef<EmitterSubscription | null>(null);
  const isFlashingUpdatedRef = useRef(false);

  // Check if ECU is selected
  useEffect(() => {
    if (!selectedEcu) {
      router.replace("/(main)/devices/select");
    }
  }, [selectedEcu, router]);

  // Validate VIN on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: Run only once on mount
  useEffect(() => {
    if (vinValue) {
      checkVin(setIsValidVIN, vinValue);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    if (isFlashing) {
      return () => {
        eventSubscriptionRef.current?.remove();
        const Module = dataTransferMode === "USB" ? USBModule : BluetoothModule;
        // biome-ignore lint/suspicious/noExplicitAny: Module types differ
        (Module as any).unSubscribeToWriteVinUpdate?.();
        // biome-ignore lint/suspicious/noExplicitAny: Module types differ
        (Module as any).stopAllTimersFromReact?.();
      };
    }
  }, [isFlashing, dataTransferMode]);

  // Prevent back button during flashing
  const handleBackButton = useCallback(() => {
    if (isFlashing) {
      return true; // Prevent back
    }
    return false; // Allow back
  }, [isFlashing]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackButton
      );
      return () => subscription.remove();
    }, [handleBackButton])
  );

  const checkVin = async (
    setterFunction: (value: boolean) => void,
    vinNumber: string
  ) => {
    try {
      const Module = dataTransferMode === "USB" ? USBModule : BluetoothModule;
      // biome-ignore lint/suspicious/noExplicitAny: Module method validation
      const isValidVin = await (Module as any).validateVIN(vinNumber);
      setterFunction(isValidVin);
    } catch (error) {
      console.log(error);
    }
  };

  const uploadLogs = () => {
    if (!(selectedEcu && userInfo)) {
      return;
    }

    const Module = dataTransferMode === "USB" ? USBModule : BluetoothModule;
    // biome-ignore lint/suspicious/noExplicitAny: Module method
    (Module as any).saveAppLog?.(selectedEcu.index);

    if (uploadAppLogs) {
      uploadAppLogs({
        serialNumber: userInfo.serial_number,
        vinNumber: selectedEcu.vinNumber,
        hexFile: selectedEcu.oldHexFileName || "",
      });
    }
  };

  const handleFailure = (message = "") => {
    setFailureMessage(message);
    setShowFailureModal(true);
  };

  const onResponse = (response: {
    name: string;
    value: FlashingState & { status: string };
  }) => {
    if (response.name === "updateWriteVin") {
      const flashResponse = {
        ...response.value,
        status: getStatus(response.value.status),
      };

      if (
        flashResponse.mainProgress === -1 ||
        flashResponse.subProgress === -1
      ) {
        eventSubscriptionRef.current?.remove();
        // const Module = dataTransferMode === "USB" ? USBModule : BluetoothModule;
        BluetoothModule.unSubscribeToWriteVinUpdate?.();
        BluetoothModule.stopAllTimersFromReact?.();
        isFlashingUpdatedRef.current = false;
        setShowProgressOverlay(false);
        setIsFlashing(false);
        handleFailure(flashResponse.status);
        uploadLogs();
        return;
      }

      if (flashResponse.mainProgress === 100) {
        setFlashingState({ ...flashResponse, status: "DONE" });
        // const Module = dataTransferMode === "USB" ? USBModule : BluetoothModule;
        BluetoothModule.unSubscribeToWriteVinUpdate?.();
        BluetoothModule.stopAllTimersFromReact?.();
        eventSubscriptionRef.current?.remove();
        isFlashingUpdatedRef.current = false;
        return;
      }

      setFlashingState(flashResponse);
    }
  };

  const reProgram = async () => {
    try {
      // const Module = dataTransferMode === "USB" ? USBModule : BluetoothModule;
      // Note: USBModule doesn't have subscribeToWriteVinUpdate method
      BluetoothModule.subscribeToWriteVinUpdate(selectedEcu?.index, vinValue);

      const eventEmitter = new NativeEventEmitter(BluetoothModule);
      eventSubscriptionRef.current = eventEmitter.addListener(
        "updateWriteVin",
        onResponse
      );

      setIsFlashing(true);
      isFlashingUpdatedRef.current = true;

      let totalTime = 0;
      while (isFlashingUpdatedRef.current) {
        await sleep(10);
        if (totalTime > 9_000_000) {
          isFlashingUpdatedRef.current = false;
          setShowProgressOverlay(false);
          setIsFlashing(false);
          handleFailure("Timeout Please Try Again");
        } else {
          totalTime += 10;
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleFlashPress = () => {
    if (!selectedEcu) {
      toastError("Please select an ECU first");
      return;
    }

    setShowConfirmationOverlay(true);
  };

  const handleConfirmFlash = () => {
    setShowConfirmationOverlay(false);
    setShowProgressOverlay(true);
    reProgram();
  };

  const handleCancelFlash = () => {
    setShowConfirmationOverlay(false);
  };

  const handleVinChange = (text: string) => {
    const updateCaseValue = text.toUpperCase();
    if (updateCaseValue.length === 17) {
      checkVin(setNewVinStatus, updateCaseValue);
    } else {
      setNewVinStatus(false);
    }
    setVinValue(updateCaseValue);
  };

  // Failure Modal Component
  const FailureModal = () => (
    <Modal
      animationType="fade"
      onRequestClose={() => setShowFailureModal(false)}
      transparent={true}
      visible={showFailureModal}
    >
      <View className="flex-1 items-center justify-center bg-black/50">
        <View
          className="w-4/5 rounded-lg bg-white p-4"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          <View className="items-center">
            <Image
              contentFit="contain"
              source={infoIcon}
              style={{ width: 42, height: 42 }}
            />
          </View>
          <Text className="mt-4 text-center font-primaryRegular text-lg text-textPrimary">
            {failureMessage}
          </Text>

          <View className="mt-4">
            <PrimaryButton
              onPress={() => {
                if (failureMessage === "INVALID_VIN") {
                  setShowFailureModal(false);
                  setIsValidVIN(false);
                } else {
                  router.back();
                }
              }}
              text="Okay"
            />
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View className="flex-1 bg-primaryBg">
      <CustomHeader
        leftButtonFunction={() => router.back()}
        leftButtonType="back"
        title="WRITE VIN"
      />

      <View className="items-center justify-center py-4">
        <Text className="font-primaryBold text-textPrimary text-xl">
          {selectedEcu?.ecuName}
        </Text>
      </View>

      <View className="flex-1 justify-center px-4">
        {/* Show overlay view when not flashing and VIN is valid */}
        {!isFlashing && flashingState?.status !== "DONE" && isValidVIN && (
          <OverlayView
            description="RF Noise may lead to flashing failure, you may need to re-attempt flashing"
            primaryButtonOnPress={handleFlashPress}
            primaryButtonText="FLASH VIN"
            title="NOTE"
            whiteButtonOnPress={() => {
              router.back();
            }}
            whiteButtonText="CANCEL"
          />
        )}

        {/* Show manual VIN entry when VIN is invalid */}
        {!isFlashing && flashingState?.status !== "DONE" && !isValidVIN && (
          <View
            className="rounded-lg bg-white p-8"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="mb-2 font-primaryBold text-textPrimary text-xl">
              Enter VIN
            </Text>
            <Text className="mb-2 font-primaryBold text-sm text-textPrimary">
              Invalid VIN present. Please enter a valid VIN present at the
              chassis plate on vehicle
            </Text>

            <View className="flex-row">
              <TextInput
                className="my-2 flex-1 rounded-lg border border-gray-300 px-4 font-primaryBold text-base text-textPrimary"
                maxLength={17}
                onChangeText={handleVinChange}
                placeholder="Enter Value"
                placeholderTextColor="gray"
                style={{
                  paddingVertical: Platform.OS === "ios" ? 16 : 8,
                }}
                value={vinValue}
              />
            </View>

            <View className="mt-4 flex-row justify-center">
              <PrimaryButton
                className="mr-2 flex-1"
                inactive={!newVinStatus}
                onPress={() => {
                  setIsValidVIN(true);
                  setShowProgressOverlay(true);
                  reProgram();
                }}
                text="FLASH"
              />
              <WhiteButton
                className="flex-1"
                onPress={() => router.back()}
                text="CANCEL"
              />
            </View>
          </View>
        )}

        {/* Progress Overlay */}
        {flashingState?.status !== "DONE" && (
          <Modal
            animationType="fade"
            onRequestClose={() => {
              // Modal cannot be closed during flashing
            }}
            transparent={true}
            visible={showProgressOverlay}
          >
            <View className="flex-1 items-center justify-center bg-black/50">
              <View
                className="w-11/12 rounded-lg bg-white p-5"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                  elevation: 5,
                }}
              >
                <Text className="mb-2 font-primaryBold text-2xl text-textPrimary">
                  {flashingState?.status || "Initializing..."}
                </Text>

                <Text className="mb-2 font-primaryBold text-lg text-textPrimary">
                  Block Progress:
                </Text>
                <View className="mb-4 flex-row items-center">
                  <ProgressBar
                    animated={false}
                    borderColor="#f4f4f4"
                    color={colors.primaryColor}
                    progress={
                      getPercentage(flashingState?.mainProgress || 0) / 100
                    }
                    style={{ flex: 1 }}
                    unfilledColor="#f4f4f4"
                    width={null}
                  />
                  <Text className="ml-2 w-14 font-primaryRegular text-textPrimary">
                    {getPercentage(flashingState?.mainProgress || 0)} %
                  </Text>
                </View>

                <Text className="mb-2 font-primaryBold text-lg text-textPrimary">
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
                    style={{ flex: 1 }}
                    unfilledColor="#f4f4f4"
                    width={null}
                  />
                  <Text className="ml-2 w-14 font-primaryRegular text-textPrimary">
                    {getPercentage(flashingState?.subProgress || 0)} %
                  </Text>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Success Screen */}
        {flashingState?.status === "DONE" && (
          <View
            className="rounded-lg bg-white p-4"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="mt-4 mb-4 text-center font-primaryBold text-textPrimary text-xl">
              Finished Flashing
            </Text>
            <Text className="my-2 text-center font-primaryRegular text-base text-textSecondary">
              Controller Flashed Successfully ... Toggle the ignition please!
            </Text>
            <View className="mt-6">
              <PrimaryButton
                onPress={() => {
                  router.push("/(main)/flashing/flash-success");
                }}
                text="OKAY"
              />
            </View>
          </View>
        )}

        {/* Failure Modal */}
        {showFailureModal && <FailureModal />}
      </View>

      {/* Confirmation Overlay */}
      <OverlayView
        description={`Are you sure you want to write VIN ${vinValue} to ${selectedEcu?.ecuName}?`}
        primaryButtonOnPress={handleConfirmFlash}
        primaryButtonText="CONFIRM"
        title="Confirm Write VIN"
        visible={showConfirmationOverlay}
        whiteButtonOnPress={handleCancelFlash}
        whiteButtonText="CANCEL"
      />
    </View>
  );
}
