import { NativeModules } from "react-native";
import { create } from "zustand";
import { ENV } from "@/config/env";
import type { ECURecord } from "@/types";
import type { ControllerData } from "./bluetooth-store";

const { BluetoothModule, USBModule } = NativeModules;

// Dongle store for serial number management
class DongleStore {
  private serialNo: string | null = null;

  setSerialNo(serialNo: string | null) {
    this.serialNo = serialNo;
  }

  getSerialNo() {
    return this.serialNo;
  }
}

export const dongleStore = new DongleStore();

type DataTransferState = {
  // State
  isDeviceConnected: boolean;
  isDongleToBeDisconnected: boolean;
  isDongleDisconnectWarning: boolean;
  connectedDeviceName: string | null;
  selectedEcu: ECURecord;
  selectedEcuIndex: number;
  controllersData: ControllerData[];
  vin: string;
  isDonglePhase3State: boolean;
  isDongleStuckInBoot: boolean;
  isDongleDeviceInfoSet: boolean;
  isSessionExpired: boolean;
  dongleSerialNo: string | null;
  isMotorTypeAlreadyWritten: boolean;
  isGettingDongleDeviceInfo: boolean;

  // Actions
  connectToDevice: (address: string, name: string) => Promise<boolean>;
  connectToUSBDevice: (name: string) => Promise<boolean>;
  disconnectFromDevice: () => void;
  updateDevice: () => void;
  updateBluetooth: () => void;
  updateDongleToDisconnected: () => void;
  updateDongleToNotDisconnect: () => void;
  updateIsDongleDisconnectWarning: () => void;
  cancelIsDongleDisconnectWarning: () => void;
  setControllersData: (data: ControllerData[]) => void;
  setSelectedEcu: (ecu: ECURecord) => void;
  setControllersUpdatedData: (
    controllersData: ControllerData[],
    index: number,
    updatedData: Partial<ControllerData>
  ) => ControllerData | null;
  setIsUpdateAvailableToFalse: (
    controllersData: ControllerData[],
    index: number
  ) => ControllerData | null;
  setVin: (vin: string) => void;
  updateIsSessionExpired: (isExpired: boolean) => void;
  updateIsDonglePhase3State: (isDonglePhase3: boolean) => void;
  updateIsDongleStuckInBoot: (isDongleStuckInBoot: boolean) => void;
  updateIsDongleDeviceInfoSet: (isSet: boolean) => void;
  updateDongleSerialNo: (serialNo: string | null) => void;
  updateIsGettingDongleDeviceInfo: (isGetting: boolean) => void;
  updateIsMotorTypeAlreadyWritten: (value: boolean) => void;
};

