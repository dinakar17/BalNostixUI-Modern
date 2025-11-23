import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  FlatList,
  Modal,
  NativeEventEmitter,
  NativeModules,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { infoIcon } from "@/assets/images";
import { PrimaryButton, WhiteButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { checkIfNrcError } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";
import type { ActuatorRoutine } from "@/types/bluetooth.types";

const { BluetoothModule, USBModule } = NativeModules;

export default function ActuatorsScreen() {
  const { selectedEcu, isDonglePhase3State, updateDongleToDisconnected } =
    useDataTransferStore();
  const { dataTransferMode } = useAuthStore();

  const [allActuators, setAllActuators] = useState<ActuatorRoutine[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [actuatorData, setActuatorData] = useState<ActuatorRoutine | null>(
    null
  );
  const [flashingState, setFlashingState] = useState<string[]>([]);
  const [isFlashing, setIsFlashing] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [failureMessage, setFailureMessage] = useState<{
    message: string;
    status: boolean;
  }>({
    message: "",
    status: false,
  });
  const overlayRef = useRef<ScrollView>(null);

  const eventEmitter = new NativeEventEmitter(
    dataTransferMode === "USB" ? USBModule : BluetoothModule
  );

  const startActuators = useCallback(async () => {
    try {
      const response = await BluetoothModule.getAllActuators(selectedEcu.index);
      setAllActuators(response);
    } catch {
      // Error getting actuators
    }
  }, [selectedEcu.index]);

  const toggleOverlay = () => {
    setIsVisible(!isVisible);
  };

  const flashActuator = () => {
    if (!actuatorData?.index) {
      return;
    }

    try {
      BluetoothModule.subscribeToActuator(
        selectedEcu.index,
        actuatorData.index
      );
      setFlashingState([]);
      setIsFlashing(true);
    } catch {
      // Error subscribing to actuator
    }
  };

  const handleFailure = (status: boolean, message = "") => {
    setFailureMessage({ message, status });
    setShowConfirmationModal(true);
  };

  const updateFlashingState = (trimmedMessage: string) => {
    setFlashingState((prev) => {
      if (prev.length === 0) {
        return [trimmedMessage];
      }
      if (prev.at(-1) !== trimmedMessage) {
        overlayRef?.current?.scrollToEnd();
        return [...prev, trimmedMessage];
      }
      return prev;
    });
  };

  const stopActuatorProcess = (message: string, status: boolean) => {
    toggleOverlay();
    setIsFlashing(false);
    handleFailure(status, message);
    BluetoothModule.stopAllTimersFromReact();
  };

  const handleJsonResponse = (jsonData: {
    message?: string;
    processStatus?: string;
    StepNo?: number;
    status?: boolean;
  }) => {
    const message = jsonData?.message || "";
    const trimmedMessage = message?.trim?.() || "";

    if (trimmedMessage.length !== 0) {
      updateFlashingState(trimmedMessage);
    }

    const isDone = jsonData?.processStatus?.toLowerCase() === "done";
    const isLastStep =
      actuatorData &&
      typeof jsonData.StepNo === "number" &&
      actuatorData.numberOfSteps === jsonData.StepNo + 1;

    if (isDone || isLastStep) {
      stopActuatorProcess(jsonData.message ?? "", jsonData.status ?? false);
    }
  };

  const onResponse = (response: { name: string; value: string }) => {
    try {
      if (response.name !== "actuator" || !response?.value) {
        return;
      }

      if (response.value[0] === "{") {
        const jsonData = JSON.parse(response.value);
        handleJsonResponse(jsonData);
      } else if (checkIfNrcError(response.value)) {
        stopActuatorProcess(response.value, false);
      }
    } catch {
      // Error parsing actuator response
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: Event listeners need isFlashing dependency
  useEffect(() => {
    if (isFlashing) {
      const actuatorListener = eventEmitter.addListener("actuator", onResponse);
      return () => {
        actuatorListener.remove();
        BluetoothModule.unSubscribeToActuator();
        BluetoothModule.stopAllTimersFromReact();
      };
    }
  }, [isFlashing]);

  useEffect(() => {
    startActuators();
  }, [startActuators]);

  useFocusEffect(
    useCallback(() => {
      function handleBackButton() {
        return isFlashing;
      }

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackButton
      );
      return () => subscription.remove();
    }, [isFlashing])
  );

  const FailureModal = () => (
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
            {!failureMessage.status && (
              <View className="items-center">
                <Image
                  className="h-12 w-12"
                  contentFit="contain"
                  source={infoIcon}
                />
              </View>
            )}
            <Text className="mt-4 text-center text-lg">
              {failureMessage.message}
            </Text>
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
        title="ACTUATOR ROUTINES"
      />
      <View>
        <Text className="my-4 text-center font-bold text-xl">
          {selectedEcu?.ecuName}
        </Text>
      </View>

      <ScrollView>
        <View className="mt-8 mb-9">
          <FlatList
            data={allActuators}
            keyExtractor={(item) => item.id || item.index.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="mx-4 mt-4 rounded-sm border-[0.1px] bg-white p-8 shadow-md"
                onPress={() => {
                  toggleOverlay();
                  setActuatorData(item);
                }}
              >
                <Text className="text-center font-bold">{item.name}</Text>
              </TouchableOpacity>
            )}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>

      {/* Actuator Run Modal */}
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
            className="w-[80%] rounded-lg bg-white px-4 py-5"
            onPress={(e) => e.stopPropagation()}
          >
            <View>
              <Text className="mx-4 mb-4 text-center text-xl">
                {actuatorData?.name}
              </Text>

              <View className="flex-row">
                <View className="mr-0.5 flex-1">
                  <PrimaryButton
                    inactive={isFlashing}
                    onPress={() => {
                      flashActuator();
                    }}
                    text="Run"
                  />
                </View>
                <View className="ml-0.5 flex-1">
                  <WhiteButton
                    inactive={isFlashing}
                    onPress={toggleOverlay}
                    text="Back"
                  />
                </View>
              </View>

              {isFlashing && (
                <ScrollView
                  className="mt-2 max-h-[500px] rounded border-[0.5px]"
                  contentContainerStyle={{ flexGrow: 1 }}
                  ref={overlayRef}
                >
                  {flashingState.map((item, index) => (
                    <View className="mx-2 mb-2" key={item}>
                      <Text className="mt-2 font-bold text-lg">
                        {index + 1} : {item}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {showConfirmationModal && <FailureModal />}
    </>
  );
}
