import Icon from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  BackHandler,
  FlatList,
  Modal,
  NativeEventEmitter,
  NativeModules,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FMSApi } from "@/api/fms";
import { scanAgain } from "@/assets/images";
import { PrimaryButton, WhiteButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { OverlayLoading } from "@/components/ui/overlay";
import { ShadowBox } from "@/components/ui/shadow-box";
import { toastError, toastInfo } from "@/lib/toast";
import { checkIfNrcError } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";
import type { DIDParameter } from "@/types/ecu";

const { BluetoothModule, USBModule } = NativeModules;

let isFlashingUpdated = false;

function removeCharsNotMatchingRegex(str: string, regex: string) {
  return str.replace(new RegExp(`[^${regex}]`, "g"), "");
}

const inputValidation = (type: string, string = "") => {
  const ASCII_REGEX = "[\\x00-\\x7F]";
  const HEX_REGEX = "0-9A-Fa-f";
  const INT_REGEX = "\\d";
  const FLOAT_REGEX = "\\d\\.";

  switch (type) {
    case "ASCII":
      return removeCharsNotMatchingRegex(string, ASCII_REGEX);
    case "FLOAT":
      return removeCharsNotMatchingRegex(string, FLOAT_REGEX);
    case "INT":
      return removeCharsNotMatchingRegex(string, INT_REGEX);
    case "HEX":
      return removeCharsNotMatchingRegex(string, HEX_REGEX).toUpperCase();
    default:
      return string;
  }
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type DropdownItem = {
  label: string;
  value: string;
};

type WriteParameterResponse = {
  name: string;
  success?: boolean;
  data?: DIDParameter[];
  value?: string;
};

type EditData = {
  editData?: DIDParameter & {
    isCallProPackStatusUploadApi?: boolean;
    valueType?: string;
    maxValue?: string;
    minValue?: string;
  };
};

type WriteParameterFlashProgress = {
  status: string;
  message: string;
};

export default function WriteParametersScreen() {
  const { userInfo, handleLogout, dataTransferMode } = useAuthStore();
  const {
    selectedEcu,
    isDonglePhase3State,
    updateDongleToDisconnected,
    isMotorTypeAlreadyWritten,
  } = useDataTransferStore();

  const [loading, setLoading] = useState(false);
  const [writeParameter, setWriteParameter] = useState<DIDParameter[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState<EditData>({});
  const [newValue, setNewValue] = useState("");
  const [writeParameterFlashProgress, setWriteParameterFlashProgress] =
    useState<WriteParameterFlashProgress>({
      status: "",
      message: "",
    });
  const [hasOptions, setHasOptions] = useState(false);
  const [items, setItems] = useState<DropdownItem[]>([]);
  const [selectedDropdownValue, setSelectedDropdownValue] = useState<
    string | null
  >(null);

  const eventEmitter = new NativeEventEmitter(
    dataTransferMode === "USB" ? USBModule : BluetoothModule
  );

  const getWriteParameter = useCallback(() => {
    try {
      BluetoothModule.getWriteParameter(selectedEcu.index);
    } catch (err) {
      console.log(err);
    }
  }, [selectedEcu.index]);

  const getStatus = (message: string | null) => {
    try {
      if (message == null) {
        return "";
      }
      const trimmedMessage = message.trim();
      if (trimmedMessage[0] === "{") {
        const json = JSON.parse(message);
        return json.value;
      }
      return message;
    } catch {
      console.log("Data coming from lib:", message);
      return "";
    }
  };

  const handleWriteSuccess = (responseString: string) => {
    let msgResult = "Write Parameter was successful";
    let msgStatus = "Done";

    if (responseString === "ResultFailWriteParam") {
      msgResult =
        "Operation Result reported by ecu is Fail, Please retry again!";
    } else if (responseString === "ResultPassWriteParam") {
      msgResult = "Operation Result reported by ecu is Success.";
    } else if (
      editData?.editData?.showProgress &&
      responseString === "SuccessfullyWritten"
    ) {
      msgResult =
        "Write Parameter was successful.\\n\\nWaiting for the Operation Result...";
      msgStatus = "inprogress";
      isFlashingUpdated = true;
    }

    setWriteParameterFlashProgress({
      status: msgStatus,
      message: msgResult,
    });

    if (!isFlashingUpdated) {
      isFlashingUpdated = false;
      setLoading(false);
      getWriteParameter();
    }
  };

  const handleWriteParametersResponse = (data: DIDParameter[]) => {
    setLoading(false);
    setWriteParameter([...data]);
  };

  const handleUpdateUIResponse = (responseString: string) => {
    if (isSuccessResponseString(responseString)) {
      handleSuccessResponse(responseString);
    } else if (
      checkIfNrcError(responseString) ||
      responseString === "TimeOutInWriteParam"
    ) {
      handleFailureResponse(responseString);
    }
  };

  const handleSuccessResponse = (responseString: string) => {
    if (editData?.editData?.isCallProPackStatusUploadApi) {
      postProPack();
      return;
    }

    if (isFlashingUpdated) {
      isFlashingUpdated = false;
      handleWriteSuccess(responseString);
    }
  };

  const handleFailureResponse = (responseString: string) => {
    isFlashingUpdated = false;
    setWriteParameterFlashProgress({
      status: "Done",
      message: `Write Parameter failed :- ${responseString}`,
    });
    setLoading(false);
  };

  const isSuccessResponseString = (responseString: string) =>
    responseString === "Rescan" ||
    responseString === "RescanWriteParam" ||
    responseString === "ResultPassWriteParam" ||
    responseString === "ResultFailWriteParam" ||
    responseString === "SuccessfullyWritten";

  const postProPack = async () => {
    try {
      await FMSApi.post(
        "/api/v4/pro-pack-status-update",
        {
          vin: selectedEcu.vinNumber,
          status: "Enabled",
        },
        {
          headers: { Authorization: `Bearer ${userInfo?.token}` },
          timeout: 30_000,
        }
      );

      if (isFlashingUpdated) {
        isFlashingUpdated = false;
        setWriteParameterFlashProgress({
          status: "Done",
          message: "Write Parameter was successful",
        });
        setLoading(false);
        getWriteParameter();
      }
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        const apiError = error as { response?: { status?: number } };
        if (apiError.response?.status === 401) {
          toastError("You've been inactive for a while, Please login again.");
          handleLogout();
          return null;
        }
      }
      if (isFlashingUpdated) {
        isFlashingUpdated = false;
        setWriteParameterFlashProgress({
          status: "Done",
          message: "Write Parameter was successful",
        });
        setLoading(false);
        getWriteParameter();
      }
    }
  };

  const getWriteParameters = async (description: string) => {
    try {
      setWriteParameterFlashProgress({
        status: "inprogress",
        message: "Write Parameter is inprogress",
      });
      setIsVisible(false);
      setShowModal(true);
      setLoading(true);
      await BluetoothModule.getWriteDidParameter(
        selectedEcu.index,
        description,
        newValue
      );
      setNewValue("");
      setHasOptions(false);
      isFlashingUpdated = true;
      let totalTime = 0;
      let waitTimeByDefault = 26_000;

      if (
        editData?.editData?.showProgress &&
        waitTimeByDefault < editData.editData.timeoutInMs
      ) {
        waitTimeByDefault = editData.editData.timeoutInMs + 100;
      }

      while (isFlashingUpdated) {
        await sleep(10);
        if (totalTime > waitTimeByDefault) {
          isFlashingUpdated = false;
          setWriteParameterFlashProgress({
            status: "Done",
            message: "Write Parameter failed :- Timeout",
          });
          setLoading(false);
        } else {
          totalTime += 10;
        }
      }
    } catch (_error) {
      console.log(_error);
    }
  };

  const onResponse = (response: WriteParameterResponse) => {
    try {
      if (
        response.name === "writeparameters" &&
        response.success &&
        response.data
      ) {
        handleWriteParametersResponse(response.data);
        return;
      }

      if (response.name === "updateUI") {
        const responseString = getStatus(response.value || "");
        handleUpdateUIResponse(responseString);
      }
    } catch (err) {
      console.log(err);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: Event listeners need editData dependency
  useEffect(() => {
    const nativeListener = eventEmitter.addListener(
      "writeparameters",
      onResponse
    );
    const updateUiListener = eventEmitter.addListener("updateUI", onResponse);
    return () => {
      nativeListener.remove();
      updateUiListener.remove();
      BluetoothModule.stopReadParametersTimer();
    };
  }, [editData]);

  useFocusEffect(
    useCallback(() => {
      console.log(`writeParameter ${writeParameter.length}`);
      getWriteParameter();
    }, [getWriteParameter, writeParameter.length])
  );

  const handleBackButton = useCallback(() => {
    if (loading) {
      return true;
    }
    return false;
  }, [loading]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackButton
      );
      return () => subscription.remove();
    }, [handleBackButton])
  );

  const onEditDidParameterButtonClick = (item: DIDParameter) => {
    if (
      item.didHex === selectedEcu.motorTypeId &&
      selectedEcu.isAutomateMotorType
    ) {
      router.push("/(main)/motor-type/write");
      return;
    }

    if (
      item.didHex === selectedEcu.mcuOffsetLearnTriggerId &&
      !isMotorTypeAlreadyWritten &&
      selectedEcu.isAutomateMotorType
    ) {
      router.push("/(main)/motor-type/write");
      toastInfo("Please scan the qr code and write the motor type first");
      return;
    }

    const hint = item?.hint?.toString()?.toUpperCase();
    if (hint && hint !== "NULL" && hint !== "NONE" && hint !== "") {
      try {
        const string = item.hint.toString();
        const finalValueArray = string.split(",").map((element) => {
          const [value, label] = element.trim().split("=");
          return { label: label.trim(), value: value.trim() };
        });
        setItems(finalValueArray);
        setHasOptions(true);
      } catch {
        setHasOptions(false);
      }
    }
    setEditData({ editData: item });
    setIsVisible(true);
  };

  const onWriteModelOkPress = () => {
    setShowModal(false);
  };

  const ScanAgainButton = () => (
    <TouchableOpacity
      className="h-12 items-center justify-center rounded-lg bg-blue-600"
      onPress={() => {
        setLoading(true);
        getWriteParameter();
      }}
    >
      <View className="flex-row items-center justify-center">
        <Image
          contentFit="contain"
          source={scanAgain}
          style={{ height: 35, width: 35, marginRight: 8, tintColor: "white" }}
        />
        <Text className="text-lg text-white">Scan Again</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <CustomHeader
        leftButtonType="back"
        renderLeftButton={true}
        renderRightButton={isDonglePhase3State}
        rightButtonFunction={updateDongleToDisconnected}
        rightButtonType="settings"
        title="Write PARAMETERS"
      />
      <View>
        <Text className="my-4 text-center font-bold text-xl">
          {selectedEcu?.ecuName}
        </Text>
      </View>

      {writeParameter.length !== 0 ? (
        <>
          <ScrollView
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            {writeParameter.map((item) => (
              <TouchableOpacity
                className="flex-1 py-4"
                key={item.didHex}
                onPress={() => onEditDidParameterButtonClick(item)}
              >
                <View>
                  <Text className="mx-4 mb-2 font-bold text-gray-400 text-lg">
                    {item.description}
                  </Text>
                  <Text className="mx-4 font-bold text-lg">{item.value}</Text>
                </View>
                <View className="mr-4 items-end justify-center">
                  <Icon color="#63C76D" name="edit-2" size={20} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ShadowBox style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
            <ScanAgainButton />
          </ShadowBox>
        </>
      ) : (
        <>
          <View className="flex-1 items-center justify-center">
            <Text className="font-bold text-lg">NO DATA FOUND</Text>
          </View>
          <View className="flex-1 justify-end">
            <View className="mx-4 mt-4 mb-12">
              <ScanAgainButton />
            </View>
          </View>
        </>
      )}

      {/* Edit Parameter Modal */}
      <Modal
        animationType="fade"
        onRequestClose={() => {
          setIsVisible(false);
          setNewValue("");
          setHasOptions(false);
          setSelectedDropdownValue(null);
        }}
        transparent
        visible={isVisible}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50"
          onPress={() => {
            setIsVisible(false);
            setNewValue("");
            setHasOptions(false);
            setSelectedDropdownValue(null);
          }}
        >
          <Pressable
            className="w-[90%] rounded-lg bg-white py-8"
            onPress={(e) => e.stopPropagation()}
          >
            <View>
              <Text className="mx-4 mb-2 font-bold text-black text-xl">
                {editData?.editData?.description}
              </Text>
              <Text className="mx-4 mb-2 font-bold text-base text-gray-500">
                {editData?.editData?.value}
              </Text>

              <View className="flex-row">
                {hasOptions ? (
                  <View className="mx-2 my-2 flex-1 rounded-lg border border-gray-300">
                    <FlatList
                      data={items}
                      keyExtractor={(item) => item.value}
                      renderItem={({ item: dropdownItem }) => (
                        <TouchableOpacity
                          className={`border-gray-200 border-b p-4 ${
                            selectedDropdownValue === dropdownItem.value
                              ? "bg-blue-100"
                              : ""
                          }`}
                          onPress={() => {
                            setSelectedDropdownValue(dropdownItem.value);
                            setNewValue(dropdownItem.value);
                          }}
                        >
                          <Text>{dropdownItem.label}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                ) : (
                  <TextInput
                    className="mx-2 my-2 flex-1 rounded-lg border border-gray-300 px-4 py-2 font-bold text-black"
                    onChangeText={(value) =>
                      setNewValue(
                        inputValidation(editData?.editData?.hint || "", value)
                      )
                    }
                    placeholder="Enter Value"
                    placeholderTextColor="gray"
                    value={newValue}
                  />
                )}
              </View>

              {editData?.editData?.hint?.length !== 0 && !hasOptions ? (
                <View className="mx-2 mt-2">
                  <Text className="font-bold text-base text-black">
                    Input type : {editData?.editData?.hint?.toString()}
                  </Text>
                </View>
              ) : null}

              {Number.isNaN(Number.parseFloat(editData?.editData?.max || "")) ||
              Number.isNaN(
                Number.parseFloat(editData?.editData?.min || "")
              ) ? null : (
                <View className="mx-2 mt-2">
                  <Text className="font-bold text-base text-black">
                    Value Range :{" "}
                    {Number.parseFloat(editData?.editData?.min || "0")} -{" "}
                    {Number.parseFloat(editData?.editData?.max || "0")}
                  </Text>
                </View>
              )}

              <View className="mx-3 mt-4 flex-row justify-center">
                <View className="mr-2 flex-1">
                  <PrimaryButton
                    inactive={newValue.length === 0}
                    onPress={() => {
                      if (!editData?.editData?.description) {
                        toastError("Invalid parameter description");
                        return;
                      }
                      const maxValue = Number.parseFloat(
                        editData?.editData?.max || ""
                      );
                      const minValue = Number.parseFloat(
                        editData?.editData?.min || ""
                      );
                      if (Number.isNaN(maxValue) || Number.isNaN(minValue)) {
                        getWriteParameters(editData.editData.description);
                      } else if (
                        Number.parseFloat(newValue) >= minValue &&
                        Number.parseFloat(newValue) <= maxValue
                      ) {
                        getWriteParameters(editData.editData.description);
                      } else {
                        toastError(
                          `Please enter value between ${minValue} - ${maxValue}`
                        );
                        return;
                      }
                      setSelectedDropdownValue(null);
                    }}
                    text="OKAY"
                  />
                </View>
                <View className="flex-1">
                  <WhiteButton
                    onPress={() => {
                      setIsVisible(false);
                      setNewValue("");
                      setHasOptions(false);
                      setSelectedDropdownValue(null);
                    }}
                    text="CANCEL"
                  />
                </View>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Progress Modal */}
      <Modal
        animationType="fade"
        onRequestClose={onWriteModelOkPress}
        transparent
        visible={showModal}
      >
        <View className="flex-1 items-center justify-center bg-black/50">
          <View className="w-[90%] rounded-lg bg-white py-8">
            <View>
              <Text className="text-center font-bold text-lg">
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
        </View>
      </Modal>

      <OverlayLoading loading={loading} />
    </>
  );
}
