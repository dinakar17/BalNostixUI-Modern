import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  BackHandler,
  type EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { Bar as ProgressBar } from "react-native-progress";
import { useUploadAppLogs } from "@/api/data-transfer";
import { uploadBINFromJSON } from "@/api/sap";
import { infoIcon } from "@/assets/images/index";
import { PrimaryButton, WhiteButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { OverlayView } from "@/components/ui/overlay";
import { colors } from "@/constants/colors";
import { metrics } from "@/constants/metrics";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";
import type {
  BluetoothModuleType,
  WriteBinUpdatePayload,
} from "@/types/bluetooth.types";
import type { USBModuleType } from "@/types/usb.types";

const { BluetoothModule, USBModule } = NativeModules as {
  BluetoothModule: BluetoothModuleType;
  USBModule: USBModuleType;
};

type FlashingState = {
  mainProgress: number;
  subProgress: number;
  status: string;
};

export default function WriteBinScreen() {
  const { dataTransferMode, userInfo } = useAuthStore();
  const { selectedEcu } = useDataTransferStore();
  const { trigger: uploadAppLogs } = useUploadAppLogs();

  const [isVisible, setIsVisible] = useState(false);
  const [flashingState, setFlashingState] = useState<FlashingState | null>(
    null
  );
  const [isFlashing, setIsFlashing] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [failureMessage, setFailureMessage] = useState("");
  const [newValue, setNewValue] = useState("000");
  const [validBIN, setIsValidBin] = useState(true);
  const [newBinStatus, setNewBinStatus] = useState(false);

  const subscriptionRef = useRef<EmitterSubscription | null>(null);
  const isFlashingUpdatedRef = useRef(false);

  const handleFailure = (message = "") => {
    setFailureMessage(message);
    setShowConfirmationModal(true);
  };

  const checkBin = async (
    setterFunction: (value: boolean) => void,
    binNumber: string
  ) => {
    try {
      // const moduleToUse =
      //   dataTransferMode === "Bluetooth" ? BluetoothModule : USBModule;
      const isValidBin = await BluetoothModule.validateBIN(binNumber);
      setterFunction(isValidBin);
    } catch (error) {
      console.log("Check BIN error:", error);
      setterFunction(false);
    }
  };

  const uploadLogs = async () => {
    try {
      if (!(selectedEcu && userInfo)) {
        return;
      }

      // const moduleToUse =
      //   dataTransferMode === "Bluetooth" ? BluetoothModule : USBModule;
      BluetoothModule.saveAppLog(selectedEcu.index);

      await uploadAppLogs({
        serialNumber: userInfo.serial_number,
        vinNumber: selectedEcu.vinNumber,
        hexFile: selectedEcu.oldHexFileName,
      });
    } catch (error) {
      console.log("Upload logs error:", error);
    }
  };

  const getStatus = (message: unknown): string => {
    if (message == null) {
      return "";
    }

    const trimmedMessage = String(message).trim();
    if (trimmedMessage[0] === "{") {
      try {
        const json = JSON.parse(trimmedMessage);
        return json.value || message;
      } catch {
        return String(message);
      }
    }
    return String(message);
  };

  const cleanup = useCallback(() => {
    const moduleToUse =
      dataTransferMode === "Bluetooth" ? BluetoothModule : USBModule;

    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }

    // biome-ignore lint/suspicious/noExplicitAny: USBModule doesn't have these methods yet
    (moduleToUse as any).unSubscribeToWriteBinUpdate();
    // biome-ignore lint/suspicious/noExplicitAny: USBModule doesn't have this method yet
    (moduleToUse as any).stopAllTimersFromReact();

    isFlashingUpdatedRef.current = false;
    setIsVisible(false);
    setIsFlashing(false);
  }, [dataTransferMode]);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex BIN write response handling required
  const onResponse = async (response: WriteBinUpdatePayload) => {
    if (response.name === "updateWriteBin" && response.value) {
      const flashResponse: FlashingState = {
        mainProgress: response.value.mainProgress,
        subProgress: response.value.subProgress,
        status: getStatus(response.value.status),
      };

      // Failure condition
      if (
        flashResponse.mainProgress === -1 ||
        flashResponse.subProgress === -1
      ) {
        cleanup();
        handleFailure(flashResponse.status);
        await uploadLogs();
        return;
      }

      // Success condition
      if (flashResponse.mainProgress === 100) {
        setFlashingState({ ...flashResponse, status: "DONE" });

        // Handle BIN data upload to SAP - only when mainProgress is 100
        if (
          response.value.status &&
          typeof response.value.status === "string" &&
          selectedEcu &&
          userInfo
        ) {
          try {
            await uploadBINFromJSON(
              selectedEcu.vinNumber,
              response.value.status,
              userInfo.dealer_code,
              userInfo.serial_number,
              {
                onSuccess: (data) => {
                  console.log("Bin data sent successfully to the api", data);
                },
                onError: (error) => {
                  console.log("Error sending bin data to the api:", error);
                },
              }
            );
          } catch (error) {
            console.log(
              "Error parsing status JSON or BinUploadData in WriteBin:",
              error
            );
          }
        }

        cleanup();
        return;
      }

      setFlashingState(flashResponse);
    }
  };

  const reProgram = () => {
    if (!selectedEcu) {
      return;
    }

    try {
      setFailureMessage("");

      const moduleToUse =
        dataTransferMode === "Bluetooth" ? BluetoothModule : USBModule;
      const eventEmitter = new NativeEventEmitter(moduleToUse);

      // biome-ignore lint/suspicious/noExplicitAny: USBModule doesn't have this method yet
      (moduleToUse as any).subscribeToWriteBinUpdate(
        selectedEcu.index,
        newValue
      );
      subscriptionRef.current = eventEmitter.addListener(
        "updateWriteBin",
        onResponse
      );

      setIsFlashing(true);
      isFlashingUpdatedRef.current = true;

      // Timeout mechanism
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
      checkTimeout();
    } catch (error) {
      console.log("reProgram error:", error);
      handleFailure("Failed to start BIN write");
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
        return false;
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

  const FailureModal = () => {
    const failureMessageUI =
      failureMessage === "INVALID_BIN"
        ? "Unable to get BIN from BMS.\nCheck BMS CAN Connector or provide BIN manually.\nPlease Try again"
        : failureMessage;

    return (
      <View className="absolute inset-0 items-center justify-center bg-black/50">
        <View className="mx-8 w-[83%] rounded-lg bg-white px-4 py-4">
          <Image
            className="h-10 w-10 self-center"
            contentFit="contain"
            source={infoIcon}
          />
          <Text className="mt-4 text-center font-proximanova text-lg">
            {failureMessageUI}
          </Text>
          <View className="mt-4">
            <PrimaryButton
              onPress={() => {
                if (failureMessage === "INVALID_BIN") {
                  setShowConfirmationModal(false);
                  setIsValidBin(false);
                } else {
                  router.back();
                }
              }}
              text="Okay"
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1">
      <CustomHeader
        leftButtonFunction={() => router.back()}
        leftButtonType="back"
        title="WRITE BIN"
      />

      <View className="py-4">
        <Text className="text-center font-helveticaBold text-xl">
          {selectedEcu?.ecuName}
        </Text>
      </View>

      <View className="mx-4 flex-1 justify-center bg-gray-100">
        <View className="items-center justify-center">
          {!isFlashing &&
            flashingState?.status !== "DONE" &&
            !showConfirmationModal &&
            validBIN && (
              <OverlayView
                description="RF Noise may lead to flashing failure, you may need to re-attempt flashing"
                primaryButtonOnPress={() => {
                  reProgram();
                  setIsVisible(true);
                }}
                primaryButtonText="FLASH BIN"
                title="NOTE"
                whiteButtonOnPress={() => {
                  router.back();
                }}
                whiteButtonText="CANCEL"
              />
            )}

          {!isFlashing && flashingState?.status !== "DONE" && !validBIN && (
            <View className="w-[90%] rounded-xl bg-white py-8">
              <Text className="mx-4 mb-2 font-helveticaBold text-black text-xl">
                Enter BIN
              </Text>
              <Text className="mx-4 mb-2 font-helveticaBold text-black text-sm">
                In-valid BIN present, Please enter a valid BIN
              </Text>
              <TextInput
                className="mx-2 my-2 rounded-lg border border-[#d7dbe1] px-4 py-2 font-helveticaBold text-base text-black"
                maxLength={16}
                onChangeText={(value) => {
                  const updateCaseValue = value.toUpperCase();
                  if (updateCaseValue.length === 16) {
                    checkBin(setNewBinStatus, updateCaseValue);
                  } else {
                    setNewBinStatus(false);
                  }
                  setNewValue(updateCaseValue);
                }}
                placeholder="Enter Value"
                placeholderTextColor="gray"
                style={{
                  paddingVertical: Platform.OS === "ios" ? 16 : 8,
                }}
                value={newValue}
              />
              <View className="mx-3 mt-4 flex-row justify-center">
                <View className="mr-2 flex-1">
                  <PrimaryButton
                    inactive={!newBinStatus}
                    onPress={() => {
                      setIsValidBin(true);
                      reProgram();
                      setIsVisible(true);
                    }}
                    text="FLASH"
                  />
                </View>
                <View className="flex-1">
                  <WhiteButton
                    onPress={() => {
                      router.back();
                    }}
                    text="CANCEL"
                  />
                </View>
              </View>
            </View>
          )}

          <LinearGradient
            className="flex-1"
            colors={["#4c669f", "#3b5998", "#192f6a"]}
          />

          {flashingState?.status !== "DONE" && isVisible && (
            <View className="rounded-lg bg-white p-4">
              <View style={{ minWidth: metrics.width / 1.3 }}>
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
              <Text className="mt-4 mb-4 text-center font-helveticaBold text-xl">
                Finished Flashing
              </Text>
              <Text className="mx-4 my-2 text-center text-[#5d5d5d] text-base">
                Controller Flashed Successfully ... Toggle the ignition please!
              </Text>
              <View className="mx-4 mt-6">
                <PrimaryButton
                  onPress={() => {
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
    </View>
  );
}
