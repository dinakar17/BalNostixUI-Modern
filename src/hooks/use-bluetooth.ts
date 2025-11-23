import { useEffect } from "react";
import { NativeEventEmitter, NativeModules } from "react-native";
import { toastError } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";

const { BluetoothModule } = NativeModules;
const eventEmitter = new NativeEventEmitter(BluetoothModule);

/**
 * Hook to monitor Bluetooth adapter status and device connections
 * Handles automatic disconnection on Bluetooth state changes
 */
export function useBluetooth() {
  const { isDeviceConnected, connectedDeviceName, disconnectFromDevice } =
    useDataTransferStore();
  const dataTransferMode = useAuthStore((state) => state.dataTransferMode);

  useEffect(() => {
    const onBluetoothStatusChange = (statusData: {
      name: string;
      deviceName?: string;
    }) => {
      // Bluetooth adapter turned off
      if (statusData.name === "deviceBluetoothStatus") {
        console.log("[useBluetooth] Bluetooth adapter status changed");

        if (!isDeviceConnected || dataTransferMode === "Bluetooth") {
          disconnectFromDevice();
        }
      }

      // Device disconnected
      if (
        statusData.name === "deviceBluetoothDisconnected" &&
        statusData.deviceName === connectedDeviceName &&
        isDeviceConnected
      ) {
        console.log("[useBluetooth] Device disconnected:", connectedDeviceName);
        disconnectFromDevice();
        toastError(
          "Device Disconnected",
          `${connectedDeviceName} was disconnected`
        );
      }
    };

    const listener = eventEmitter.addListener(
      "bluetoothAdapterStatus",
      onBluetoothStatusChange
    );

    return () => {
      listener.remove();
    };
  }, [
    isDeviceConnected,
    connectedDeviceName,
    dataTransferMode,
    disconnectFromDevice,
  ]);

  return {
    isDeviceConnected,
    connectedDeviceName,
  };
}

/**
 * Hook to enable/check Bluetooth programmatically
 */
export function useBluetoothEnable() {
  const enableBluetooth = async (): Promise<void> => {
    try {
      await BluetoothModule.enableBluetooth();
    } catch (error) {
      console.error("[useBluetoothEnable] Error enabling Bluetooth:", error);
      throw error;
    }
  };

  return { enableBluetooth };
}
