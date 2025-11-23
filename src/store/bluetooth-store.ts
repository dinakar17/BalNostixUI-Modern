import { NativeModules } from "react-native";
import { create } from "zustand";
import { BASEURL } from "@/api/fms";

const { BluetoothModule } = NativeModules;

export type ControllerData = {
  index: number;
  ecuName: string;
  ecu_id: string;
  isActuatorEnabled: boolean;
  isAnalyticsEnabled: boolean;
  isErrorCodeEnabled: boolean;
  isReadParameterEnabled: boolean;
  isReprogramEnabled: boolean;
  isSpecialFunctionEnabled: boolean;
  isUpdateBootEnabled: boolean;
  isWriteParameterEnabled: boolean;
  isEEDumpOperation: boolean;
  isVinWrite: boolean;
  isBinWrite: boolean;
  isUSBPrograming: boolean;
  dynamicWaitTime: number;
  updateFrameTime: number;
  isUpdatePerFrame: boolean;
  isShowUpdatePerFrameTime: boolean;
  isForceEachTimeOA: boolean;
  isCheckBIOError: boolean;
  isProgConstWriteEnabled: boolean;
  readParamAutoRefreshShownInGroupName: boolean;
  isWriteMotorType: boolean;
  isAutomateMotorType: boolean;
  motorTypeId: string;
  mcuOffsetLearnTriggerId: string;
  is_update_required: boolean;
};

type BluetoothState = {
  // State
  isBluetoothConnected: boolean;
  connectedDeviceName: string | null;
  selectedEcu: ControllerData | null;
  controllersData: ControllerData[];

  // Actions
  connectToDevice: (address: string, name: string) => Promise<boolean>;
  disconnectFromDevice: () => void;
  updateBluetooth: () => void;
  setControllersData: (data: ControllerData[]) => void;
  setSelectedEcu: (ecu: ControllerData | null) => void;
  setControllersUpdatedData: (
    controllersData: ControllerData[],
    index: number,
    updatedData: Partial<ControllerData>
  ) => ControllerData | null;
  setIsUpdateAvailableToFalse: (
    controllersData: ControllerData[],
    index: number
  ) => ControllerData | null;
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
  setControllersData: (data: ControllerData[]) => {
    set({ controllersData: data });
  },

  // Set selected ECU
  setSelectedEcu: (ecu: ControllerData | null) => {
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

  // Set update available to false for specific controller
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
}));
