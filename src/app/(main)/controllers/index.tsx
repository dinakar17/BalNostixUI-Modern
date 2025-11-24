import { useFocusEffect } from "@react-navigation/native";
import dayjs from "dayjs";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  BackHandler,
  NativeEventEmitter,
  NativeModules,
  ScrollView,
  View,
} from "react-native";
import { createMMKV } from "react-native-mmkv";
import { cpu } from "@/assets/images";
import type { TileItem } from "@/components/tiles/tile";
import { Tiles } from "@/components/tiles/tiles";
import { CustomHeader } from "@/components/ui/header";
import { OverlayLoading, OverlayView } from "@/components/ui/overlay";
import { toastError } from "@/lib/toast";
import { handleJsonParse } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import type { ControllerData } from "@/store/bluetooth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";
import type { ECURecord } from "@/types";
import type { UpdateUINotification } from "@/types/update-ui.types";

const { BluetoothModule, USBModule } = NativeModules;

const storage = createMMKV();
let isConfigResetInProcess = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ControllersScreen() {
  const [overlayView, setOverlayView] = useState(false);
  const [oacStatus, setOACStatus] = useState(false);
  const [fullScreenLoading, setFullScreenLoading] = useState(false);
  const [selectedEcuIndex, setSelectedEcuIndex] = useState<number | null>(null);
  const [eventEmitter, setEventEmitter] = useState<NativeEventEmitter | null>(
    null
  );

  const { dataTransferMode } = useAuthStore();
  const {
    controllersData,
    isDonglePhase3State,
    vin,
    isDongleStuckInBoot,
    isDongleDeviceInfoSet,
    setSelectedEcu,
    setControllersUpdatedData,
    disconnectFromDevice,
    updateDongleToDisconnected,
    updateIsDongleStuckInBoot,
    updateIsDongleDeviceInfoSet,
  } = useDataTransferStore();

  const [controllersList, setControllersList] = useState<TileItem[]>([]);

  const callResetConfig = async (index: number) => {
    try {
      console.log("[Controllers] Reset config for index:", index);
      const obj = controllersData[index];

      if (
        obj.ecuName.toLowerCase().includes("dongle") &&
        dataTransferMode === "USB" &&
        !isDongleStuckInBoot
      ) {
        BluetoothModule.startSelfFlash(index);
        updateIsDongleDeviceInfoSet(true);
        console.log(
          "[Controllers] Self flash started, isDongleDeviceInfoSet:",
          isDongleDeviceInfoSet
        );
      } else if (!isDongleStuckInBoot) {
        BluetoothModule.resetConfig(index);
      } else if (
        isDongleStuckInBoot &&
        obj.ecuName.toLowerCase().includes("dongle")
      ) {
        readEcuBasicInfo(index);
      }

      isConfigResetInProcess = true;
      let totalTime = 0;

      while (isConfigResetInProcess) {
        await sleep(5);
        if (totalTime > 2000) {
          toastError(
            "Dongle Non Responsive",
            "Please try again after Disconnecting the dongle"
          );
          isConfigResetInProcess = false;
          setFullScreenLoading(false);
        } else {
          totalTime += 10;
        }
      }
    } catch (err) {
      console.error("[Controllers] Reset config error:", err);
    }
  };

  const readEcuBasicInfo = (ecuIndex: number) => {
    BluetoothModule.readEcuBasicnfo(ecuIndex);
  };

  const checkDatacollected = (vinNumber: string, ecu: string): boolean => {
    const jsonDataOACStr = storage.getString("jsonDataOAC");

    if (!jsonDataOACStr) {
      console.log("[OAC] No data, collecting now");
      return true;
    }

    try {
      const jsonResOAC = JSON.parse(jsonDataOACStr);

      if (!jsonResOAC[vinNumber]) {
        console.log("[OAC] VIN undefined, collecting now");
        return true;
      }

      if (!jsonResOAC[vinNumber][ecu]) {
        console.log("[OAC] ECU undefined, collecting now");
        return true;
      }

      if (!jsonResOAC[vinNumber][ecu].oaDate) {
        console.log("[OAC] Date undefined, collecting now");
        return true;
      }

      if (!jsonResOAC[vinNumber][ecu].oaDataStatus) {
        console.log("[OAC] Status undefined, collecting now");
        return true;
      }

      const todayDate = dayjs().format("YYYY-MM-DD");

      if (jsonResOAC[vinNumber][ecu].oaDate !== todayDate) {
        console.log("[OAC] Different date, collecting now");
        return true;
      }

      console.log(
        "[OAC] Same day, status:",
        jsonResOAC[vinNumber][ecu].oaDataStatus
      );
      return (
        jsonResOAC[vinNumber][ecu].oaDate === todayDate &&
        !(jsonResOAC[vinNumber][ecu].oaDataStatus === 1)
      );
    } catch (error) {
      console.error("[OAC] Parse error:", error);
      return true;
    }
  };

  const gotoOfflineAnalysticIfNotCollected = async (
    vinNumber: string,
    indexFrom = 0
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex business logic from original implementation
  ): Promise<boolean> => {
    let statusOac = false;

    if (indexFrom === 0) {
      const jsonDataOACStr = storage.getString("jsonDataOAC");
      console.log("[OAC] Checking for VIN:", vinNumber);

      if (
        !jsonDataOACStr ||
        jsonDataOACStr === "null" ||
        jsonDataOACStr.length < 10
      ) {
        statusOac = true;
      } else {
        try {
          const jsonResOAC = JSON.parse(jsonDataOACStr);
          const todayDate = dayjs().format("YYYY-MM-DD");
          const keys = Object.keys(jsonResOAC);

          for (const key of keys) {
            const ecus = Object.keys(jsonResOAC[key]);
            for (const ecu of ecus) {
              if (jsonResOAC[key][ecu].oaDate === todayDate) {
                statusOac =
                  statusOac || !(jsonResOAC[key][ecu].oaDataStatus === 1);
              } else {
                console.log("[OAC] Deleting old data:", key, ecu);
                delete jsonResOAC[key][ecu];
                statusOac = true;
              }
            }
            if (ecus.length === 0) {
              statusOac = true;
            }
          }

          storage.set("jsonDataOAC", JSON.stringify(jsonResOAC));
        } catch (error) {
          console.error("[OAC] Parse error:", error);
          statusOac = true;
        }
      }
    }

    if (statusOac) {
      for (let index = indexFrom; index < controllersData.length; index++) {
        const obj = controllersData[index];
        if (
          obj.ecuName.toLowerCase().includes("vcu") ||
          obj.ecuName.toLowerCase().includes("bms")
        ) {
          const navStatus = await navigateAndSetup(index, true);
          if (navStatus) {
            statusOac = true;
            console.log("[OAC] ECU Index:", index, "statusOac:", statusOac);
            break;
          }
          statusOac = false;
        } else {
          statusOac = false;
        }
      }

      if (controllersData.length <= indexFrom) {
        statusOac = false;
      }
      setOACStatus(statusOac);
    }

    if (!(oacStatus && statusOac)) {
      // incase user is coming back or no oa needed, bring ecu list
      setFullScreenLoading(false);
    }

    console.log("[OAC] Status:", statusOac);
    return statusOac;
  };

  const navigateAndSetup = async (
    index: number,
    isEcuClickEvent = false
  ): Promise<boolean> => {
    let navCalled = false;

    try {
      console.log("[Controllers] Navigate and setup:", index);
      isConfigResetInProcess = false;
      setFullScreenLoading(true);
      setSelectedEcuIndex(index);

      BluetoothModule.UDSParameter(index);

      const updatedData = await BluetoothModule.getUpdatedEcuRecords(index);

      if (isEcuClickEvent) {
        if (!updatedData.isEEDumpOperation) {
          setOACStatus(false);
          console.log("[Controllers] No OA for:", updatedData.ecuName);
          return navCalled;
        }

        const isDataCollectedNeed = checkDatacollected(
          vin,
          updatedData.ecuName
        );

        if (isDataCollectedNeed || updatedData.isForceEachTimeOA) {
          setOACStatus(updatedData.isEEDumpOperation);
          navCalled = true;
          console.log(
            "[Controllers] Going to collect OA for:",
            updatedData.ecuName
          );
        } else {
          console.log("[Controllers] No OA needed for:", updatedData.ecuName);
          return navCalled;
        }
      }

      const selectedEcuUpdatedData = setControllersUpdatedData(
        controllersData,
        index,
        updatedData as unknown as Partial<ControllerData>
      );

      if (selectedEcuUpdatedData) {
        setSelectedEcu(selectedEcuUpdatedData as unknown as ECURecord);
        console.log(
          "[Controllers] Selected ECU updated:",
          selectedEcuUpdatedData.ecuName
        );
      }

      callResetConfig(index);
    } catch (err) {
      console.error("[Controllers] Navigate error:", err);
    }

    return navCalled;
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex event handling from original implementation
  const onResponse = (response: { name: string; value?: string }) => {
    if (response.name === "updateUI") {
      try {
        if (!response.value) {
          return;
        }
        const jsonData = handleJsonParse<UpdateUINotification>(response.value);

        if (typeof jsonData === "object" && jsonData?.value === "ConfigReset") {
          console.log(
            "[Controllers] Config reset, selectedEcuIndex:",
            selectedEcuIndex
          );
          if (selectedEcuIndex !== null) {
            readEcuBasicInfo(selectedEcuIndex);
          }
          updateIsDongleStuckInBoot(false);
        } else if (
          typeof jsonData === "object" &&
          jsonData?.value === "readEcuBasicnfo"
        ) {
          isConfigResetInProcess = false;
          setFullScreenLoading(false);

          console.log(
            "[Controllers] ECU basic info, OAC:",
            oacStatus,
            "Index:",
            selectedEcuIndex
          );

          if (selectedEcuIndex !== null) {
            if (oacStatus) {
              if (controllersData[selectedEcuIndex].isEEDumpOperation) {
                router.push("/(main)/diagnostics/ecu-dump");
                setOACStatus(false);
              } else {
                gotoOfflineAnalysticIfNotCollected(vin, selectedEcuIndex + 1);
              }
            } else {
              // biome-ignore lint/suspicious/noExplicitAny: Route path type limitation in expo-router
              router.push("/controllers/operations" as any);
            }
          }
        } else if (
          typeof jsonData === "object" &&
          jsonData?.value === "BIOError"
        ) {
          setFullScreenLoading(false);
        } else if (
          typeof jsonData === "object" &&
          jsonData?.value === "Dongle_InBoot"
        ) {
          // biome-ignore lint/suspicious/noExplicitAny: Route path type limitation in expo-router
          router.push("/flashing/controller-flash" as any);
        }
      } catch (error) {
        console.error("[Controllers] Response error:", error);
        setFullScreenLoading(false);
      }
    }
  };

  const onBackPress = () => {
    if (dataTransferMode === "USB") {
      console.log("[Controllers] USB back press");
      USBModule.resetUSBPermission();
    }

    if (isDonglePhase3State) {
      updateDongleToDisconnected();
    } else {
      disconnectFromDevice();
    }
  };

  const handleBackButton = () => {
    setOverlayView(true);
    return true;
  };

  useEffect(() => {
    const emitter =
      dataTransferMode === "USB"
        ? new NativeEventEmitter(USBModule)
        : new NativeEventEmitter(BluetoothModule);

    setEventEmitter(emitter);
  }, [dataTransferMode]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Complex event handling from original implementation
  useEffect(() => {
    if (!eventEmitter) {
      return;
    }

    const tempControllersList = controllersData.map((item) => ({
      id: item.index.toString(),
      name: item.ecuName,
      image: cpu,
      function: () => {
        navigateAndSetup(item.index);
      },
      isActive: true,
    }));

    setControllersList(tempControllersList);

    const updateUiListener = eventEmitter.addListener("updateUI", onResponse);

    return () => {
      updateUiListener.remove();
    };
  }, [controllersData, eventEmitter]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Complex event handling from original implementation
  useEffect(() => {
    gotoOfflineAnalysticIfNotCollected(vin);
  }, []);

  useFocusEffect(
    // biome-ignore lint/correctness/useExhaustiveDependencies: Complex event handling from original implementation
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackButton
      );
      return () => subscription.remove();
    }, [])
  );

  return (
    <View className="flex-1 bg-gray-50">
      <CustomHeader
        leftButtonFunction={handleBackButton}
        leftButtonType="back"
        renderLeftButton={false}
        renderRightButton={isDonglePhase3State}
        rightButtonFunction={updateDongleToDisconnected}
        rightButtonType="settings"
        title="CONTROLLERS"
      />

      <ScrollView className="flex-1">
        <View className="mt-8 mb-8">
          <Tiles data={controllersList} gap={32} overlayText />
        </View>
      </ScrollView>

      {/* Back Confirmation Overlay */}
      <OverlayView
        description="The dongle will be disconnected and the device has to be manually turned off and turned on to connect again"
        primaryButtonOnPress={onBackPress}
        primaryButtonText="Yes"
        title="Are you sure?"
        visible={overlayView}
        whiteButtonOnPress={() => setOverlayView(false)}
        whiteButtonText="Cancel"
      />

      <OverlayLoading loading={fullScreenLoading} />
    </View>
  );
}
