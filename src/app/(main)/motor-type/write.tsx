import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  NativeEventEmitter,
  NativeModules,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { scanAgain } from "@/assets/images/index";
import { PrimaryButton, WhiteButton } from "@/components/ui/button";
import { CustomDropdown } from "@/components/ui/dropdown";
import { CustomHeader } from "@/components/ui/header";
import { OverlayLoading } from "@/components/ui/overlay";
import { ShadowBox } from "@/components/ui/shadow-box";
import { metrics } from "@/constants/metrics";
import { toastError, toastInfo } from "@/lib/toast";
import { checkIfNrcError } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";

const { BluetoothModule, USBModule } = NativeModules;

type WriteParameter = {
  description: string;
  value: string;
  hint: string;
  maxValue?: string;
  minValue?: string;
  valueType?: string;
  defaultValue?: string;
  showProgress?: boolean;
  timeoutInMs?: number;
};

type WriteParameterProgress = {
  status: "inprogress" | "Done";
  message: string;
};

type DropdownItem = {
  label: string;
  value: string | number;
};

const inputValidation = (type: string, string = ""): string => {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ASCII range validation requires control characters
  const ASCII_REGEX = /[\x00-\x7F]/g;
  const HEX_REGEX = /[0-9A-Fa-f]/g;
  const INT_REGEX = /\d/g;
  const FLOAT_REGEX = /[\d.]/g;

  switch (type) {
    case "ASCII":
      return (string.match(ASCII_REGEX) || []).join("");
    case "FLOAT":
      return (string.match(FLOAT_REGEX) || []).join("");
    case "INT":
      return (string.match(INT_REGEX) || []).join("");
    case "HEX":
      return (string.match(HEX_REGEX) || []).join("").toUpperCase();
    default:
      return string;
  }
};

