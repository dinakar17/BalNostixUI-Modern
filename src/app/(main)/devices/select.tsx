import Icon from "@expo/vector-icons/Feather";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  AppState,
  BackHandler,
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import BleManager from "react-native-ble-manager";
import { DongleAuthModal } from "@/components/DongleAuthModal";
import { PrimaryButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { OverlayLoading } from "@/components/ui/overlay";
import { toastError, toastSuccess } from "@/lib/toast";
import { handleJsonParse } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { dongleStore, useDataTransferStore } from "@/store/data-transfer-store";

const { BluetoothModule } = NativeModules;
const eventEmitter = new NativeEventEmitter(BluetoothModule);
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

let isFlashingUpdated = false;

type BluetoothDevice = {
  id: string;
  name: string;
  paired: boolean;
  rssi?: number;
  distance?: number;
};

type Peripheral = {
  id: string;
  name?: string;
  rssi?: number;
  advertising?: unknown;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Calculate distance from RSSI (in meters)
function calculateDistance(rssi: number, txPower = -69): number {
  if (rssi === 0) {
    return -1;
  }
  const ratio = rssi / txPower;
  if (ratio < 1.0) {
    return ratio ** 10;
  }
  return 0.899_76 * ratio ** 7.7095 + 0.111;
}

// Get signal strength label
function getSignalStrength(rssi: number): { label: string; color: string } {
  if (rssi >= -50) {
    return { label: "Excellent", color: "#22c55e" };
  }
  if (rssi >= -70) {
    return { label: "Good", color: "#84cc16" };
  }
  if (rssi >= -85) {
    return { label: "Fair", color: "#f59e0b" };
  }
  return { label: "Weak", color: "#ef4444" };
}

export default function SelectDeviceScreen() {
  const [pairedDevices, setPairedDevices] = useState<BluetoothDevice[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDevice[]>(
    []
  );
  const [refreshing, setRefreshing] = useState(false);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showDiscoveredDevices, setShowDiscoveredDevices] = useState(false);

  const { updateDataTransferSelectionState } = useAuthStore();
  const {
    connectToDevice,
    updateIsGettingDongleDeviceInfo,
    updateDongleSerialNo,
  } = useDataTransferStore();

  // Request Bluetooth permissions (Android)
  const requestBluetoothPermissions = useCallback(async () => {
    if (Platform.OS === "android") {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return (
          granted["android.permission.BLUETOOTH_SCAN"] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted["android.permission.BLUETOOTH_CONNECT"] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted["android.permission.ACCESS_FINE_LOCATION"] ===
            PermissionsAndroid.RESULTS.GRANTED
        );
      }
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }, []);

  // Sort devices by signal strength (higher RSSI = closer = first)
  const sortDevicesBySignal = useCallback(
    (devices: BluetoothDevice[]) =>
      [...devices].sort((a, b) => (b.rssi || -100) - (a.rssi || -100)),
    []
  );

  // Get bonded devices with RSSI
  const getBondedDevices = useCallback(async () => {
    try {
      setOverlayLoading(true);

      console.log("[SelectDevice] Getting bonded devices...");

      const bondedPeripherals: Peripheral[] =
        await BleManager.getBondedPeripherals();

      const devices: BluetoothDevice[] = bondedPeripherals
        .filter((device) => device.name?.toLowerCase().includes("bal"))
        .map((device) => ({
          id: device.id,
          name: device.name || "Unknown Device",
          paired: true,
          rssi: device.rssi,
          distance: device.rssi ? calculateDistance(device.rssi) : undefined,
        }));

      console.log("[SelectDevice] Found bonded devices:", devices.length);

      setPairedDevices(devices);

      // Start scanning immediately to get RSSI values
      if (devices.length > 0) {
        console.log("[SelectDevice] Starting background scan for RSSI...");

        BleManager.scan({
          serviceUUIDs: [],
          seconds: 5,
          allowDuplicates: true,
        });
      }

      // Hide overlay after devices are shown (but continue scanning in background)
      await sleep(400);
      setOverlayLoading(false);
    } catch (error) {
      console.error("[SelectDevice] Error getting bonded devices:", error);
      setOverlayLoading(false);
      toastError("Failed to get paired devices");
    }
  }, []);

  // Scan for new devices with RSSI
  const scanForNewDevices = useCallback(async () => {
    try {
      const hasPermission = await requestBluetoothPermissions();
      if (!hasPermission) {
        toastError("Bluetooth permissions are required");
        return;
      }

      setIsScanning(true);
      setShowDiscoveredDevices(true);
      setDiscoveredDevices([]);

      console.log("[SelectDevice] Starting BLE scan...");

      BleManager.scan({
        serviceUUIDs: [],
        seconds: 10,
        allowDuplicates: true,
      });

      setTimeout(async () => {
        try {
          const peripherals: Peripheral[] =
            await BleManager.getDiscoveredPeripherals();

          const pairedIds = new Set(pairedDevices.map((d) => d.id));

          const devices: BluetoothDevice[] = peripherals
            .filter((device) => !pairedIds.has(device.id))
            .filter((device) => device.name?.toLowerCase().includes("bal"))
            .map((device) => ({
              id: device.id,
              name: device.name || "Unknown Device",
              paired: false,
              rssi: device.rssi,
              distance: device.rssi
                ? calculateDistance(device.rssi)
                : undefined,
            }));

          console.log(
            "[SelectDevice] Discovered new BAL devices:",
            devices.length
          );

          const sorted = sortDevicesBySignal(devices);
          setDiscoveredDevices(sorted);
          setIsScanning(false);

          if (devices.length === 0) {
            // toastInfo("No new unpaired devices were discovered");
          }
        } catch (error) {
          console.error(
            "[SelectDevice] Error getting discovered devices:",
            error
          );
          setIsScanning(false);
        }
      }, 10_000);
    } catch (error) {
      console.error("[SelectDevice] Scan error:", error);
      setIsScanning(false);
      toastError("Failed to start scanning");
    }
  }, [pairedDevices, sortDevicesBySignal, requestBluetoothPermissions]);

  // Handle real-time peripheral discovery with RSSI updates
  const handleDiscoverPeripheral = (peripheral: Peripheral) => {
    if (!peripheral.name?.toLowerCase().includes("bal")) {
      return;
    }

    if (peripheral.name) {
      const pairedIds = new Set(pairedDevices.map((d) => d.id));

      // Update RSSI for paired devices in real-time
      if (pairedIds.has(peripheral.id)) {
        setPairedDevices((prev) => {
          const updated = prev.map((device) => {
            if (device.id === peripheral.id && peripheral.rssi) {
              return {
                ...device,
                rssi: peripheral.rssi,
                distance: calculateDistance(peripheral.rssi),
              };
            }
            return device;
          });
          return sortDevicesBySignal(updated);
        });
      } else {
        // Handle discovered (unpaired) devices
        console.log(
          "[SelectDevice] Discovered/Updated:",
          peripheral.name,
          "RSSI:",
          peripheral.rssi
        );

        setDiscoveredDevices((prev) => {
          const filtered = prev.filter((d) => d.id !== peripheral.id);
          const updated: BluetoothDevice = {
            id: peripheral.id,
            name: peripheral.name || "Unknown Device",
            paired: false,
            rssi: peripheral.rssi,
            distance: peripheral.rssi
              ? calculateDistance(peripheral.rssi)
              : undefined,
          };
          return sortDevicesBySignal([...filtered, updated]);
        });
      }
    }
  };

  const handleStopScan = () => {
    console.log("[SelectDevice] Scan stopped");
    setIsScanning(false);
  };

  // Pair device with 20-second timeout
  const pairDevice = async (deviceId: string, deviceName: string) => {
    try {
      setOverlayLoading(true);
      console.log("[SelectDevice] Pairing device:", deviceName, deviceId);

      // Create a promise that rejects after 20 seconds
      const pairingPromise = BleManager.createBond(deviceId);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Pairing timeout")), 20_000)
      );

      await Promise.race([pairingPromise, timeoutPromise]);

      console.log("[SelectDevice] Device paired successfully");
      toastSuccess(`${deviceName} is now paired`);

      setDiscoveredDevices((prev) => prev.filter((d) => d.id !== deviceId));
      await getBondedDevices();

      setShowDiscoveredDevices(false);
      setOverlayLoading(false);
    } catch (error: unknown) {
      console.error("[SelectDevice] Pairing error:", error);
      setOverlayLoading(false);

      if (error instanceof Error && error.message === "Pairing timeout") {
        toastError("Device took too long to pair. Please try again.");
      } else {
        toastError("Could not pair device");
      }
    }
  };

  // Navigate to device details
  const navigateToDeviceDetails = (device: BluetoothDevice) => {
    router.push({
      pathname: "/devices/[id]",
      params: {
        id: device.id,
        deviceName: device.name,
        devicePaired: device.paired.toString(),
        deviceRssi: device.rssi?.toString() || "",
        deviceDistance: device.distance?.toString() || "",
      },
    });
  };

  const reProgramFlashing = async () => {
    try {
      isFlashingUpdated = true;
      let totalTime = 0;

      while (isFlashingUpdated) {
        await sleep(15);
        if (totalTime > 5000) {
          isFlashingUpdated = false;
          toastError("Connection Failed - Please try again (#5)");
          updateDongleSerialNo(null);
          updateIsGettingDongleDeviceInfo(false);
          setOverlayLoading(false);
        } else {
          totalTime += 10;
        }
      }
    } catch (error) {
      console.error("[SelectDevice] Flashing error:", error);
    }
  };

  // Connect to vehicle
  const connect = async (address: string, name: string) => {
    try {
      setOverlayLoading(true);
      updateDongleSerialNo(name);
      await sleep(2);

      console.log("[SelectDevice] Connecting to vehicle...");

      const connectSuccess = await connectToDevice(address, name);

      if (connectSuccess) {
        console.log("[SelectDevice] Vehicle connection successful");
        reProgramFlashing();
      } else {
        isFlashingUpdated = false;
        toastError("Vehicle Connection Failed - Please try again (#6)");
        updateDongleSerialNo(null);
        updateIsGettingDongleDeviceInfo(false);
        setOverlayLoading(false);
      }
    } catch (error) {
      console.error("[SelectDevice] Vehicle connection error:", error);
      toastError("Vehicle Connection Failed", "Please try again (#7)");
      updateDongleSerialNo(null);
      updateIsGettingDongleDeviceInfo(false);
      setOverlayLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (showDiscoveredDevices) {
      await scanForNewDevices();
    } else {
      await getBondedDevices();
    }
    await sleep(1000);
    setRefreshing(false);
  }, [showDiscoveredDevices, scanForNewDevices, getBondedDevices]);

  const onResponse = (response: { name: string; value: string }) => {
    if (response.name === "updateUI") {
      const jsonData = handleJsonParse<{ value?: string }>(response.value);
      if (
        typeof jsonData === "object" &&
        jsonData !== null &&
        jsonData?.value === "ConfigReset"
      ) {
        if (dongleStore.getSerialNo() !== null) {
          updateIsGettingDongleDeviceInfo(true);
        }
        isFlashingUpdated = false;
        setOverlayLoading(false);
      }
    }
  };

  const handleAppState = (nextAppState: string) => {
    console.log("[SelectDevice] App state:", nextAppState);
    if (nextAppState === "active" && !showDiscoveredDevices) {
      getBondedDevices();
    }
  };

  const handleBackButton = useCallback(() => {
    if (isScanning) {
      BleManager.stopScan();
      setIsScanning(false);
    }
    updateDataTransferSelectionState();
    return true;
  }, [isScanning, updateDataTransferSelectionState]);

  const navigateToAddDevice = async () => {
    await scanForNewDevices();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies : Initial setup
  useEffect(() => {
    console.log("[SelectDevice] Initializing...");

    BleManager.start({ showAlert: false })
      .then(() => {
        console.log("[SelectDevice] BLE Manager initialized");
        getBondedDevices();
      })
      .catch((error) => console.error("[SelectDevice] Init error:", error));

    const appStateListener = AppState.addEventListener(
      "change",
      handleAppState
    );
    const updateUiListener = eventEmitter.addListener("updateUI", onResponse);
    const discoverListener = bleManagerEmitter.addListener(
      "BleManagerDiscoverPeripheral",
      handleDiscoverPeripheral
    );
    const stopScanListener = bleManagerEmitter.addListener(
      "BleManagerStopScan",
      handleStopScan
    );

    return () => {
      console.log("[SelectDevice] Cleanup");
      appStateListener.remove();
      updateUiListener.remove();
      discoverListener.remove();
      stopScanListener.remove();
      if (isScanning) {
        BleManager.stopScan();
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackButton
      );
      return () => subscription.remove();
    }, [handleBackButton])
  );

  const displayedDevices = showDiscoveredDevices
    ? discoveredDevices
    : pairedDevices;

  return (
    <View className="flex-1 bg-gray-50">
      <CustomHeader
        leftButtonFunction={handleBackButton}
        leftButtonType="back"
        renderLeftButton
        renderRightButton
        rightButtonType="menu"
        title="SELECT DEVICE"
      />

      {/* Tabs */}
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row">
          <TouchableOpacity
            className={`mr-2 flex-1 rounded-lg py-2 ${showDiscoveredDevices ? "bg-gray-200" : "bg-[#006AD0]"}`}
            onPress={() => {
              if (isScanning) {
                BleManager.stopScan();
                setIsScanning(false);
              }
              setShowDiscoveredDevices(false);
              if (pairedDevices.length === 0) {
                getBondedDevices();
              }
            }}
          >
            <Text
              className={`text-center font-semibold ${showDiscoveredDevices ? "text-gray-700" : "text-white"}`}
            >
              Paired ({pairedDevices.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 rounded-lg py-2 ${showDiscoveredDevices ? "bg-[#006AD0]" : "bg-gray-200"}`}
            disabled={isScanning}
            onPress={() => {
              setShowDiscoveredDevices(true);
              if (!isScanning) {
                scanForNewDevices();
              }
            }}
          >
            <Text
              className={`text-center font-semibold ${showDiscoveredDevices ? "text-white" : "text-gray-700"}`}
            >
              {isScanning
                ? "Scanning..."
                : `Discover (${discoveredDevices.length})`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl onRefresh={onRefresh} refreshing={refreshing} />
        }
      >
        {isScanning && (
          <View className="items-center py-8">
            <Icon color="#006AD0" name="bluetooth" size={48} />
            <Text className="mt-4 font-semibold text-[#006AD0] text-base">
              Scanning for devices...
            </Text>
            <Text className="mt-2 text-gray-500 text-sm">
              Signal strength updates in real-time
            </Text>
          </View>
        )}

        {displayedDevices.length === 0 && !isScanning ? (
          <View className="items-center justify-center px-8 pt-24">
            <TouchableOpacity
              className="mb-16 h-32 w-32 items-center justify-center rounded-full bg-[#006AD0]"
              onPress={navigateToAddDevice}
            >
              <Icon color="#ffffff" name="plus" size={60} />
            </TouchableOpacity>

            <Text className="mb-4 font-bold text-gray-800 text-lg">
              {showDiscoveredDevices ? "NO NEW DEVICES" : "NO PAIRED DEVICES"}
            </Text>

            <Text className="text-center text-base text-gray-600 leading-6">
              {showDiscoveredDevices
                ? "Tap + to scan for nearby BAL devices"
                : "No paired devices. Switch to 'Discover' to find devices."}
            </Text>
          </View>
        ) : (
          <View className="px-4 pt-4">
            {displayedDevices.map((item) => {
              const signal = item.rssi ? getSignalStrength(item.rssi) : null;

              return (
                <View className="bg-white" key={item.id}>
                  <TouchableOpacity
                    className="p-4 active:opacity-70"
                    onPress={() =>
                      item.paired
                        ? connect(item.id, item.name)
                        : pairDevice(item.id, item.name)
                    }
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 flex-row items-start">
                        <Icon
                          color="#000000"
                          name="bluetooth"
                          size={28}
                          style={{ marginRight: 12, marginTop: 2 }}
                        />

                        <View className="flex-1 pr-3">
                          <Text className="mb-1 font-bold text-gray-900 text-lg">
                            {item.name}
                          </Text>
                          <Text className="mb-2 text-gray-500 text-xs">
                            {item.id}
                          </Text>

                          {/* Signal Strength & Distance */}
                          {signal && (
                            <View className="mb-2 flex-row items-center">
                              <View className="mr-3 flex-row items-center">
                                <Icon
                                  color={signal.color}
                                  name="radio"
                                  size={14}
                                />
                                <Text
                                  className="ml-1 text-xs"
                                  style={{ color: signal.color }}
                                >
                                  {signal.label}
                                </Text>
                                {item.rssi && (
                                  <Text className="ml-1 text-gray-500 text-xs">
                                    ({item.rssi} dBm)
                                  </Text>
                                )}
                              </View>
                              {item.distance !== undefined &&
                                item.distance > 0 && (
                                  <View className="flex-row items-center">
                                    <Icon
                                      color="#6b7280"
                                      name="navigation"
                                      size={14}
                                    />
                                    <Text className="ml-1 text-gray-500 text-xs">
                                      ~{item.distance.toFixed(1)}m
                                    </Text>
                                  </View>
                                )}
                            </View>
                          )}

                          {!item.paired && (
                            <Text className="font-semibold text-orange-600 text-xs">
                              TAP TO PAIR
                            </Text>
                          )}
                        </View>
                      </View>

                      <View className="items-center">
                        {!item.paired && (
                          <View className="rounded-full bg-orange-100 px-2 py-1">
                            <Text className="font-bold text-orange-600 text-xs">
                              NEW
                            </Text>
                          </View>
                        )}
                        {item.paired && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              navigateToDeviceDetails(item);
                            }}
                          >
                            <Icon color="#006AD0" name="info" size={24} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View className="px-6 pt-2 pb-6">
        <PrimaryButton
          disabled={isScanning}
          onPress={navigateToAddDevice}
          text={isScanning ? "SCANNING..." : "SCAN FOR NEW DEVICES"}
        />
      </View>

      <OverlayLoading loading={overlayLoading} />
      <DongleAuthModal />
    </View>
  );
}
