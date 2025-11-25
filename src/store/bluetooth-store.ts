import { NativeModules } from "react-native";
import { create } from "zustand";
import { BASEURL } from "@/api/fms";
import type { ECURecordExtended } from "@/types/bluetooth.types";

const { BluetoothModule } = NativeModules;

/**
 * @deprecated Use ECURecordExtended from @/types/bluetooth.types instead
 * This type is kept for backwards compatibility but will be removed in future versions
 */
export type ControllerData = ECURecordExtended;

type BluetoothState = {
  // State
  isBluetoothConnected: boolean;
  connectedDeviceName: string | null;
  selectedEcu: ECURecordExtended | null;
  controllersData: ECURecordExtended[];

  // Actions
  connectToDevice: (address: string, name: string) => Promise<boolean>;
  disconnectFromDevice: () => void;
  updateBluetooth: () => void;
  setControllersData: (data: ECURecordExtended[]) => void;
  setSelectedEcu: (ecu: ECURecordExtended | null) => void;
  setControllersUpdatedData: (
    controllersData: ECURecordExtended[],
    index: number,
    updatedData: Partial<ECURecordExtended>
  ) => ECURecordExtended | null;
  setIsUpdateAvailableToFalse: (
    controllersData: ECURecordExtended[],
    index: number
  ) => ECURecordExtended | null;
};

export const useBluetoothStore = create<BluetoothState>()((set) => ({
  // Initial State
  isBluetoothConnected: false,
  connectedDeviceName: null,
  selectedEcu: null,
  controllersData: [],

  // Connect to Bluetooth device
  connectToDevice: async (address: string, name: string) => {
    try {
      const isInitSuccess = await BluetoothModule.initBalDongle(
        address,
        BASEURL
      );

      if (isInitSuccess) {
        set({
          connectedDeviceName: name,
          isBluetoothConnected: true,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("connectToDevice error:", error);
      return false;
    }
  },

  // Disconnect from device
  disconnectFromDevice: () => {
    set({
      isBluetoothConnected: false,
      connectedDeviceName: null,
    });
  },

  // Update Bluetooth connection status
  updateBluetooth: () => {
    set({ isBluetoothConnected: true });
  },

  // Set controllers data
  setControllersData: (data: ECURecordExtended[]) => {
    set({ controllersData: data });
  },

  // Set selected ECU
  setSelectedEcu: (ecu: ECURecordExtended | null) => {
    set({ selectedEcu: ecu });
  },

  // Update specific controller data
  setControllersUpdatedData: (
    controllersData: ECURecordExtended[],
    index: number,
    updatedData: Partial<ECURecordExtended>
  ) => {
    const elementIndex = controllersData.findIndex((o) => o.index === index);

    if (elementIndex === -1) {
      return null;
    }

    const element = controllersData[elementIndex];
    const selectedEcuUpdatedData: ECURecordExtended = {
      ...element,
      ...updatedData,
    };

    const tempData = [...controllersData];
    tempData.splice(elementIndex, 1, selectedEcuUpdatedData);

    set({ controllersData: tempData });
    return selectedEcuUpdatedData;
  },

  // Set update available to false for specific controller
  setIsUpdateAvailableToFalse: (
    controllersData: ECURecordExtended[],
    index: number
  ) => {
    const elementIndex = controllersData.findIndex((o) => o.index === index);

    if (elementIndex === -1) {
      return null;
    }

    const element = controllersData[elementIndex];
    const selectedEcuUpdatedData: ECURecordExtended = {
      ...element,
      is_update_required: false,
    };

    const tempData = [...controllersData];
    tempData.splice(elementIndex, 1, selectedEcuUpdatedData);

    set({ controllersData: tempData });
    return selectedEcuUpdatedData;
  },
}));
