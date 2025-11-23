import Icon from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import BleManager from "react-native-ble-manager";
import { CustomHeader } from "@/components/ui/header";
import { OverlayLoading } from "@/components/ui/overlay";
import { toastError, toastSuccess } from "@/lib/toast";

type BluetoothDevice = {
  id: string;
  name: string;
  paired: boolean;
  rssi?: number;
  distance?: number;
};

// Get signal strength details
function getSignalStrength(rssi: number): {
  label: string;
  color: string;
  bars: number;
} {
  if (rssi >= -50) {
    return { label: "Excellent", color: "#22c55e", bars: 5 };
  }
  if (rssi >= -70) {
    return { label: "Good", color: "#84cc16", bars: 4 };
  }
  if (rssi >= -85) {
    return { label: "Fair", color: "#f59e0b", bars: 3 };
  }
  return { label: "Weak", color: "#ef4444", bars: 2 };
}

export default function DeviceDetailsScreen() {
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);

  // Get device ID from route parameter
  const deviceId = params.id as string;

  // Reconstruct device object from params
  const device: BluetoothDevice = {
    id: deviceId,
    name: params.deviceName as string,
    paired: params.devicePaired === "true",
    rssi: params.deviceRssi ? Number(params.deviceRssi) : undefined,
    distance: params.deviceDistance ? Number(params.deviceDistance) : undefined,
  };

  const signal = device.rssi ? getSignalStrength(device.rssi) : null;

  const handleUnpair = () => {
    Alert.alert(
      "Unpair Device",
      `Are you sure you want to unpair "${device.name}"? You will need to pair it again to connect.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Unpair",
          style: "destructive",
          onPress: unpairDevice,
        },
      ]
    );
  };

  const unpairDevice = async () => {
    try {
      setLoading(true);
      console.log("[DeviceDetails] Unpairing device:", device.name, device.id);

      await BleManager.removeBond(device.id);

      console.log("[DeviceDetails] Device unpaired successfully");
      toastSuccess("Unpaired", `${device.name} has been unpaired`);

      setLoading(false);
      // Navigate back to device list
      router.back();
    } catch (error) {
      console.error("[DeviceDetails] Unpairing error:", error);
      setLoading(false);
      toastError("Unpair Failed", "Could not unpair device");
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <CustomHeader
        leftButtonFunction={() => router.back()}
        leftButtonType="back"
        renderLeftButton
        title="DEVICE DETAILS"
      />

      <ScrollView className="flex-1">
        {/* Device Header Card */}
        <View className="m-4 rounded-xl bg-white p-6 shadow-sm">
          <View className="mb-6 items-center">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-[#006AD0]">
              <Icon color="#ffffff" name="bluetooth" size={40} />
            </View>

            <Text className="mb-2 text-center font-bold text-2xl text-gray-900">
              {device.name}
            </Text>

            <View className="rounded-full bg-green-100 px-3 py-1">
              <Text className="font-semibold text-green-700 text-sm">
                PAIRED
              </Text>
            </View>
          </View>

          {/* Device ID */}
          <View className="border-gray-200 border-t pt-4">
            <Text className="mb-1 text-gray-500 text-xs">DEVICE ADDRESS</Text>
            <Text className="font-mono text-gray-900 text-sm">{device.id}</Text>
          </View>
        </View>

        {/* Signal Information Card */}
        {signal && (
          <View className="mx-4 mb-4 rounded-xl bg-white p-6 shadow-sm">
            <Text className="mb-4 font-bold text-gray-900 text-lg">
              Signal Information
            </Text>

            {/* Signal Strength */}
            <View className="mb-4">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-gray-600 text-sm">Signal Strength</Text>
                <View className="flex-row items-center">
                  <Icon color={signal.color} name="radio" size={16} />
                  <Text
                    className="ml-2 font-semibold"
                    style={{ color: signal.color }}
                  >
                    {signal.label}
                  </Text>
                </View>
              </View>

              {/* Signal Bars Visualization */}
              <View className="flex-row space-x-1">
                {[1, 2, 3, 4, 5].map((bar) => (
                  <View
                    className="h-2 flex-1 rounded"
                    key={bar}
                    style={{
                      backgroundColor:
                        bar <= signal.bars ? signal.color : "#e5e7eb",
                    }}
                  />
                ))}
              </View>
            </View>

            {/* RSSI Value */}
            {device.rssi && (
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-gray-600 text-sm">RSSI</Text>
                <Text className="font-semibold text-gray-900">
                  {device.rssi} dBm
                </Text>
              </View>
            )}

            {/* Estimated Distance */}
            {device.distance !== undefined && device.distance > 0 && (
              <View className="flex-row items-center justify-between">
                <Text className="text-gray-600 text-sm">
                  Estimated Distance
                </Text>
                <View className="flex-row items-center">
                  <Icon color="#6b7280" name="navigation" size={16} />
                  <Text className="ml-2 font-semibold text-gray-900">
                    ~{device.distance.toFixed(1)} meters
                  </Text>
                </View>
              </View>
            )}

            <View className="mt-4 rounded-lg bg-blue-50 p-3">
              <Text className="text-blue-800 text-xs">
                <Icon color="#1e40af" name="info" size={12} /> Signal strength
                may vary based on obstacles, interference, and device
                orientation.
              </Text>
            </View>
          </View>
        )}

        {/* Actions Card */}
        <View className="mx-4 mb-4 overflow-hidden rounded-xl bg-white shadow-sm">
          <TouchableOpacity
            className="flex-row items-center justify-between p-4 active:bg-gray-50"
            onPress={() => {
              toastSuccess("Testing Connection", "Attempting to connect...");
            }}
          >
            <View className="flex-row items-center">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Icon color="#006AD0" name="zap" size={20} />
              </View>
              <View>
                <Text className="font-semibold text-gray-900">
                  Test Connection
                </Text>
                <Text className="text-gray-500 text-xs">
                  Verify device connectivity
                </Text>
              </View>
            </View>
            <Icon color="#9ca3af" name="chevron-right" size={20} />
          </TouchableOpacity>

          <View className="border-gray-200 border-t" />

          <TouchableOpacity
            className="flex-row items-center justify-between p-4 active:bg-gray-50"
            onPress={() => {
              toastSuccess("Refreshing", "Updating device information...");
            }}
          >
            <View className="flex-row items-center">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Icon color="#16a34a" name="refresh-cw" size={20} />
              </View>
              <View>
                <Text className="font-semibold text-gray-900">
                  Refresh Info
                </Text>
                <Text className="text-gray-500 text-xs">
                  Update signal and distance
                </Text>
              </View>
            </View>
            <Icon color="#9ca3af" name="chevron-right" size={20} />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View className="mx-4 mb-6 overflow-hidden rounded-xl bg-white shadow-sm">
          <View className="border-red-100 border-b bg-red-50 p-3">
            <Text className="font-semibold text-red-800 text-sm">
              Danger Zone
            </Text>
          </View>

          <TouchableOpacity
            className="flex-row items-center justify-between p-4 active:bg-gray-50"
            onPress={handleUnpair}
          >
            <View className="flex-row items-center">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Icon color="#ef4444" name="trash-2" size={20} />
              </View>
              <View>
                <Text className="font-semibold text-red-600">
                  Unpair Device
                </Text>
                <Text className="text-gray-500 text-xs">
                  Remove this device pairing
                </Text>
              </View>
            </View>
            <Icon color="#9ca3af" name="chevron-right" size={20} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <OverlayLoading loading={loading} />
    </View>
  );
}
