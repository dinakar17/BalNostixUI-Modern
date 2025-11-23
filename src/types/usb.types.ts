/**
 * TypeScript type definitions for USBModule
 * Native module for USB dongle connection and permission handling
 */

import type { NativeModule } from "react-native";

// ============================================================================
// Event Payload Types
// ============================================================================

/**
 * USB device connection status event payload
 */
export type USBDeviceConnectStatusPayload = {
  name: string; // Device name (e.g., kernel hardware address)
  status:
    | "success"
    | "DeviceDetached"
    | "PermissionGranted"
    | "PermissonAreadyGranted";
};

// ============================================================================
// USB Device Types
// ============================================================================

/**
 * USB device representation
 */
export type USBDevice = {
  name: string; // Kernel hardware address
  manufacturerName?: string; // e.g., "FTDI"
  productName?: string; // e.g., "FTDI UART"
  vendorId?: number;
  deviceId?: number;
};

// ============================================================================
// USBModule Interface
// ============================================================================

/**
 * Native USBModule interface exposed to React Native
 * Extends NativeModule to support event emitter functionality
 * @module USBModule
 */
export interface USBModuleType extends NativeModule {
  /**
   * Initialize BAL USB dongle connection
   * Initializes UsbComManager and BALBTDongleApiImpl for USB communication
   * @param baseURL - Base URL for client info and logging
   * @returns Promise resolving to true if initialization succeeds, false otherwise
   * @example
   * ```ts
   * const success = await NativeModules.USBModule.initBalUSBDongle('https://api.example.com');
   * if (success) {
   *   console.log('USB dongle initialized');
   * }
   * ```
   */
  initBalUSBDongle(baseURL: string): Promise<boolean>;

  /**
   * Get USB permission for connected device
   * Checks if a USB device is connected and triggers permission request
   * Emits 'USBDeviceConnectStatus' event with permission result
   * @returns Promise resolving to true if device is connected (permission request initiated), false otherwise
   * @example
   * ```ts
   * const deviceConnected = await NativeModules.USBModule.getPermissionForUSB();
   * if (deviceConnected) {
   *   // Listen for 'USBDeviceConnectStatus' event for permission result
   * }
   * ```
   */
  getPermissionForUSB(): Promise<boolean>;

  /**
   * Reset USB permission state and clear connected device
   * Emits 'USBDeviceConnectStatus' with "DeviceDetached" status if device was connected
   * Call this when user manually disconnects or app needs to reset USB state
   * @returns Promise that resolves when reset is complete
   * @example
   * ```ts
   * await NativeModules.USBModule.resetUSBPermission();
   * // USB state cleared, ready for new connection
   * ```
   */
  resetUSBPermission(): Promise<void>;

  /**
   * Initialize USB communication system
   * Sets up UsbManager, UsbComManager, and registers broadcast receiver for USB events
   * Should be called once during app initialization before any other USB operations
   * Registers intent filters for:
   * - INTENT_ACTION_GRANT_USB (permission granted)
   * - ACTION_USB_DEVICE_ATTACHED (device connected)
   * - ACTION_USB_DEVICE_DETACHED (device disconnected)
   * @example
   * ```ts
   * NativeModules.USBModule.initUSBCom();
   * // USB system initialized, ready to detect devices
   * ```
   */
  initUSBCom(): void;

  /**
   * Get the module name identifier
   * Used internally by React Native bridge
   * @returns Module name "USBModule"
   */
  getName(): string;
}

// ============================================================================
// Event Channel Names
// ============================================================================

/**
 * Event channels emitted by USBModule via DeviceEventManagerModule
 */
export type USBModuleEventName = "USBDeviceConnectStatus";

/**
 * Event payload type mapping for type-safe event listeners
 */
export type USBModuleEvents = {
  USBDeviceConnectStatus: USBDeviceConnectStatusPayload;
};

// ============================================================================
// Module Augmentation for React Native NativeModules
// ============================================================================

declare module "react-native" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: <T> Use type keyword
  interface NativeModulesStatic {
    USBModule: USBModuleType;
  }
}

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * @example
 * ```typescript
 * import { NativeModules, NativeEventEmitter } from 'react-native';
 * import type { USBDeviceConnectStatusPayload } from '@/types/usb.types';
 *
 * const { USBModule } = NativeModules;
 * const eventEmitter = new NativeEventEmitter(USBModule);
 *
 * // Initialize USB communication system
 * USBModule.initUSBCom();
 *
 * // Listen for USB device connection status
 * const subscription = eventEmitter.addListener(
 *   'USBDeviceConnectStatus',
 *   (event: USBDeviceConnectStatusPayload) => {
 *     switch (event.status) {
 *       case 'success':
 *         console.log(`USB device ${event.name} connected successfully`);
 *         break;
 *       case 'DeviceDetached':
 *         console.log(`USB device ${event.name} disconnected`);
 *         break;
 *       case 'PermissionGranted':
 *         console.log(`Permission granted for ${event.name}`);
 *         break;
 *       case 'PermissonAreadyGranted':
 *         console.log(`Permission already granted for ${event.name}`);
 *         break;
 *     }
 *   }
 * );
 *
 * // Initialize dongle with base URL
 * const initSuccess = await USBModule.initBalUSBDongle('https://api.bajaj.com');
 *
 * // Request permission for connected USB device
 * const deviceConnected = await USBModule.requestUSBPermission();
 *
 * // Reset USB state when done
 * await USBModule.resetUSBPermission();
 *
 * // Clean up event listener
 * subscription.remove();
 * ```
 *
 * @example
 * ```typescript
 * // Complete USB connection flow
 * import { NativeModules, NativeEventEmitter } from 'react-native';
 *
 * const { USBModule } = NativeModules;
 *
 * class USBConnectionManager {
 *   private eventEmitter = new NativeEventEmitter(USBModule);
 *   private subscription: any = null;
 *
 *   async initialize() {
 *     // Step 1: Initialize USB system
 *     USBModule.initUSBCom();
 *
 *     // Step 2: Listen for connection events
 *     this.subscription = this.eventEmitter.addListener(
 *       'USBDeviceConnectStatus',
 *       this.handleUSBEvent.bind(this)
 *     );
 *
 *     // Step 3: Initialize dongle
 *     const success = await USBModule.initBalUSBDongle('https://api.example.com');
 *     if (!success) {
 *       throw new Error('Failed to initialize USB dongle');
 *     }
 *
 *     // Step 4: Request device permission
 *     const deviceFound = await USBModule.requestUSBPermission();
 *     if (!deviceFound) {
 *       throw new Error('No USB device connected');
 *     }
 *   }
 *
 *   handleUSBEvent(event: USBDeviceConnectStatusPayload) {
 *     if (event.status === 'success') {
 *       console.log('USB dongle ready for diagnostics');
 *     } else if (event.status === 'DeviceDetached') {
 *       console.log('USB dongle disconnected, please reconnect');
 *     }
 *   }
 *
 *   async cleanup() {
 *     await USBModule.resetUSBPermission();
 *     this.subscription?.remove();
 *   }
 * }
 * ```
 */