export default function ManualWriteMotorTypeScreen() {
  const { dataTransferMode } = useAuthStore();
  const { selectedEcu, updateIsMotorTypeAlreadyWritten } =
    useDataTransferStore();

  const [loading, setLoading] = useState(false);
  const [writeParameter, setWriteParameter] = useState<WriteParameter[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState<{ editData?: WriteParameter }>({});
  const [newValue, setNewValue] = useState("");
  const [writeParameterFlashProgress, setWriteParameterFlashProgress] =
    useState<WriteParameterProgress>({
      status: "Done",
      message: "",
    });
  const [motorTypeWritten, setMotorTypeWritten] = useState(false);

  // Custom dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownItems, setDropdownItems] = useState<DropdownItem[]>([]);
  const [hasOptions, setHasOptions] = useState(false);
  const [selectedOption, setSelectedOption] = useState<DropdownItem | null>(
    null
  );

  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const updateUISubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const isFlashingUpdatedRef = useRef(false);

  // Filter to show only Motor_Type_Identification and MCU_OffsetLearn_Trigger
  const filteredData = writeParameter.filter(
    (item) =>
      item.description === "Motor_Type_Identification" ||
      item.description === "MCU_OffsetLearn_Trigger"
  );

  const motorTypeItem = filteredData.find(
    (item) => item.description === "Motor_Type_Identification"
  );
  const offsetLearnItem = filteredData.find(
    (item) => item.description === "MCU_OffsetLearn_Trigger"
  );

  const getWriteParameter = React.useCallback(() => {
    try {
      if (!selectedEcu) {
        return;
      }
      setLoading(true);
      const moduleToUse =
        dataTransferMode === "USB" ? USBModule : BluetoothModule;
      // biome-ignore lint/suspicious/noExplicitAny: USB module doesn't have getWriteParameter
      (moduleToUse as any).getWriteParameter(selectedEcu.index);
    } catch (err) {
      console.log("Get write parameter error:", err);
      setLoading(false);
    }
  }, [selectedEcu, dataTransferMode]);

  useFocusEffect(
    React.useCallback(() => {
      getWriteParameter();
    }, [getWriteParameter])
  );

  const getWriteParameters = async (description: string) => {
    try {
      if (!selectedEcu) {
        return;
      }

      setWriteParameterFlashProgress({
        status: "inprogress",
        message: `Write Parameter ${description} is in progress`,
      });
      setIsVisible(false);
      setShowModal(true);
      setLoading(true);

      const moduleToUse =
        dataTransferMode === "USB" ? USBModule : BluetoothModule;
      // biome-ignore lint/suspicious/noExplicitAny: USB module doesn't have getWriteDidParameter
      await (moduleToUse as any).getWriteDidParameter(
        selectedEcu.index,
        description,
        newValue
      );

      setNewValue("");
      setHasOptions(false);
      setShowDropdown(false);
      setSelectedOption(null);
      isFlashingUpdatedRef.current = true;

      let totalTime = 0;
      let waitTimeByDefault = 26_000;
      if (
        editData?.editData?.showProgress &&
        editData?.editData?.timeoutInMs &&
        waitTimeByDefault < editData.editData.timeoutInMs
      ) {
        waitTimeByDefault = editData.editData.timeoutInMs + 100;
      }

      const checkTimeout = async () => {
        while (isFlashingUpdatedRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          if (totalTime > waitTimeByDefault) {
            isFlashingUpdatedRef.current = false;
            setWriteParameterFlashProgress({
              status: "Done",
              message: "Write Parameter failed: Timeout",
            });
            setLoading(false);
            break;
          }
          totalTime += 10;
        }
      };
      checkTimeout();
    } catch (error) {
      console.log("Write parameter error:", error);
      setLoading(false);
    }
  };

  const getStatus = (message: unknown): string => {
    try {
      if (message == null) {
        return "";
      }
      const trimmedMessage = String(message).trim();
      if (trimmedMessage[0] === "{") {
        const json = JSON.parse(trimmedMessage);
        return String(json.value || message);
      }
      return String(message);
    } catch {
      console.log("Get status error:", message);
      return "";
    }
  };

  const onWriteParameterResponse = (response: unknown) => {
    try {
      const resp = response as {
        name: string;
        success: boolean;
        data: WriteParameter[];
      };
      if (resp.name === "writeparameters" && resp.success) {
        setLoading(false);
        setWriteParameter([...resp.data]);
      }
    } catch {
      console.log("Write parameter response error:", response);
    }
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Motor type update handler requires conditional logic
  const onUpdateUIResponse = (response: unknown) => {
    try {
      const resp = response as { name: string; value: unknown };
      if (resp.name === "updateUI") {
        const responseString = getStatus(resp.value);

        if (
          responseString === "Rescan" ||
          responseString === "RescanWriteParam" ||
          responseString === "ResultPassWriteParam" ||
          responseString === "ResultFailWriteParam" ||
          responseString === "SuccessfullyWritten"
        ) {
          if (isFlashingUpdatedRef.current) {
            isFlashingUpdatedRef.current = false;

            let msgResult = "Write Parameter was successful";
            let msgStatus: "Done" | "inprogress" = "Done";

            if (responseString === "ResultFailWriteParam") {
              msgResult =
                "Operation Result reported by ecu is Fail, Please retry again!";
            } else if (responseString === "ResultPassWriteParam") {
              msgResult = "Operation Result reported by ecu is Success.";

              if (
                editData?.editData?.description === "Motor_Type_Identification"
              ) {
                console.log(
                  "Motor Type written successfully, enabling offset learn"
                );
                setMotorTypeWritten(true);
                updateIsMotorTypeAlreadyWritten(true);
                return;
              }
            } else if (
              editData?.editData?.showProgress &&
              responseString === "SuccessfullyWritten"
            ) {
              msgResult =
                "Write Parameter was successful.\\n\\nWaiting for the Operation Result...";
              msgStatus = "inprogress";
              isFlashingUpdatedRef.current = true;

              if (
                editData?.editData?.description === "Motor_Type_Identification"
              ) {
                console.log(
                  "Motor Type written successfully, enabling offset learn"
                );
                setMotorTypeWritten(true);
                return;
              }
            } else if (
              editData?.editData?.description === "Motor_Type_Identification"
            ) {
              console.log(
                "Motor Type written successfully, enabling offset learn"
              );
              setMotorTypeWritten(true);
              updateIsMotorTypeAlreadyWritten(true);
            }

            setWriteParameterFlashProgress({
              status: msgStatus,
              message: msgResult,
            });

            if (!isFlashingUpdatedRef.current) {
              setLoading(false);
              setTimeout(() => getWriteParameter(), 500);
            }
          }
        } else if (
          checkIfNrcError(responseString) ||
          responseString === "TimeOutInWriteParam"
        ) {
          isFlashingUpdatedRef.current = false;
          setWriteParameterFlashProgress({
            status: "Done",
            message: `Write Parameter failed: ${responseString}`,
          });
          setLoading(false);
        }
      }
    } catch {
      console.log("UpdateUI response error:", response);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: Event listener setup
  useEffect(() => {
    const moduleToUse =
      dataTransferMode === "USB" ? USBModule : BluetoothModule;
    const eventEmitter = new NativeEventEmitter(moduleToUse);

    subscriptionRef.current = eventEmitter.addListener(
      "writeparameters",
      onWriteParameterResponse
    );
    updateUISubscriptionRef.current = eventEmitter.addListener(
      "updateUI",
      onUpdateUIResponse
    );

    return () => {
      subscriptionRef.current?.remove();
      updateUISubscriptionRef.current?.remove();
      // biome-ignore lint/suspicious/noExplicitAny: USB module doesn't have stopReadParametersTimer
      (moduleToUse as any).stopReadParametersTimer();
    };
  }, [
    editData,
    motorTypeWritten,
    dataTransferMode,
    updateIsMotorTypeAlreadyWritten,
  ]);

  const onEditDidParameterButtonClick = (item: WriteParameter) => {
    if (item.description === "MCU_OffsetLearn_Trigger" && !motorTypeWritten) {
      toastInfo(
        "Please write Motor Type Identification first before triggering Offset Learn"
      );
      return;
    }

    const hint = item?.hint?.toString()?.toUpperCase();
    if (hint && hint !== "NULL" && hint !== "NONE" && hint !== "") {
      try {
        const finalValueArray = item.hint.split(",").map((element) => {
          const [value, label] = element.trim().split("=");
          return { label: label.trim(), value: value.trim() };
        });
        setDropdownItems(finalValueArray);
        setHasOptions(true);
      } catch {
        setHasOptions(false);
      }
    } else {
      setHasOptions(false);
    }

    setEditData({ editData: item });
    setNewValue("");
    setSelectedOption(null);
    setIsVisible(true);
  };

  const onWriteModelOkPress = () => {
    setShowModal(false);
  };

  const handleDropdownSelect = (item: DropdownItem) => {
    setSelectedOption(item);
    setNewValue(String(item.value));
    setShowDropdown(false);
  };

  const handleBackButton = React.useCallback(() => {
    if (loading) {
      return true;
    }
    return false;
  }, [loading]);

  useFocusEffect(
    React.useCallback(() => {
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackButton
      );
      return () => backHandler.remove();
    }, [handleBackButton])
  );

  const EditIcon = ({ enabled = true }: { enabled?: boolean }) => (
    <Feather color={enabled ? "#63C76D" : "#ccc"} name="edit-2" size={20} />
  );

  const ScanAgainButton = () => (
    <LinearGradient
      className="rounded-[10px]"
      colors={["#009CDE", "#003087"]}
      end={{ x: 0, y: 1 }}
      start={{ x: 0, y: 0 }}
    >
      <TouchableOpacity
        className="flex-row items-center justify-center"
        onPress={() => {
          setLoading(true);
          getWriteParameter();
        }}
      >
        <Image
          className="mr-2 h-[35px] w-[35px]"
          contentFit="contain"
          source={scanAgain}
          tintColor="white"
        />
        <View className="h-[50px] items-center justify-center">
          <Text className="text-lg text-white tracking-wider">Scan Again</Text>
        </View>
      </TouchableOpacity>
    </LinearGradient>
  );

  return (
    <>
      <CustomHeader
        leftButtonType="back"
        renderLeftButton
        title="MOTOR TYPE CONFIGURATION"
      />

      <View className="py-4">
        <Text className="text-center font-helveticaBold text-xl">
          {selectedEcu?.ecuName}
        </Text>
      </View>

      {filteredData.length > 0 ? (
        <>
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            {motorTypeItem && (
              <TouchableOpacity
                className="mx-4 my-2 flex-row items-center rounded-lg bg-[#f8f9fa] p-4 shadow-sm"
                onPress={() => onEditDidParameterButtonClick(motorTypeItem)}
                style={{
                  elevation: 2,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 1.41,
                }}
              >
                <View className="flex-1">
                  <Text className="mb-1 font-helveticaBold text-[#333] text-lg">
                    Motor Type Identification
                  </Text>
                  <Text className="font-helveticaBold text-[#666] text-base">
                    Current: {motorTypeItem.value}
                  </Text>
                </View>
                <EditIcon enabled={true} />
              </TouchableOpacity>
            )}

            {offsetLearnItem && (
              <TouchableOpacity
                className={`mx-4 my-2 flex-row items-center rounded-lg p-4 shadow-sm ${
                  motorTypeWritten ? "bg-[#f8f9fa]" : "bg-[#f0f0f0] opacity-60"
                }`}
                onPress={() => onEditDidParameterButtonClick(offsetLearnItem)}
                style={
                  motorTypeWritten
                    ? {
                        elevation: 2,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.2,
                        shadowRadius: 1.41,
                      }
                    : { elevation: 0 }
                }
              >
                <View className="flex-1">
                  <Text
                    className={`mb-1 font-helveticaBold text-lg ${
                      motorTypeWritten ? "text-[#333]" : "text-[#999]"
                    }`}
                  >
                    MCU Offset Learn Trigger
                  </Text>
                  <Text
                    className={`font-helveticaBold text-base ${
                      motorTypeWritten ? "text-[#666]" : "text-[#999]"
                    }`}
                  >
                    Current: {offsetLearnItem.value}
                  </Text>
                  {!motorTypeWritten && (
                    <Text className="mt-0.5 text-[#ff6b6b] text-xs italic">
                      Write Motor Type first
                    </Text>
                  )}
                </View>
                <EditIcon enabled={motorTypeWritten} />
              </TouchableOpacity>
            )}

            <View className="mx-4 mt-5 rounded-lg border-l-4 border-l-[#2196f3] bg-[#e3f2fd] p-4">
              <Text className="font-helveticaBold text-[#1976d2] text-base">
                ℹ️ Information
              </Text>
              <Text className="mt-2 text-[#333] text-sm leading-5">
                MCU offset Learn Trigger can only be updated after you write the
                motor type.
              </Text>
              {motorTypeWritten && (
                <Text className="mt-2 font-helveticaBold text-[#4caf50] text-sm">
                  ✅ Motor Type has been configured. Offset Learn is now
                  available.
                </Text>
              )}
            </View>
          </ScrollView>

          <ShadowBox className="px-4 py-4">
            <ScanAgainButton />
          </ShadowBox>
        </>
      ) : (
        <>
          <View className="flex-[3] items-center justify-center">
            <Text className="font-proximanovaBold text-lg">
              NO MOTOR TYPE DATA FOUND
            </Text>
          </View>
          <View className="mx-4 mt-4 mb-[50px] flex-1 justify-end">
            <ScanAgainButton />
          </View>
        </>
      )}

      {/* Edit Modal */}
      {isVisible && (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <View
            className="rounded-[10px] bg-white px-4 py-8"
            style={{ width: metrics.width / 1.1 }}
          >
            <Text className="mb-2 font-helveticaBold text-black text-xl">
              {editData?.editData?.description}
            </Text>
            <Text className="mb-2 font-helveticaBold text-[#777] text-base">
              Current: {editData?.editData?.value}
            </Text>

            {hasOptions ? (
              <CustomDropdown
                dropdownItems={dropdownItems}
                handleDropdownSelect={handleDropdownSelect}
                selectedOption={selectedOption}
                setShowDropdown={setShowDropdown}
                showDropdown={showDropdown}
              />
            ) : (
              <TextInput
                className="my-2 rounded-lg border border-[#d7dbe1] px-[15px] font-helveticaBold text-base text-black"
                onChangeText={(value) =>
                  setNewValue(
                    inputValidation(editData?.editData?.valueType || "", value)
                  )
                }
                placeholder="Enter Value"
                placeholderTextColor="gray"
                style={{
                  paddingVertical: Platform.OS === "ios" ? 16 : 8,
                }}
                value={newValue}
              />
            )}

            {editData?.editData?.hint &&
              !hasOptions &&
              editData.editData.hint !== "0" && (
                <Text className="mt-2 font-helveticaBold text-base text-black">
                  Input type: {editData.editData.hint.toString()}
                </Text>
              )}

            {editData?.editData?.maxValue && editData?.editData?.minValue && (
              <Text className="mt-2 font-helveticaBold text-base text-black">
                Value Range: {editData.editData.minValue} -{" "}
                {editData.editData.maxValue}
              </Text>
            )}

            <View className="mt-4 flex-row justify-center">
              <PrimaryButton
                inactive={newValue.length === 0}
                onPress={() => {
                  const maxValue = Number.parseFloat(
                    editData?.editData?.maxValue || ""
                  );
                  const minValue = Number.parseFloat(
                    editData?.editData?.minValue || ""
                  );
                  const numValue = Number.parseFloat(newValue);

                  if (Number.isNaN(maxValue) || Number.isNaN(minValue)) {
                    getWriteParameters(editData?.editData?.description || "");
                  } else if (numValue >= minValue && numValue <= maxValue) {
                    getWriteParameters(editData?.editData?.description || "");
                  } else {
                    toastError(
                      `Please enter value between ${minValue} - ${maxValue}`
                    );
                    return;
                  }
                  setShowDropdown(false);
                }}
                text="CONFIRM"
              />
              <WhiteButton
                className="flex-1 border-primary-500 text-primary-500"
                onPress={() => {
                  setIsVisible(false);
                  setNewValue("");
                  setHasOptions(false);
                  setShowDropdown(false);
                  setSelectedOption(null);
                }}
                text="CANCEL"
              />
            </View>
          </View>
        </View>
      )}

      {/* Progress Modal */}
      {showModal && (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <View
            className="rounded-[10px] bg-white px-4 py-8"
            style={{ width: metrics.width / 1.1 }}
          >
            <Text className="text-center font-helveticaBold text-lg">
              {writeParameterFlashProgress.message}
            </Text>
            <View className="mt-4">
              <PrimaryButton
                inactive={writeParameterFlashProgress.status === "inprogress"}
                onPress={onWriteModelOkPress}
                text="Okay"
              />
            </View>
          </View>
        </View>
      )}

      <OverlayLoading loading={loading} />
    </>
  );
}
