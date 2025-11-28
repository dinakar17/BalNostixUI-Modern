import NetInfo from "@react-native-community/netinfo";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
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
import DongleShutDownSucess from "./modals/dongle-shutdown-success";
import NoBluetoothScreen from "./modals/no-bluetooth";

const { BluetoothModule } = NativeModules;
const eventEmitter = new NativeEventEmitter(BluetoothModule);

type BluetoothStatusData = {
  name: string;
  deviceName?: string;
};

export default function MainLayout() {
  // Auth state
  const {
    userInfo,
    handleLogout,
    dataTransferMode,
    isDataTransferModeSelected,
    dataTransferModeSelection,
  } = useAuthStore();

  // Subscribe to store state
  const isDeviceConnected = useDataTransferStore(
    (state) => state.isDeviceConnected
  );
  const isDongleToBeDisconnected = useDataTransferStore(
    (state) => state.isDongleToBeDisconnected
  );
  const connectedDeviceName = useDataTransferStore(
    (state) => state.connectedDeviceName
  );
  const isDongleDisconnectWarning = useDataTransferStore(
    (state) => state.isDongleDisconnectWarning
  );
  const selectedEcu = useDataTransferStore((state) => state.selectedEcu);
  const isSessionExpired = useDataTransferStore(
    (state) => state.isSessionExpired
  );
  const disconnectFromDevice = useDataTransferStore(
    (state) => state.disconnectFromDevice
  );
  const updateDongleToNotDisconnect = useDataTransferStore(
    (state) => state.updateDongleToNotDisconnect
  );
  const updateIsDongleDisconnectWarning = useDataTransferStore(
    (state) => state.updateIsDongleDisconnectWarning
  );
  const updateDongleSerialNo = useDataTransferStore(
    (state) => state.updateDongleSerialNo
  );
  const updateIsSessionExpired = useDataTransferStore(
    (state) => state.updateIsSessionExpired
  );

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
      `[MainLayout] Bluetooth Initialization: ${res ? "SUCCESS" : "FAILED"} | ` +
        `Hardware Support: ${res ? "Available" : "Not Available"} | ` +
        `Bluetooth Enabled: ${res ? "Yes" : "No"} | ` +
        `Device Connected: ${isDeviceConnected}`
    );
    setBluetoothStatus(res);
  };

  // Cancel shutdown timer
  const cancelTimer = () => {
    console.log(`[MainLayout] clearTimeout id=${timeoutIdRef.current}`);
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
        `[MainLayout] Failed to disconnect with dongle. isDongleDisconnectWarning=${isDongleDisconnectWarning}`
      );
      setisfullScreenLoading(false);
      updateDongleToNotDisconnect();
      setIsVisiblePower(false);
      setIsVisible(true);
    }, 4000);
  };

  // Handle Bluetooth status changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: Complex event handling
  const onChangeBluetoothStatus = useCallback(
    (statusData: BluetoothStatusData) => {
      if (statusData.name === "deviceBluetoothStatus") {
        console.log("[MainLayout] deviceBluetoothStatus");
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
        console.log("[MainLayout] deviceBluetoothDisconnected");
        dataTransferModeSelection("null");
        setIsVisible(true);
      }
    },
    [isDeviceConnected, dataTransferMode, connectedDeviceName]
  );

  // Handle USB status changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: Complex event handling
  const onChangeUSBStatus = useCallback(
    (statusData: any) => {
      if (statusData.status === "DeviceDetached") {
        console.log(`[MainLayout] onChangeUSBStatus ${statusData.status}`);
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: Complex event handling
  const onResponse = useCallback(
    (response: { name: string; value: string }) => {
      if (response.name === "updateUI") {
        try {
          console.log("[MainLayout] responseUpdateUI", response);
          const jsonData = handleJsonParse(
            response.value
          ) as UpdateUINotification | null;

          if (!jsonData) {
            console.error("[MainLayout] Failed to parse updateUI response");
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
            console.log("[MainLayout] Kill_BTOK received");
            cancelTimer();
            updateIsDongleDisconnectWarning();
          }
          // Handle SerialNo response
          else if (
            jsonData.value &&
            typeof jsonData.value === "string" &&
            jsonData.value.includes("SerialNo")
          ) {
            const indexOfSerial = jsonData.value.indexOf(":");
            const serialNo = jsonData.value.substring(indexOfSerial + 1);
            console.log("[MainLayout] Dongle Serial Number:", serialNo);
            updateDongleSerialNo(serialNo);
          }
        } catch (error) {
          console.log("[MainLayout] responseUpdateUI error", error);
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

  // Initialize Bluetooth on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: Initial setup
  useEffect(() => {
    console.log("[MainLayout] Component mounted - initializing Bluetooth");
    initApplication();

    return () => {
      console.log("[MainLayout] Component unmounting");
    };
  }, []);

  // Set up event listeners
  // biome-ignore lint/correctness/useExhaustiveDependencies: Event listeners
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: Token monitoring
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: Modal control
  useEffect(() => {
    if (isDongleToBeDisconnected && !isVisiblePower) {
      console.log(
        `[MainLayout] Showing dongle shutdown modal: ${isDongleToBeDisconnected}`
      );
      setIsVisiblePower(true);
    }
  }, [isDongleToBeDisconnected]);

  // Handle timeout cancellation when both modals are visible
  // biome-ignore lint/correctness/useExhaustiveDependencies: Modal interaction
  useEffect(() => {
    if (isVisible && isVisiblePower) {
      console.log("[MainLayout] Both modals visible, canceling timer");
      cancelTimer();
      updateIsDongleDisconnectWarning();
    }
  }, [isVisible, isVisiblePower]);

  // Handle navigation based on device connection state
  useEffect(() => {
    console.log(
      `[MainLayout] State changed - isDeviceConnected: ${isDeviceConnected}, ` +
        `dataTransferMode: ${dataTransferMode}, ` +
        `isDataTransferModeSelected: ${isDataTransferModeSelected}, ` +
        `bluetoothStatus: ${bluetoothStatus}, ` +
        `networkIsConnected: ${networkIsConnected}`
    );

    // Priority 1: No Bluetooth available
    if (!bluetoothStatus) {
      console.log("[MainLayout] No Bluetooth - showing warning screen");
      return;
    }

    // Priority 2: Dongle disconnect warning
    if (isDongleDisconnectWarning && isDeviceConnected) {
      console.log("[MainLayout] Showing dongle shutdown success modal");
      return;
    }

    // Priority 3: Data transfer mode not selected OR not connected (except Bluetooth mode)
    if (
      !isDataTransferModeSelected ||
      (!isDeviceConnected && dataTransferMode !== "Bluetooth")
    ) {
      console.log("[MainLayout] Redirecting to data transfer mode selection");
      router.replace("/(main)/data-transfer-mode/select");
      return;
    }

    // Priority 4: Device connected - show VIN read screen (with delay for native module init)
    if (isDeviceConnected) {
      console.log(
        "[MainLayout] Device connected - scheduling redirect to VIN read"
      );
      // Small delay to ensure native Bluetooth module is fully initialized
      const timeoutId = setTimeout(() => {
        console.log("[MainLayout] Navigating to VIN read screen");
        router.replace("/(main)/vin/read");
      }, 500);

      return () => clearTimeout(timeoutId);
    }

    // Priority 5: Device not connected and not USB mode - show device selection
    if (!isDeviceConnected && dataTransferMode !== "USB") {
      // Check network connectivity first
      if (!networkIsConnected) {
        console.log("[MainLayout] No internet - showing warning");
        return;
      }

      console.log(
        "[MainLayout] Device not connected - redirecting to device selection"
      );
      router.replace("/(main)/devices/select");
      return;
    }
  }, [
    isDeviceConnected,
    dataTransferMode,
    isDataTransferModeSelected,
    isDongleDisconnectWarning,
    bluetoothStatus,
    networkIsConnected,
  ]);

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
                  console.log("[MainLayout] CLOSE device disconnect modal");
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

  // Render special screens for certain states
  if (isDongleDisconnectWarning && isDeviceConnected) {
    return <DongleShutDownSucess />;
  }

  if (!bluetoothStatus) {
    return <NoBluetoothScreen />;
  }

  return (
    <>
      <StatusBar style="dark" />
      {/* Global modals */}
      <DisplayOverlay />
      <DisplayOverlayForDataError />
      <DisplayOverlayForDongleShutDown />
      <SessionExpiredModal isExpired={isSessionExpired} />
      <PulsatingErrorIcon isVisible={isSessionExpired} onError={handleLogout} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "simple_push",
        }}
      >
        {/* Device setup routes */}
        <Stack.Screen name="devices/select" />

        {/* VIN routes */}
        <Stack.Screen name="vin/scan-barcode" />
        <Stack.Screen name="vin/read" />

        {/* Controller routes */}
        <Stack.Screen name="controllers/index" />
        <Stack.Screen name="controllers/operations" />

        {/* Parameter routes */}
        <Stack.Screen name="parameters/read" />
        <Stack.Screen name="parameters/write" />

        {/* Diagnostic routes */}
        <Stack.Screen name="diagnostics/error-codes" />
        <Stack.Screen name="diagnostics/actuator" />
        <Stack.Screen name="diagnostics/ecu-dump" />

        {/* Flashing routes */}
        <Stack.Screen name="flashing/controller-flash" />
        <Stack.Screen name="flashing/write-bin" />
        <Stack.Screen name="flashing/flash-success" />

        {/* Select Data Transfer */}
        <Stack.Screen name="data-transfer-mode/select" />

        {/* Motor Type routes */}
        <Stack.Screen name="motor-type/write" />
        <Stack.Screen name="motor-type/manual-write" />
      </Stack>
    </>
  );
}
