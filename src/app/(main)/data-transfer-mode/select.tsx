import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { NativeEventEmitter, NativeModules, View } from "react-native";
import { sapRetryUtils } from "@/api/sap";
import { DongleAuthModal } from "@/components/DongleAuthModal";
import { Button } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { OverlayLoading } from "@/components/ui/overlay";
import { toastError } from "@/lib/toast";
import { handleJsonParse } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { dongleStore, useDataTransferStore } from "@/store/data-transfer-store";
import type { UpdateUINotification } from "@/types/update-ui.types";

// USBModuleType extends NativeModule, so it can be used directly with NativeEventEmitter
const { BluetoothModule, USBModule } = NativeModules;
const eventEmitter = new NativeEventEmitter(BluetoothModule);
const eventEmitterUSB = new NativeEventEmitter(USBModule);

let isFlashingUpdated = false;

export default function SelectDataTransferModeScreen() {
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [isLoadingUSB, setIsLoadingUSB] = useState(false);

  const { dataTransferModeSelection, uploadEeDumpWithEcu } = useAuthStore();
  const {
    isDeviceConnected,
    dongleSerialNo,
    connectToUSBDevice,
    updateDevice,
    disconnectFromDevice,
    updateIsDongleStuckInBoot,
    updateIsGettingDongleDeviceInfo,
    updateDongleSerialNo,
  } = useDataTransferStore();

  // Retry failed SAP requests in background
  const retryFailedSAPRequests = () => {
    sapRetryUtils
      .retryFailedRequests()
      .then((result) => {
        if (result && (result.success > 0 || result.failed > 0)) {
          console.log(
            `[SAP Retry] Success: ${result.success}, Failed: ${result.failed}`
          );
        }
      })
      .catch((error) => {
        console.error("[SAP Retry] Background retry failed:", error);
      });
  };

  const sleep = useCallback(
    (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    []
  );

  const reProgramFlashing = useCallback(async () => {
    try {
      isFlashingUpdated = true;
      let totalTime = 0;

      while (isFlashingUpdated) {
        await sleep(15);
        if (totalTime > 5000) {
          isFlashingUpdated = false;
          toastError("Connection Failed", "Please try again (#1)");
          setOverlayLoading(false);
          updateDongleSerialNo(null);
          updateIsGettingDongleDeviceInfo(false);
        } else {
          totalTime += 10;
        }
      }
    } catch (error) {
      console.error("[DataTransferMode] Flashing error:", error);
    }
  }, [sleep, updateDongleSerialNo, updateIsGettingDongleDeviceInfo]);

  const connectToUSB = useCallback(
    async (dongleName: string) => {
      try {
        setOverlayLoading(true);
        await sleep(2);

        const connectSuccess = await connectToUSBDevice(dongleName);

        if (connectSuccess) {
          reProgramFlashing();
        } else {
          isFlashingUpdated = false;
          setOverlayLoading(false);
        }
      } catch (error) {
        console.error("[DataTransferMode] USB connection failed:", error);
        setOverlayLoading(false);
      }
    },
    [connectToUSBDevice, sleep, reProgramFlashing]
  );

  // Handle Dongle ConfigReset, Dongle_InBoot, SerialNo events
  const onResponse = useCallback(
    (response: { name: string; value: string }) => {
      if (response.name === "updateUI") {
        const jsonData = handleJsonParse(
          response.value
        ) as UpdateUINotification | null;

        if (!jsonData) {
          console.error("[DataTransferMode] Failed to parse updateUI response");
          return;
        }

        if (jsonData.value === "ConfigReset") {
          if (dongleSerialNo !== null) {
            /**
             * Check if dongle was previously authenticated:
             * - dongleStore.getSerialNo() !== null: Wait for SerialNo event, then authenticate
             * - dongleStore.getSerialNo() === null: Skip auth, connect directly
             *
             * This prevents re-authentication of previously connected dongles.
             */
            updateIsGettingDongleDeviceInfo(true);
            if (dongleStore.getSerialNo() !== null) {
              // Check if dongle was previously authenticated (skip auth if it was)
              updateIsGettingDongleDeviceInfo(true);
            }
          } else {
            updateDevice();
          }
          isFlashingUpdated = false;
          setOverlayLoading(false);
          setIsLoadingUSB(false);
          updateIsDongleStuckInBoot(false);
        } else if (jsonData.value === "Dongle_InBoot") {
          console.log("[DataTransferMode] Dongle in boot mode");
          updateDevice();
          updateIsDongleStuckInBoot(true);
          isFlashingUpdated = false;
          setOverlayLoading(false);
          setIsLoadingUSB(false);
        } else if (jsonData.value.includes("SerialNo")) {
          const indexOfSerial = jsonData.value.indexOf(":");
          const serialNo = jsonData.value.substring(indexOfSerial + 1);
          console.log("[DataTransferMode] Dongle serial:", serialNo);
          updateDongleSerialNo(serialNo);
        }
      }
    },
    [
      dongleSerialNo,
      updateIsGettingDongleDeviceInfo,
      updateDevice,
      updateIsDongleStuckInBoot,
      updateDongleSerialNo,
    ]
  );

  const onChangeUSBconnectedStatus = useCallback(
    (statusData: { status: string; name?: string }) => {
      if (statusData.status === "success") {
        console.log("[USB] Connected");
        dataTransferModeSelection("USB");
        connectToUSB(statusData.name || "USB Device");
      } else if (statusData.status === "DeviceDetached") {
        if (isDeviceConnected) {
          console.log("[USB] Detached");
          dataTransferModeSelection("null");
          disconnectFromDevice();
        }
      } else if (statusData.status === "PermissionGranted") {
        console.log("[USB] Permission granted");
        toastError(
          "USB Ready",
          "Reconnect the USB cable to connect to USB Dongle"
        );
      }
    },
    [
      dataTransferModeSelection,
      isDeviceConnected,
      disconnectFromDevice,
      connectToUSB,
    ]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Run only once on mount
  useEffect(() => {
    uploadEeDumpWithEcu();
    retryFailedSAPRequests();
  }, []);

  useEffect(() => {
    const updateUiListener = eventEmitter.addListener("updateUI", onResponse);
    const usbListener = eventEmitterUSB.addListener(
      "USBDeviceConnectStatus",
      onChangeUSBconnectedStatus
    );

    return () => {
      updateUiListener.remove();
      usbListener.remove();
    };
  }, [onResponse, onChangeUSBconnectedStatus]);

  const handleUSBClick = async () => {
    try {
      setIsLoadingUSB(true);
      await BluetoothModule.balDongleLibStop();
      const permissionStatus = await USBModule.getPermissionForUSB();

      console.log("[USB] Permission status:", permissionStatus);

      if (!permissionStatus) {
        toastError("No USB Device", "No USB device connected");
      }

      setIsLoadingUSB(false);
    } catch (error) {
      console.error("[USB] Error:", error);
      setIsLoadingUSB(false);
    }
  };

  const handleBluetoothClick = () => {
    dataTransferModeSelection("Bluetooth");
    router.push("/(main)/devices/select");
  };

  return (
    <View className="flex-1 bg-gray-50">
      <CustomHeader
        renderRightButton
        rightButtonType="menu"
        title="SELECT DATA TRANSFER MODE"
      />

      <View className="flex-1 px-6 py-10">
        <View className="gap-8">
          {/* USB Button */}
          <Button
            disabled={isLoadingUSB}
            isLoading={isLoadingUSB}
            onPress={handleUSBClick}
            size="lg"
            text="Wired USB"
            variant="primary"
          />

          {/* Bluetooth Button */}
          <Button
            onPress={handleBluetoothClick}
            size="lg"
            text="Bluetooth Dongle"
            variant="primary"
          />
        </View>
      </View>

      <OverlayLoading loading={overlayLoading} />
      <DongleAuthModal />
    </View>
  );
}