export const useDataTransferStore = create<DataTransferState>()((set) => ({
  // Initial State
  isDeviceConnected: false, // This indicates if the dongle is connected or not
  isDongleToBeDisconnected: false,
  isDongleDisconnectWarning: false,
  connectedDeviceName: null,
  selectedEcu: {} as ECURecord,
  selectedEcuIndex: 0,
  controllersData: [],
  vin: "",
  isDonglePhase3State: false,
  isDongleStuckInBoot: false,
  isDongleDeviceInfoSet: false,
  isSessionExpired: false,
  dongleSerialNo: null,
  isMotorTypeAlreadyWritten: false,
  isGettingDongleDeviceInfo: false,

  // Connect to Bluetooth device
  connectToDevice: async (address: string, name: string) => {
    try {
      const isInitSuccess = await BluetoothModule.initBalDongle(
        address,
        ENV.FMS_URL
      );

      if (isInitSuccess) {
        set({ connectedDeviceName: name });
        return true;
      }
      return false;
    } catch (error) {
      console.error("connectToDevice error:", error);
      return false;
    }
  },

  // Connect to USB device
  connectToUSBDevice: async (name: string) => {
    try {
      const isInitSuccess = await USBModule.initBalUSBDongle(ENV.FMS_URL);

      if (isInitSuccess) {
        set({ connectedDeviceName: name });
        console.log("device name=", name, "initSuccess=", isInitSuccess);
        return true;
      }
      return false;
    } catch (error) {
      console.error("connectToUSBDevice error:", error);
      return false;
    }
  },

  // Disconnect from device
  disconnectFromDevice: () => {
    set({
      isDeviceConnected: false,
      isGettingDongleDeviceInfo: false,
      isMotorTypeAlreadyWritten: false,
      dongleSerialNo: null,
      vin: "",
    });
  },

  // Update device connection status
  updateDevice: () => {
    set({ isDeviceConnected: true });
    console.log("Update Device Called");
  },

  // Update Bluetooth connection
  updateBluetooth: () => {
    set({ isDeviceConnected: true });
  },

  // Mark dongle to be disconnected
  updateDongleToDisconnected: () => {
    console.log("Update isDongleToBeDisconnected true");
    set({ isDongleToBeDisconnected: true });
  },

  // Cancel dongle disconnection
  updateDongleToNotDisconnect: () => {
    console.log("Update isDongleToBeDisconnected false");
    set({ isDongleToBeDisconnected: false });
  },

  // Show dongle disconnect warning
  updateIsDongleDisconnectWarning: () => {
    console.log("Update isDongleDisconnectWarning true");
    set({ isDongleDisconnectWarning: true });
  },

  // Cancel dongle disconnect warning
  cancelIsDongleDisconnectWarning: () => {
    console.log("Update isDongleDisconnectWarning false");
    set({ isDongleDisconnectWarning: false });
  },

  // Set controllers data
  setControllersData: (data: ControllerData[]) => {
    set({ controllersData: data });
  },

  // Set selected ECU
  setSelectedEcu: (ecu: ECURecord) => {
    set({ selectedEcu: ecu });
  },

  // Update specific controller data
  setControllersUpdatedData: (
    controllersData: ControllerData[],
    index: number,
    updatedData: Partial<ControllerData>
  ) => {
    const elementIndex = controllersData.findIndex((o) => o.index === index);

    if (elementIndex === -1) {
      return null;
    }

    const element = controllersData[elementIndex];
    const selectedEcuUpdatedData: ControllerData = {
      ...element,
      ...updatedData,
    };

    const tempData = [...controllersData];
    tempData.splice(elementIndex, 1, selectedEcuUpdatedData);

    set({ controllersData: tempData });
    return selectedEcuUpdatedData;
  },

  // Set update available to false
  setIsUpdateAvailableToFalse: (
    controllersData: ControllerData[],
    index: number
  ) => {
    const elementIndex = controllersData.findIndex((o) => o.index === index);

    if (elementIndex === -1) {
      return null;
    }

    const element = controllersData[elementIndex];
    const selectedEcuUpdatedData: ControllerData = {
      ...element,
      is_update_required: false,
    };

    const tempData = [...controllersData];
    tempData.splice(elementIndex, 1, selectedEcuUpdatedData);

    set({ controllersData: tempData });
    return selectedEcuUpdatedData;
  },

  // Set VIN
  setVin: (vin: string) => {
    console.log("setVin called:", vin);
    set({ vin });
  },

  // Update session expiry status
  updateIsSessionExpired: (isExpired: boolean) => {
    set({ isSessionExpired: isExpired });
  },

  // Update dongle phase 3 state
  updateIsDonglePhase3State: (isDonglePhase3: boolean) => {
    set({ isDonglePhase3State: isDonglePhase3 });
  },

  // Update dongle stuck in boot state
  updateIsDongleStuckInBoot: (isDongleStuckInBoot: boolean) => {
    set({ isDongleStuckInBoot });
  },

  // Update dongle device info set status
  updateIsDongleDeviceInfoSet: (isSet: boolean) => {
    set({ isDongleDeviceInfoSet: isSet });
  },

  // Update dongle serial number
  updateDongleSerialNo: (serialNo: string | null) => {
    dongleStore.setSerialNo(serialNo);
    set({ dongleSerialNo: serialNo });
  },

  // Update getting dongle device info status
  updateIsGettingDongleDeviceInfo: (isGetting: boolean) => {
    set({ isGettingDongleDeviceInfo: isGetting });
  },

  // Update motor type written status
  updateIsMotorTypeAlreadyWritten: (value: boolean) => {
    set({ isMotorTypeAlreadyWritten: value });
  },
}));
