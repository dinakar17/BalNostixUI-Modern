import NetInfo from "@react-native-community/netinfo";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  NativeEventEmitter,
  NativeModules,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import SessionExpiredModal from "@/app/(main)/modals/session-expired";
import { close_1, noBluetooth, warningSmall } from "@/assets/images/index";
import { PrimaryButton } from "@/components/ui/button";
import { PulsatingErrorIcon } from "@/components/ui/error-icon";
import { OverlayLoading } from "@/components/ui/overlay";
import { toastError } from "@/lib/toast";
import { handleJsonParse } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";
import type { UpdateUINotification } from "@/types/update-ui.types";
import DongleShutdownModal from "./modals/dongle-shutdown-success";
import NoBluetoothScreen from "./modals/no-bluetooth";

const { BluetoothModule } = NativeModules;
const eventEmitter = new NativeEventEmitter(BluetoothModule);

type BluetoothStatusData = {
  name: string;
  deviceName?: string;
};

export default function MainIndexRouter() {
  // Auth state
  const {
    userInfo,
    handleLogout,
    dataTransferMode,
    isDataTransferModeSelected,
    dataTransferModeSelection,
  } = useAuthStore();

  // Data transfer mode state
  const {
    isDeviceConnected,
    isDongleToBeDisconnected,
    connectedDeviceName,
    isDongleDisconnectWarning,
    selectedEcu,
    isSessionExpired,
    disconnectFromDevice,
    updateDongleToNotDisconnect,
    updateIsDongleDisconnectWarning,
    updateDongleSerialNo,
    updateIsSessionExpired,
  } = useDataTransferStore();

  // Local state
  const [bluetoothStatus, setBluetoothStatus] = useState(true);
  const [networkIsConnected, setNetworkIsConnected] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [isVisiblePower, setIsVisiblePower] = useState(false);
  const [isfullScreenLoading, setisfullScreenLoading] = useState(false);
  const [dataErrorModalVisible, setIsDataErrorModalVisible] = useState(false);

  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize Bluetooth application
  const initApplication = async () => {
    const res = await BluetoothModule.initApplication();
    console.log(
      `Bluetooth Initialization: ${res ? "SUCCESS" : "FAILED"} | ` +
        `Hardware Support: ${res ? "Available" : "Not Available"} | ` +
        `Bluetooth Enabled: ${res ? "Yes" : "No"} | ` +
        `Device Connected: ${isDeviceConnected}`
    );
    setBluetoothStatus(res);
  };

  // Cancel shutdown timer
  const cancelTimer = () => {
    console.log(`clearTimeout id=${timeoutIdRef.current}`);
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    setisfullScreenLoading(false);
    updateDongleToNotDisconnect();
    setIsVisiblePower(false);
  };

  // Start shutdown timer
  const startTimer = async () => {
    setisfullScreenLoading(true);
    await BluetoothModule.initShutDown();

    timeoutIdRef.current = setTimeout(() => {
      if (isDongleDisconnectWarning) {
        toastError("Failed to disconnect with the dongle");
      }
      console.log(
        `Failed to disconnect with dongle. isDongleDisconnectWarning=${isDongleDisconnectWarning}`
      );
      setisfullScreenLoading(false);
      updateDongleToNotDisconnect();
      setIsVisiblePower(false);
      setIsVisible(true);
    }, 6000);
  };

  // Dongle shutdown confirmation modal
  const DisplayOverlayForDongleShutDown = () => (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        setIsVisiblePower(false);
        updateDongleToNotDisconnect();
      }}
      transparent
      visible={isVisiblePower}
    >
      <View className="flex-1 items-center justify-center bg-black/50">
        <View className="w-[90%] rounded-lg bg-white p-4">
          <View className="items-center">
            <View className="flex-row">
              <Image source={warningSmall} />
            </View>
            <Text className="my-4 font-bold text-2xl">Disconnect Dongle</Text>
            <Text className="text-center text-base text-gray-600">
              To disconnect with dongle click ok and wait till the LED is turned
              Off.
            </Text>
          </View>

          <View className="mt-4 flex-row">
            <View className="mr-2 flex-1">
              <PrimaryButton
                onPress={() => {
                  setIsVisiblePower(false);
                  updateDongleToNotDisconnect();
                }}
                text="Cancel"
              />
            </View>
            <View className="ml-2 flex-1">
              <PrimaryButton
                onPress={() => {
                  startTimer();
                }}
                text="OK"
              />
            </View>
          </View>
          <OverlayLoading loading={isfullScreenLoading} />
        </View>
      </View>
    </Modal>
  );

  // Device disconnection modal
  const DisplayOverlay = () => (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        setIsVisible(false);
        disconnectFromDevice();
        dataTransferModeSelection("null");
        initApplication();
      }}
      transparent
      visible={isVisible}
    >
      <View className="flex-1 items-center justify-center bg-black/50">
        <View className="w-[90%] rounded-lg bg-white p-4">
          <View>
            <TouchableOpacity
              className="pr-2"
              onPress={() => {
                setIsVisible(false);
                disconnectFromDevice();
                dataTransferModeSelection("null");
                initApplication();
              }}
            >
              <Image
                className="absolute top-0 right-0 h-10 w-10"
                source={close_1}
                style={{ resizeMode: "contain" }}
              />
            </TouchableOpacity>
          </View>
          <View className="items-center justify-around pt-12">
            <Image
              className="h-24 w-24 self-center"
              source={noBluetooth}
              style={{ resizeMode: "contain" }}
            />
            <Text className="my-4 px-4 text-center font-bold text-base">
              {connectedDeviceName} device got disconnected. Please make sure to
              turn off and turn on dongle.
            </Text>
            <View className="w-full">
              <PrimaryButton
                onPress={() => {
                  setIsVisible(false);
                  console.log("CLOSE");
                  disconnectFromDevice();
                  dataTransferModeSelection("null");
                  initApplication();
                }}
                text="CLOSE"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Data error modal (BTE1)
  const DisplayOverlayForDataError = () => (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        setIsDataErrorModalVisible(false);
        disconnectFromDevice();
        dataTransferModeSelection("null");
        initApplication();
      }}
      transparent
      visible={dataErrorModalVisible}
    >
      <View className="flex-1 items-center justify-center bg-black/50">
        <View className="w-[90%] rounded-lg bg-white p-4">
          <View>
            <TouchableOpacity
              className="pr-2"
              onPress={() => {
                setIsDataErrorModalVisible(false);
                disconnectFromDevice();
                dataTransferModeSelection("null");
                initApplication();
              }}
            >
              <Image
                className="absolute top-0 right-0 h-10 w-10"
                source={close_1}
                style={{ resizeMode: "contain" }}
              />
            </TouchableOpacity>
          </View>
          <View className="items-center justify-around pt-12">
            <Image
              className="h-24 w-24 self-center"
              source={noBluetooth}
              style={{ resizeMode: "contain" }}
            />
            <Text className="my-2 px-4 text-center font-bold text-base">
              {connectedDeviceName} device got disconnected. Please make sure to
              turn off and turn on dongle.
            </Text>
            <Text className="my-2 px-4 text-center font-bold text-xs">
              Error Message: BTE1
            </Text>
            <View className="w-full">
              <PrimaryButton
                onPress={() => {
                  setIsDataErrorModalVisible(false);
                  disconnectFromDevice();
                  dataTransferModeSelection("null");
                  initApplication();
                }}
                text="CLOSE"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Handle Bluetooth status changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: Complex event handling from original implementation
  const onChangeBluetoothStatus = useCallback(
    (statusData: BluetoothStatusData) => {
      if (statusData.name === "deviceBluetoothStatus") {
        console.log("deviceBluetoothStatus");
        if (!isDeviceConnected || dataTransferMode === "Bluetooth") {
          disconnectFromDevice();
          initApplication();
        }
      }
      if (
        statusData.name === "deviceBluetoothDisconnected" &&
        statusData.deviceName === connectedDeviceName &&
        isDeviceConnected
      ) {
        console.log("deviceBluetoothDisconnected");
        dataTransferModeSelection("null");
        setIsVisible(true);
      }
    },
    [isDeviceConnected, dataTransferMode, connectedDeviceName]
  );

  // Handle USB status changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: Complex event handling from original implementation
  const onChangeUSBStatus = useCallback(
    (statusData: any) => {
      if (statusData.status === "DeviceDetached") {
        console.log(`onChangeUSBStatus ${statusData.status}`);
        dataTransferModeSelection("null");
        disconnectFromDevice();
        if (isDeviceConnected) {
          setIsVisible(true);
        }
      }
    },
    [isDeviceConnected]
  );

  // Handle native module responses
  // biome-ignore lint/correctness/useExhaustiveDependencies: Complex event handling from original implementation
  const onResponse = useCallback(
    (response: { name: string; value: string }) => {
      if (response.name === "updateUI") {
        try {
          console.log("responseUpdateUI", response);
          const jsonData = handleJsonParse(
            response.value
          ) as UpdateUINotification | null;

          if (!jsonData) {
            console.error("Failed to parse updateUI response");
            return;
          }

          // Handle BIOError
          if (
            jsonData.value === "BIOError" &&
            isDeviceConnected &&
            selectedEcu?.isCheckBIOError
          ) {
            setIsDataErrorModalVisible(true);
          }

          // Handle KillBT_OK (dongle shutdown success)
          if (jsonData.value === "KillBT_OK") {
            console.log("console Kill_BTOK");
            cancelTimer();
            updateIsDongleDisconnectWarning();
          }
          // Handle SerialNo response
          else if (jsonData.value.includes("SerialNo")) {
            const indexOfSerial = jsonData.value.indexOf(":");
            const serialNo = jsonData.value.substring(indexOfSerial + 1);
            console.log("Dongle Serial Number:", serialNo);
            updateDongleSerialNo(serialNo);
          }
        } catch (error) {
          console.log("responseUpdateUI error", error);
        }
      }
    },
    [
      isDeviceConnected,
      selectedEcu,
      updateIsDongleDisconnectWarning,
      updateDongleSerialNo,
    ]
  );

  // Handle timeout cancellation when both modals are visible
  // biome-ignore lint/correctness/useExhaustiveDependencies: Complex event handling from original implementation
  useEffect(() => {
    if (isVisible && isVisiblePower) {
      console.log("Both modals visible, canceling timer");
      cancelTimer();
      updateIsDongleDisconnectWarning();
    }
  }, [isVisible, isVisiblePower]);

  // Set up event listeners
  // biome-ignore lint/correctness/useExhaustiveDependencies: Complex event handling from original implementation
  useEffect(() => {
    const bluetoothListener = eventEmitter.addListener(
      "bluetoothAdapterStatus",
      onChangeBluetoothStatus
    );
    const usbListener = eventEmitter.addListener(
      "USBDeviceConnectStatus",
      onChangeUSBStatus
    );
    const updateUiListener = eventEmitter.addListener("updateUI", onResponse);

    return () => {
      bluetoothListener.remove();
      updateUiListener.remove();
      usbListener.remove();
    };
  }, [
    isDeviceConnected,
    onChangeBluetoothStatus,
    onChangeUSBStatus,
    onResponse,
  ]);

  // Set up network listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkIsConnected(state.isConnected ?? false);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Token expiry monitoring
  // biome-ignore lint/correctness/useExhaustiveDependencies: Complex event handling from original implementation
  useEffect(() => {
    const tokenExpiry = userInfo?.tokenExpiryTime;
    const target = new Date(tokenExpiry || "");

    if (!Number.isNaN(target.getTime())) {
      const interval = setInterval(() => {
        const now = new Date();
        const diff = (target.getTime() - now.getTime()) / (60 * 1000); // minutes

        if (diff <= 10) {
          updateIsSessionExpired(true);
          clearInterval(interval);
        }
      }, 1000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [userInfo?.tokenExpiryTime]);

  // Show dongle shutdown modal when needed
  // biome-ignore lint/correctness/useExhaustiveDependencies: Complex event handling from original implementation
  useEffect(() => {
    if (isDongleToBeDisconnected && !isVisiblePower) {
      console.log(
        `DisplayOverlayForDongleShutDown: ${isDongleToBeDisconnected}`
      );
      setIsVisiblePower(true);
    }
  }, [isDongleToBeDisconnected]);

  // Initialize Bluetooth on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: Complex event handling from original implementation
  useEffect(() => {
    initApplication();
  }, []);

  // ROUTING LOGIC - Priority order matters!

  // 1. Dongle disconnect warning (highest priority)
  if (isDongleDisconnectWarning && isDeviceConnected) {
    return <DongleShutdownModal />;
  }

  // 2. No Bluetooth available
  if (!bluetoothStatus) {
    return <NoBluetoothScreen />;
  }

  // 3. Data transfer mode not selected OR not connected (except Bluetooth mode)
  if (
    !isDataTransferModeSelected ||
    (!isDeviceConnected && dataTransferMode !== "Bluetooth")
  ) {
    return (
      <>
        {/* Todo: Change this later to data-transfer-mode/select */}
        <Redirect href="/(main)/data-transfer-mode/select" />
        <DisplayOverlay />
        <SessionExpiredModal isExpired={isSessionExpired} />
        <PulsatingErrorIcon
          isVisible={isSessionExpired}
          onError={handleLogout}
        />
      </>
    );
  }

  // 4. Device connected - show main app
  if (isDeviceConnected) {
    console.log("Device connected - navigation to the Read VIN screen");
    return (
      <>
        <Redirect href="/(main)/vin/read" />
        <DisplayOverlay />
        <DisplayOverlayForDataError />
        <DisplayOverlayForDongleShutDown />
        <SessionExpiredModal isExpired={isSessionExpired} />
        <PulsatingErrorIcon
          isVisible={isSessionExpired}
          onError={handleLogout}
        />
      </>
    );
  }

  // 5. Device not connected and not USB mode - show device selection
  if (!isDeviceConnected && dataTransferMode !== "USB") {
    console.log(`disconnected isDeviceConnected=${isDeviceConnected}`);

    // Check network connectivity first
    if (!networkIsConnected) {
      return <Redirect href="/modals/no-internet" />;
    }

    return (
      <>
        <Redirect href="/(main)/devices/select" />
        <DisplayOverlay />
        <SessionExpiredModal isExpired={isSessionExpired} />
        <PulsatingErrorIcon
          isVisible={isSessionExpired}
          onError={handleLogout}
        />
      </>
    );
  }

  // Fallback - shouldn't reach here, but redirect to mode selection
  return <Redirect href="/(main)/data-transfer-mode/select" />;
}
