import Icon from "@expo/vector-icons/EvilIcons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  BackHandler,
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
    console.log(errorCode);
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
      const tempArray = value.map((item: ErrorCode) => ({
        ...item,
        status: item.status,
        image: danger,
      }));
      setErrorCodes(tempArray);
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

  useFocusEffect(
    useCallback(() => {
      function handleBackButton() {
        return loading;
      }

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackButton
      );
      return () => subscription.remove();
    }, [loading])
  );

  // Remove duplicates
  const uniqueList = (list: ErrorCodeWithImage[]) => {
    if (list.length <= 1) {
      return list;
    }
    const seen = new Map();
    return list.filter((item) => {
      if (seen.has(item.code)) {
        return false;
      }
      seen.set(item.code, true);
      return true;
    });
  };

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
            className="w-[90%] rounded-lg bg-white p-4"
            onPress={(e) => e.stopPropagation()}
          >
            <View>
              <View className="mb-2 items-end">
                <Icon
                  color="#000"
                  name="close"
                  onPress={() => setSelectedError(null)}
                  size={32}
                />
              </View>
              <Text className="mb-2 font-bold text-xl">
                {selectedError.code}
              </Text>
              <Text className="mb-4 text-base text-gray-600">
                {selectedError.description}
              </Text>
              <View className="mb-4 items-center">
                {selectedError.status === "inactive" ? (
                  <View className="rounded-full bg-green-500 px-4 py-2">
                    <Text className="font-bold text-white">HISTORY</Text>
                  </View>
                ) : (
                  <View className="rounded-full bg-red-500 px-4 py-2">
                    <Text className="font-bold text-white">ACTIVE</Text>
                  </View>
                )}
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
    <>
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
          data={uniqueList(errorCodes)}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => (
            <Pressable
              className="my-2 flex-row border-gray-300 border-b pb-4"
              onPress={() => setSelectedError(item)}
            >
              <View className="mx-2 justify-center p-2">
                {/* <Image source={item.image} className="h-10 w-10" /> */}
              </View>
              <View className="flex-1 justify-center">
                <Text className="pb-2 font-bold text-xl">{item.code}</Text>
                <Text className="text-base text-gray-600">
                  {item.description}
                </Text>
              </View>
              <View className="mx-4 items-end justify-center">
                {item.status === "inactive" ? (
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
        <View className="items-center justify-center">
          {!loading && (
            <Text className="mt-2 font-bold text-xl">No error codes found</Text>
          )}
        </View>
      )}

      <View className="mx-3 mt-4 mb-5 flex-row items-end justify-center">
        <View className="mr-2 flex-1">
          <PrimaryButton
            onPress={() => {
              getErrorCode();
            }}
            text="SCAN"
          />
        </View>
        <View className="flex-1">
          <WhiteButton
            onPress={() => {
              toggleOverlay();
            }}
            text="CLEAR"
          />
        </View>
      </View>

      {/* Clear Error Type Selection Modal */}
      <Modal
        animationType="fade"
        onRequestClose={toggleOverlay}
        transparent
        visible={isVisible}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50"
          onPress={toggleOverlay}
        >
          <Pressable
            className="w-[80%] rounded-lg bg-white pt-5"
            onPress={(e) => e.stopPropagation()}
          >
            <View>
              <View>
                <Icon
                  color="#000"
                  name="close"
                  onPress={() => setIsVisible(false)}
                  size={32}
                  style={{ alignSelf: "flex-end", paddingBottom: 8 }}
                />
              </View>
              <Text className="mx-4 mb-4 text-center text-xl">
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
    </>
  );
}
