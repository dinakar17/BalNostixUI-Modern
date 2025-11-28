import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  BackHandler,
  FlatList,
  Image,
  type ImageSourcePropType,
  Modal,
  NativeModules,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  bootLoader,
  edit_note,
  insight,
  routine,
  specialFunction,
  terminal,
  visibility,
  warning,
  warningSmall,
} from "@/assets/images";
import { Tiles } from "@/components/tiles/tiles";
import { PrimaryButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { OverlayLoading, OverlayView } from "@/components/ui/overlay";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";

const { BluetoothModule } = NativeModules;

type TileItem = {
  id: string;
  name: string;
  image: ImageSourcePropType;
  isActive: boolean;
  function: () => void;
};

export default function ControllerOperationsScreen() {
  const { dataTransferMode } = useAuthStore();
  const {
    selectedEcu,
    isDonglePhase3State,
    isDongleDeviceInfoSet,
    updateDongleToDisconnected,
    updateIsDongleDeviceInfoSet,
  } = useDataTransferStore();

  const [loading, setLoading] = useState(true);
  const [isBootUpdate, setBootUpdate] = useState(false);
  const [dongleInfoMessage, setDongleInfoMessage] = useState<{ key: string }[]>(
    []
  );

  // Check if boot update is required
  const isBootUpdateRequired = async () => {
    try {
      const res = await BluetoothModule.isBootUpdateRequired(selectedEcu.index);
      setBootUpdate(res);
      return res;
    } catch (error) {
      console.log("Error checking boot update:", error);
      return false;
    }
  };

  // Set dongle warning message
  const setDongleWarningMessage = async () => {
    try {
      const ver = await BluetoothModule.getDongleAppVersion();
      const res = await BluetoothModule.getDongleVersionInfo();
      console.log(`[Operations] setDongleWarningMessage=${res} ver=${ver}`);

      if (res === true) {
        setDongleInfoMessage([
          { key: `Connected Dongle is Capable of self-flash.${ver}` },
          { key: "To flash other dongle select the old-dongle ECU record." },
          {
            key: "To flash the connected dongle select the new-dongle ECU record.",
          },
        ]);
      } else {
        setDongleInfoMessage([
          { key: `Connected Dongle is Not Capable of self-flash.${ver}` },
          { key: "Connected Dongle can be used to flash other dongles." },
        ]);
      }
    } catch (error) {
      console.log("Error setting dongle warning message:", error);
    }
  };

  // Operations list
  const list: TileItem[] = [
    {
      id: "error-codes",
      name: "ERROR CODES",
      image: warning,
      isActive: selectedEcu.isErrorCodeEnabled,
      function: () => {
        router.push({
          pathname: "/(main)/diagnostics/error-codes",
          params: { ecuIndex: selectedEcu.index },
        });
      },
    },
    {
      id: "read-parameters",
      name: "READ \nPARAMETERS",
      image: visibility,
      isActive: selectedEcu.isReadParameterEnabled,
      function: () => {
        router.push({
          pathname: "/(main)/parameters/read",
          params: { ecuIndex: selectedEcu.index },
        });
      },
    },
    {
      id: "write-parameters",
      name: "WRITE \nPARAMETERS",
      isActive: selectedEcu.isWriteParameterEnabled,
      image: edit_note,
      function: () => {
        router.push({
          pathname: "/(main)/parameters/write",
          params: { ecuIndex: selectedEcu.index },
        });
      },
    },
    {
      id: "re-program",
      name: "RE-PROGRAM",
      isActive:
        selectedEcu.isReprogramEnabled ||
        (selectedEcu.isUSBPrograming && dataTransferMode === "USB"),
      image: terminal,
      function: () => {
        router.push({
          pathname: "/(main)/flashing/controller-flash",
          params: { screenName: selectedEcu.ecuName },
        });
      },
    },
    {
      id: "update-boot",
      name: "UPDATE BOOT",
      image: bootLoader,
      isActive:
        selectedEcu.isUpdateBootEnabled ||
        (selectedEcu.isUSBPrograming &&
          dataTransferMode === "USB" &&
          (selectedEcu.ecuName.toLowerCase().includes("vcu") ||
            selectedEcu.ecuName.toLowerCase().includes("mcu"))),
      function: () => {
        router.push("/(main)/devices/update-boot");
      },
    },
    {
      id: "special-functions",
      name: "SPECIAL FUNCTIONS",
      image: specialFunction,
      isActive:
        selectedEcu?.ecuName?.toLowerCase()?.indexOf("vcu") > -1 ||
        selectedEcu.isSpecialFunctionEnabled,
      function: () => {
        router.push({
          pathname: "/(main)/special-functions",
          params: { screenName: selectedEcu.ecuName },
        });
      },
    },
    {
      id: "actuator-routines",
      name: "ACTUATOR ROUTINES",
      isActive: selectedEcu?.isActuatorEnabled,
      image: routine,
      function: () => {
        router.push({
          pathname: "/(main)/diagnostics/actuator",
          params: { screenName: selectedEcu.ecuName },
        });
      },
    },
    {
      id: "analytics",
      name: "ANALYTICS",
      isActive: selectedEcu.isAnalyticsEnabled,
      function: () => {
        router.push({
          pathname: "/(main)/diagnostics/analytics",
          params: { screenName: selectedEcu.ecuName },
        });
      },
      image: insight,
    },
    {
      id: "security-update",
      name: "SECURITY \nUPDATE",
      isActive: selectedEcu.isProgConstWriteEnabled,
      image: warning,
      function: () => {
        router.push({
          pathname: "/(main)/controllers/write-prog-const",
          params: { ecuIndex: selectedEcu.index },
        });
      },
    },
  ];

  // Save logs on back press
  function saveLogs() {
    BluetoothModule.saveAppLog(selectedEcu.index);
    return false;
  }

  useFocusEffect(
    // biome-ignore lint/correctness/useExhaustiveDependencies: saveLogs function is stable
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        saveLogs
      );
      return () => subscription.remove();
    }, [])
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Initialization effect should only run once
  useEffect(() => {
    setDongleWarningMessage();
    if (
      selectedEcu.isUpdateBootEnabled ||
      (selectedEcu.isUSBPrograming &&
        dataTransferMode === "USB" &&
        (selectedEcu.ecuName.toLowerCase().includes("vcu") ||
          selectedEcu.ecuName.toLowerCase().includes("mcu")))
    ) {
      isBootUpdateRequired();
    }
    setLoading(false);
  }, []);

  // Dongle version warning overlay
  const DisplayWarningForDongleVersion = () => (
    <Modal
      animationType="fade"
      onRequestClose={() => updateIsDongleDeviceInfoSet(false)}
      transparent
      visible={isDongleDeviceInfoSet}
    >
      <View className="flex-1 items-center justify-center bg-black/50">
        <View className="w-[90%] rounded-lg bg-white p-4">
          <View className="items-center">
            <View className="mb-4 flex-row">
              <Image source={warningSmall} />
            </View>
            <Text className="mb-4 font-bold text-2xl">
              Remember For Dongle Flashing
            </Text>
            <FlatList
              className="mb-4"
              data={dongleInfoMessage}
              keyExtractor={(_, index) => index.toString()}
              renderItem={({ item }) => (
                <View className="mb-2">
                  <Text className="text-lg">{`\u2022 ${item.key}`}</Text>
                </View>
              )}
            />
          </View>

          <View className="mt-3 flex-row">
            <PrimaryButton
              onPress={() => {
                updateIsDongleDeviceInfoSet(false);
              }}
              text="OK"
            />
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <CustomHeader
        leftButtonFunction={() => {
          saveLogs();
          router.push("/(main)/controllers");
        }}
        leftButtonType="back"
        renderLeftButton={true}
        renderRightButton={isDonglePhase3State}
        rightButtonFunction={updateDongleToDisconnected}
        rightButtonType="settings"
        title="Operations"
      />

      <ScrollView>
        <View className="mb-10">
          <Text className="my-4 text-center font-bold text-xl">
            {selectedEcu.ecuName}
          </Text>

          <Tiles data={list} gap={32} height width />
        </View>
      </ScrollView>

      {/* Boot Update Warning */}
      {isBootUpdate && (
        <Modal animationType="fade" transparent visible>
          <View className="flex-1 items-center justify-center bg-black/50">
            <OverlayView
              description="Bootloader Update is pending on this vehicle"
              primaryButtonOnPress={() => {
                setBootUpdate(false);
                router.push("/(main)/devices/update-boot");
              }}
              primaryButtonText="OKAY"
              secondDescription="Do you want to update the bootloader now?"
              title="NOTE"
              whiteButtonOnPress={() => {
                setBootUpdate(false);
              }}
              whiteButtonText="CANCEL"
            />
          </View>
        </Modal>
      )}

      <OverlayLoading loading={loading} />
      <DisplayWarningForDongleVersion />
    </>
  );
}
