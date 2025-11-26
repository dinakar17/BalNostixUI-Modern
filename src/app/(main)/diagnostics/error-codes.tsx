import Icon from "@expo/vector-icons/EvilIcons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  NativeEventEmitter,
  NativeModules,
  Pressable,
  Text,
  View,
} from "react-native";
import { danger } from "@/assets/images";
import { PrimaryButton, WhiteButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { OverlayLoading } from "@/components/ui/overlay";
import { toastError } from "@/lib/toast";
import { checkIfNrcError } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";
import type { ErrorCode } from "@/types/ecu";

const { BluetoothModule, USBModule } = NativeModules;

const ERROR_CODE_STATUS = ["Current", "History", "Both"];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let isClearCodeInProcess = false;
let isGetErrorCodeInProcess = false;

interface ErrorCodeWithImage extends ErrorCode {
  image: typeof danger;
}

export default function ErrorCodesScreen() {
  const { selectedEcu, isDonglePhase3State, updateDongleToDisconnected } =
    useDataTransferStore();
  const { dataTransferMode } = useAuthStore();

  const [errorCodes, setErrorCodes] = useState<ErrorCodeWithImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [failureMessage, setFailureMessage] = useState("");
  const [selectedError, setSelectedError] = useState<ErrorCodeWithImage | null>(
    null
  );

  const eventEmitter = new NativeEventEmitter(
    dataTransferMode === "USB" ? USBModule : BluetoothModule
  );

  // Clear error codes
  const clearCode = async (errorCode: string) => {
    console.log("[ErrorCodes] Clearing error code:", errorCode);
    setLoading(true);
    BluetoothModule.subscribeToClearCode(selectedEcu.index, errorCode);
    isClearCodeInProcess = true;
    let totalTime = 0;

    while (isClearCodeInProcess) {
      await sleep(10);
      if (totalTime > 10_000) {
        toastError("Failed to clear error codes");
        isClearCodeInProcess = false;
        setLoading(false);
      } else {
        totalTime += 10;
      }
    }
  };

  const toggleOverlay = () => {
    setIsVisible(!isVisible);
  };

  // Get error codes
  const getErrorCode = async () => {
    setLoading(true);
    BluetoothModule.subscribeToErrorCodesList(selectedEcu.index);
    isGetErrorCodeInProcess = true;
    let totalTime = 0;

    while (isGetErrorCodeInProcess) {
      await sleep(10);
      if (totalTime > 10_000) {
        isGetErrorCodeInProcess = false;
        setLoading(false);
      } else {
        totalTime += 10;
      }
    }
  };

  const handlePopUp = (message = "") => {
    setFailureMessage(message);
    setShowConfirmationModal(true);
  };

  const getStatus = (message: string | null): string => {
    if (message == null) {
      return "";
    }
    const trimmedMessage = message.trim();
    if (trimmedMessage[0] === "{") {
      try {
        const json = JSON.parse(message) as { value?: string | null };
        const value = json.value;
        if (value == null || value === "null") {
          return "";
        }
        return value;
      } catch {
        return message;
      }
    }
    return message;
  };

  const handleClearCodeResponse = (value: string | null) => {
    const newValue = getStatus(value);
    try {
      if (newValue === "DTCClearTimeOut") {
        handlePopUp("Failed to clear error codes. Timeout occurred");
        setLoading(false);
      } else if (newValue === "DTCClear") {
        handlePopUp("Error codes cleared successfully");
        getErrorCode();
      } else if (checkIfNrcError(newValue)) {
        handlePopUp(newValue);
        setLoading(false);
      }
      BluetoothModule.unsubscribeToClearCode();
      isClearCodeInProcess = false;
    } catch {
      getErrorCode();
      BluetoothModule.unsubscribeToClearCode();
      isClearCodeInProcess = false;
    }
  };

  const handleGetErrorCodesResponse = (value: ErrorCode[] | string) => {
    if (value === "Error_Out") {
      handlePopUp(
        `TimeOut, Controller did not respond. Please check the ${selectedEcu?.ecuName} and the BT dongle`
      );
    } else if (Array.isArray(value)) {
      console.log("[ErrorCodes] Error Codes received:", value);

      // Remove duplicates based on 'text' field
      const uniqueErrorCodes = value.reduce(
        (acc: ErrorCodeWithImage[], item: ErrorCode) => {
          const isDuplicate = acc.some(
            (existingItem) => existingItem.text === item.text
          );
          if (!isDuplicate) {
            acc.push({
              ...item,
              image: danger,
            });
          }
          return acc;
        },
        []
      );

      setErrorCodes(uniqueErrorCodes);
    }
    setLoading(false);
    BluetoothModule.unsubscribeToErrorCodesList();
    isGetErrorCodeInProcess = false;
  };

  const onResponse = (response: {
    name: string;
    value: string | null | ErrorCode[];
  }) => {
    if (
      response.name === "clearCode" &&
      response.value != null &&
      response.value !== "null"
    ) {
      handleClearCodeResponse(response.value as string | null);
    }

    if (response.name === "getErrorCodes") {
      handleGetErrorCodesResponse(response.value as ErrorCode[] | string);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: Event listener setup
  useEffect(() => {
    const clearCodeListener = eventEmitter.addListener("clearCode", onResponse);
    return () => {
      clearCodeListener.remove();
      isClearCodeInProcess = false;
      BluetoothModule.unsubscribeToClearCode();
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Event listener setup
  useEffect(() => {
    const getErrorCodeListener = eventEmitter.addListener(
      "getErrorCodes",
      onResponse
    );
    return () => {
      getErrorCodeListener.remove();
      isGetErrorCodeInProcess = false;
      BluetoothModule.unsubscribeToErrorCodesList();
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Run on mount
  useEffect(() => {
    getErrorCode();
  }, []);

  // Error detail modal
  const ErrorDetailModal = () => {
    if (!selectedError) {
      return null;
    }

    return (
      <Modal
        animationType="fade"
        onRequestClose={() => setSelectedError(null)}
        transparent
        visible={!!selectedError}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50"
          onPress={() => setSelectedError(null)}
        >
          <Pressable
            className="mx-4 w-[85%] rounded-lg bg-white shadow-2xl"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header with title and close button */}
            <View className="flex-row items-center justify-between border-gray-200 border-b px-4 py-3">
              <Text className="flex-1 font-bold text-lg">Error Details</Text>
              <Icon
                color="#000"
                name="close"
                onPress={() => setSelectedError(null)}
                size={32}
              />
            </View>

            {/* Error details table */}
            <View>
              {/* Fault Name Row */}
              <View className="flex-row items-center border-gray-200 border-b px-3 py-3">
                <Text className="w-[40%] font-bold text-gray-700 text-sm">
                  Fault Name
                </Text>
                <Text className="flex-1 font-semibold text-sm">
                  {selectedError.name || "N/A"}
                </Text>
              </View>

              {/* Error Code Row */}
              <View className="flex-row items-center border-gray-200 border-b px-3 py-3">
                <Text className="w-[40%] font-bold text-gray-700 text-sm">
                  Error Code
                </Text>
                <Text className="flex-1 font-semibold text-sm">
                  {selectedError.text}
                </Text>
              </View>

              {/* Description Row */}
              <View className="flex-row items-center border-gray-200 border-b px-3 py-3">
                <Text className="w-[40%] font-bold text-gray-700 text-sm">
                  Description
                </Text>
                <Text className="flex-1 font-medium text-sm">
                  {selectedError.description}
                </Text>
              </View>

              {/* Status Row */}
              <View className="flex-row items-center border-gray-200 border-b px-3 py-3">
                <Text className="w-[40%] font-bold text-gray-700 text-sm">
                  Status
                </Text>
                <View className="flex-1">
                  <View
                    className={`self-start rounded-full px-3 py-1 ${
                      selectedError.status === "History"
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                  >
                    <Text className="font-bold text-white text-xs">
                      {selectedError.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Remedy Row */}
              <View className="flex-row items-center px-3 py-3">
                <Text className="w-[40%] font-bold text-gray-700 text-sm">
                  Remedy
                </Text>
                <Text className="flex-1 font-medium text-sm">
                  {selectedError.remedy}
                </Text>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  // Confirmation modal
  const ConfirmationModal = () => (
    <Modal
      animationType="fade"
      onRequestClose={() => setShowConfirmationModal(false)}
      transparent
      visible={showConfirmationModal}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/50"
        onPress={() => setShowConfirmationModal(false)}
      >
        <Pressable
          className="w-[80%] rounded-lg bg-white px-4 py-4"
          onPress={(e) => e.stopPropagation()}
        >
          <View>
            <Text className="mt-4 text-center text-lg">{failureMessage}</Text>
          </View>

          <View className="mt-4">
            <PrimaryButton
              onPress={() => {
                setShowConfirmationModal(false);
              }}
              text="Okay"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return (
    <View className="flex-1">
      <CustomHeader
        leftButtonType="back"
        renderLeftButton
        renderRightButton={isDonglePhase3State}
        rightButtonFunction={updateDongleToDisconnected}
        rightButtonType="settings"
        title="Error Codes"
      />

      <ConfirmationModal />
      <ErrorDetailModal />

      <View>
        <Text className="my-4 text-center font-bold text-xl">
          {selectedEcu?.ecuName}
        </Text>
      </View>

      {errorCodes.length !== 0 ? (
        <FlatList
          data={errorCodes}
          keyExtractor={(item, index) => `${item.text}-${index}`}
          renderItem={({ item }) => (
            <Pressable
              className="my-2 flex-row border-gray-300 border-b pb-4"
              onPress={() => setSelectedError(item)}
            >
              <View className="mx-2 justify-center p-2">
                <Image className="h-10 w-10" source={item.image} />
              </View>
              <View className="flex-1 justify-center">
                <Text className="pb-2 font-bold text-xl">{item.text}</Text>
                <Text className="text-base text-gray-600">
                  {item.description}
                </Text>
              </View>
              <View className="mx-4 items-end justify-center">
                {item.status === "History" ? (
                  <View className="rounded-full bg-green-500 px-4 py-2">
                    <Text className="text-center font-bold text-white">
                      HISTORY
                    </Text>
                  </View>
                ) : (
                  <View className="rounded-full bg-red-500 px-4 py-2">
                    <Text className="text-center font-bold text-white">
                      ACTIVE
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          {!loading && (
            <Text className="mt-2 font-bold text-xl">No error codes found</Text>
          )}
        </View>
      )}

      <View className="mx-4 mb-6 flex-row gap-3">
        <PrimaryButton
          className="flex-1"
          onPress={() => {
            getErrorCode();
          }}
          text="SCAN"
        />
        <WhiteButton
          className="flex-1"
          onPress={() => {
            toggleOverlay();
          }}
          text="CLEAR"
        />
      </View>

      {/* Clear Error Type Selection Modal */}
      <Modal onRequestClose={toggleOverlay} transparent visible={isVisible}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/50"
          onPress={toggleOverlay}
        >
          <Pressable
            className="w-[80%] rounded-lg bg-white"
            onPress={(e) => e.stopPropagation()}
          >
            <View>
              <View className="items-end px-4 pt-3">
                <Icon
                  color="#000"
                  name="close"
                  onPress={() => setIsVisible(false)}
                  size={32}
                />
              </View>
              <Text className="px-4 pb-4 text-center text-xl">
                Select the Error Type
              </Text>
              <View>
                {ERROR_CODE_STATUS.map((item, index) => (
                  <View
                    className={`py-4 ${
                      index !== ERROR_CODE_STATUS.length - 1
                        ? "border-gray-200 border-b"
                        : ""
                    }`}
                    key={item}
                  >
                    <Pressable
                      onPress={() => {
                        clearCode(item);
                        toggleOverlay();
                      }}
                    >
                      <Text className="text-center font-bold text-xl">
                        {item}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <OverlayLoading loading={loading} />
    </View>
  );
}
