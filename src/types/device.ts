/**
 * Device and connection types
 */

export type DataTransferMode = "Bluetooth" | "USB" | "null";

export type BluetoothDevice = {
  name: string;
  address: string;
  paired: boolean;
};

export type USBDevice = {
  name: string;
  deviceId: string;
};

export type DongleInfo = {
  serialNo: string | null;
  isPhase3: boolean;
  isStuckInBoot: boolean;
  deviceInfoSet: boolean;
};

export type DeviceConnectionStatus = {
  isConnected: boolean;
  deviceName: string | null;
  transferMode: DataTransferMode;
  dongleInfo: DongleInfo;
};
