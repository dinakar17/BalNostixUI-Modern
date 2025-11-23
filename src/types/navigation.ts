/**
 * Navigation types for Expo Router
 */

import type { ECURecord } from "./ecu";

// Auth Stack Params
export type AuthStackParams = {
  index: undefined; // Login screen
  register: undefined;
  "forgot-password": undefined;
  "change-password": undefined;
  initialized: undefined;
};

// Main Stack Params
export type MainStackParams = {
  "select-device": undefined;
  "select-data-transfer-mode": undefined;
  controllers: undefined;
  "controller-operations": { ecuRecord: ECURecord };
  "error-codes": { ecuIndex: number };
  "read-parameters": { ecuIndex: number };
  "write-parameters": { ecuIndex: number };
  actuators: { ecuIndex: number };
  flashing: { ecuIndex: number };
  "write-vin": undefined;
  "write-bin": undefined;
  "write-prog-const": undefined;
  "write-motor-type": { ecuPosition?: number };
  "manual-write-motor-type": undefined;
  "read-vin": undefined;
  "special-function": undefined;
  "ecu-dump": undefined;
  "update-boot": undefined;
  "flash-finished": undefined;
  "download-data": { vinNumber: string };
};

// Root Stack (combines Auth + Main)
export type RootStackParams = AuthStackParams & MainStackParams;

// Screen Props helper type
export type ScreenProps<T extends keyof RootStackParams> = {
  route: {
    params: RootStackParams[T];
  };
  navigation: any; // Expo Router navigation type
};
