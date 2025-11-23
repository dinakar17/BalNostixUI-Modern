/**
 * TypeScript type definitions for BluetoothCustomModule (BluetoothModule)
 * Native module for ECU diagnostics, flashing, and parameter operations via Bluetooth
 */

import type { NativeModule } from "react-native";

// ============================================================================
// Event Payload Types
// ============================================================================

/**
 * Error code model from ECU diagnostics
 */
export type ErrorCodeModel = {
  code: string;
  description: string;
  type?: string;
};

/**
 * Flashing progress update payload
 */
export type FlashingUpdatePayload = {
  name: string;
  value?: {
    mainProgress: number; // -1 for timeout, 0-100 for progress
    subProgress: number;
    status: string; // e.g., "Operation Time Out, Please try again", "STARTED_PARSING"
  } | null;
};

/**
 * Boot update progress payload
 */
export type BootUpdatePayload = {
  name: string;
  value?: {
    mainProgress: number;
    subProgress: number;
    status: string;
  } | null;
};

/**
 * VIN write operation update
 */
export type WriteVinUpdatePayload = {
  name: string;
  value?: {
    mainProgress: number;
    subProgress: number;
    status: string;
  } | null;
};

/**
 * Programming Constants write update
 */
export type WritePCUpdatePayload = {
  name: string;
  value?: string | null;
};

/**
 * BIN write operation update
 */
export type WriteBinUpdatePayload = {
  name: string;
  value?: {
    mainProgress: number;
    subProgress: number;
    status: string;
  } | null;
};

/**
 * Analytics graph data payload
 */
export type AnalyticsGraphPayload = {
  name: string;
  value?: any; // Define specific analytics structure as needed
};

/**
 * Error codes list payload
 */
export type ErrorCodesListPayload = {
  name: string;
  value?: ErrorCodeModel[] | null;
};

/**
 * Clear code operation result
 */
export type ClearCodePayload = {
  name: string;
  value?: string | null;
};

/**
 * Read VIN result
 */
export type ReadVinPayload = {
  name: string;
  value?: string | null;
};

/**
 * Dump operation payload
 */
export type DumpPayload = {
  name: string;
  value?:
    | {
        status: boolean;
        message: string;
        processStatus: string;
        isReadyToUpload?: boolean;
        StepNo: number;
      }
    | string
    | null;
};

/**
 * Read BIN data payload
 */
export type ReadBinDataPayload = {
  name: string;
  value?: string | null;
};

/**
 * Actuator routine progress
 */
export type ActuatorPayload = {
  name: string;
  value?:
    | {
        status: boolean;
        message: string;
        processStatus: string;
        RoutinePosOnUI: number;
        StepNo: number;
      }
    | string
    | null;
};

/**
 * Read parameters list
 */
export type ReadParametersPayload = {
  name: "readparameters";
  success: boolean;
  data: Array<{
    detail: string;
    name: string;
  }>;
};

/**
 * Write parameters list
 */
export type WriteParametersPayload = {
  name: "writeparameters";
  success: boolean;
  data: Array<{
    description: string;
    value: string;
    didHex: string;
    newValue: string;
    valueType: string;
    maxValue: string;
    minValue: string;
    isCallProPackStatusUploadApi: boolean;
    isRedColorEnable: boolean;
    showProgress: boolean;
    isResultRaw: boolean;
    checkDid: string;
    resultToPass: string;
    resultToFail: string;
    timeoutInMs: number;
    hint: string[];
  }>;
};

/**
 * UI update data payload
 */
export type UpdateUIPayload = {
  name: string;
  value?: any;
};

// ============================================================================
// Native Device Types
// ============================================================================

/**
 * Bluetooth device representation
 */
export type NativeDevice = {
  name: string;
  address: string;
  bondState?: number;
  deviceType?: number;
};

/**
 * ECU record with all diagnostic capabilities
 */
export type ECURecord = {
  ecuName: string;
  index: number;
  isErrorCodeEnabled: boolean;
  isReadParameterEnabled: boolean;
  isWriteParameterEnabled: boolean;
  isReprogramEnabled: boolean;
  isUpdateBootEnabled: boolean;
  isSpecialFunctionEnabled: boolean;
  isActuatorEnabled: boolean;
  isAnalyticsEnabled: boolean;
  isEEDumpOperation: boolean;
  isVinWrite: boolean;
  isBinWrite: boolean;
  isProgConstWriteEnabled: boolean;
  isUSBPrograming: boolean;
  appHexUrl: string;
  didsXmlUrl: string;
  dtcsXmlUrl: string;
  btlHexUrl: string;
  appHexFileName: string;
  didsXmlFileName: string;
  dtcsXmlFileName: string;
  btlHexFileName: string;
  oldHexFileName: string;
  isCheckBIOError: boolean;
  readParamAutoRefreshShownInGroupName: string;
  vinNumber?: string;
  // Motor type related
  isWriteMotorType: boolean;
  isAutomateMotorType: boolean;
  motorTypeId: string;
  mcuOffsetLearnTriggerId: string;
  // Timing configuration
  dynamicWaitTime: number;
  updateFrameTime: number;
  isUpdatePerFrame: boolean;
  isShowUpdatePerFrameTime: boolean;
  isForceEachTimeOA: boolean;
};

/**
 * Actuator routine definition
 */
export type ActuatorRoutine = {
  id: string;
  name: string;
  numberOfSteps: number;
  index: number;
};

// ============================================================================
// BluetoothModule Interface
// ============================================================================

/**
 * Native BluetoothModule interface exposed to React Native
 * Extends NativeModule to support event emitter functionality
 * @module BluetoothModule
 */
export interface BluetoothModuleType extends NativeModule {
  // ============================================================================
  // Initialization & Connection Methods
  // ============================================================================

  /**
   * Initialize Bluetooth adapter
   * @returns Promise resolving to true if Bluetooth is available, false otherwise
   */
  initApplication(): Promise<boolean>;

  /**
   * Initialize intent filters for Bluetooth device events
   */
  initIntentFilters(): void;

  /**
   * Enable Bluetooth adapter
   */
  enableBluetooth(): void;

  /**
   * Get list of bonded (paired) Bluetooth devices
   * @returns Promise with array of bonded devices
   */
  getBondedDevices(): Promise<NativeDevice[]>;

  /**
   * Start scanning for nearby Bluetooth devices
   * @returns Promise resolving to true on success
   */
  getScanDevices(): Promise<boolean>;

  /**
   * Stop Bluetooth device discovery
   * @returns Promise resolving when discovery stops
   */
  stopDiscovery(): Promise<void>;

  /**
   * Create bond (pair) with a Bluetooth device
   * @param address - Bluetooth MAC address of the device
   * @returns Promise resolving to true on success
   */
  createBond(address: string): Promise<boolean>;

  /**
   * Set data transfer mode (Bluetooth or USB)
   * @param modeName - Mode name containing "USB" or "Bluetooth"
   * @returns Promise resolving to "USB" or "Bluetooth"
   */
  setDataTransferMode(modeName: string): Promise<"USB" | "Bluetooth">;

  /**
   * Stop BAL dongle library
   */
  balDongleLibStop(): void;

  /**
   * Initialize BAL dongle connection via Bluetooth
   * @param btAddress - Bluetooth MAC address
   * @param baseURL - Base URL for client info
   * @returns Promise resolving to true if connected successfully
   */
  initBalDongle(btAddress: string, baseURL: string): Promise<boolean>;

  // ============================================================================
  // Dongle Management Methods
  // ============================================================================

  /**
   * Initialize shutdown sequence for dongle
   */
  initShutDown(): void;

  /**
   * Start self-flash operation on ECU
   * @param pos - ECU record index
   */
  startSelfFlash(pos: number): void;

  /**
   * Check if dongle is stuck in boot mode
   */
  checkIsDongleStuckInBoot(): void;

  /**
   * Check if dongle is Phase 3
   * @returns Promise with boolean result
   */
  isDonglePhase3(): Promise<boolean>;

  /**
   * Get dongle version comparison info
   * @returns Promise resolving to true if version is valid
   */
  getDongleVersionInfo(): Promise<boolean>;

  /**
   * Get dongle app and bootloader version string
   * @returns Promise with version string (e.g., " (1.0.0 & 2.0.0)")
   */
  getDongleAppVersion(): Promise<string>;

  // ============================================================================
  // VIN Operations
  // ============================================================================

  /**
   * Subscribe to read VIN operation
   * Emits events on 'readVin' channel
   */
  subscribeToReadVin(): void;

  /**
   * Unsubscribe from read VIN operation
   */
  unsubscribeToReadVin(): void;

  /**
   * Subscribe to write VIN operation
   * @param pos - ECU record index
   * @param vin - VIN string to write
   */
  subscribeToWriteVinUpdate(pos: number, vin: string): void;

  /**
   * Unsubscribe from write VIN updates
   */
  unSubscribeToWriteVinUpdate(): void;

  /**
   * Check if VIN format is valid
   * @param vin - VIN string to validate
   * @returns Promise with validation result
   */
  isValidVin(vin: string): Promise<boolean>;

  /**
   * Validate VIN using BAL dongle library
   * @param vin - VIN string to validate
   * @returns Promise with validation result
   */
  validateVIN(vin: string): Promise<boolean>;

  /**
   * Validate BIN format
   * @param bin - BIN string to validate
   * @returns Promise with validation result
   */
  validateBIN(bin: string): Promise<boolean>;

  // ============================================================================
  // Error Code Operations
  // ============================================================================

  /**
   * Subscribe to error codes list for specific ECU
   * @param pos - ECU record index
   */
  subscribeToErrorCodesList(pos: number): void;

  /**
   * Unsubscribe from error codes list
   */
  unsubscribeToErrorCodesList(): void;

  /**
   * Subscribe to clear error codes operation
   * @param pos - ECU record index
   * @param errorCodeType - Type of error codes to clear
   */
  subscribeToClearCode(pos: number, errorCodeType: string): void;

  /**
   * Unsubscribe from clear code operation
   */
  unsubscribeToClearCode(): void;

  // ============================================================================
  // Flashing Operations
  // ============================================================================

  /**
   * Subscribe to flashing progress updates
   * @param pos - ECU record index
   */
  subscribeToFlashingUpdate(pos: number): void;

  /**
   * Unsubscribe from flashing updates
   */
  unSubscribeToFlashingUpdate(): void;

  /**
   * Subscribe to boot flashing progress updates
   * @param pos - ECU record index
   */
  subscribeToBootFlashingUpdate(pos: number): void;

  /**
   * Unsubscribe from boot flashing updates
   */
  unSubscribeToFlashingBoot(): void;

  /**
   * Check if boot update is required for ECU
   * @param pos - ECU record index
   * @returns Promise with boolean result
   */
  isBootUpdateRequired(pos: number): Promise<boolean>;

  /**
   * Update bootloader on dongle
   */
  updateBootLoader(): void;

  /**
   * Subscribe to boot update operation
   */
  subscribeToUpdateBoot(): void;

  /**
   * Unsubscribe from boot update
   */
  unSubscribeToUpdateBoot(): void;

  // ============================================================================
  // BIN Operations
  // ============================================================================

  /**
   * Subscribe to write BIN operation
   * Emits events on 'updateWriteBin' channel
   * @param pos - ECU record index
   * @param bin - BIN string to write
   */
  subscribeToWriteBinUpdate(pos: number, bin: string): void;

  /**
   * Unsubscribe from write BIN updates
   */
  unSubscribeToWriteBinUpdate(): void;

  /**
   * Subscribe to read BIN data operation
   * @param posBMS - BMS ECU record index
   * @param posVCU - VCU ECU record index
   */
  subscribeToReadBinData(posBMS: number, posVCU: number): void;

  /**
   * Unsubscribe from read BIN data operation
   */
  unsubscribeToReadBinData(): void;

  // ============================================================================
  // Programming Constants Operations
  // ============================================================================

  /**
   * Subscribe to write programming constants operation
   * @param pos - ECU record index
   */
  subscribeToWritePCUpdate(pos: number): void;

  /**
   * Unsubscribe from write PC updates
   */
  unSubscribeToWritePCUpdate(): void;

  // ============================================================================
  // Parameter Operations
  // ============================================================================

  /**
   * Get list of DID (Data Identifier) groups for ECU
   * @param pos - ECU record index
   * @returns Promise with array of group names
   */
  getListOfDidGroups(pos: number): Promise<string[]>;

  /**
   * Start reading parameters for specific group
   * Emits periodic updates on 'readparameters' channel
   * @param pos - ECU record index
   * @param groupName - DID group name
   */
  getReadParameters(pos: number, groupName: string): void;

  /**
   * Stop read parameters polling timer
   */
  stopReadParametersTimer(): void;

  /**
   * Read ECU basic information
   * @param pos - ECU record index
   */
  readEcuBasicnfo(pos: number): void;

  /**
   * Get write parameters for ECU
   * Emits periodic updates on 'writeparameters' channel
   * @param pos - ECU record index
   */
  getWriteParameter(pos: number): void;

  /**
   * Write DID parameter to ECU
   * @param pos - ECU record index
   * @param description - Parameter description/name
   * @param newValue - New value to write
   * @returns Promise resolving to true on success
   */
  getWriteDidParameter(
    pos: number,
    description: string,
    newValue: string
  ): Promise<boolean>;

  /**
   * Set auto-refresh for read parameters
   * @param isAutoRefresh - Enable/disable auto-refresh
   * @param pos - ECU record index
   */
  setReadParamAutoRefresh(isAutoRefresh: boolean, pos: number): void;

  // ============================================================================
  // ECU Records Management
  // ============================================================================

  /**
   * Get ECU records from JSON configuration
   * @param ecuRecordJson - JSON string with ECU definitions
   * @param vinNumber - VIN number associated with vehicle
   * @returns Promise with array of ECU records
   */
  getEcuRecords(ecuRecordJson: string, vinNumber: string): Promise<ECURecord[]>;

  /**
   * Get updated ECU record for specific index
   * @param pos - ECU record index
   * @returns Promise with single ECU record
   */
  getUpdatedEcuRecords(pos: number): Promise<ECURecord>;

  // ============================================================================
  // Special Functions
  // ============================================================================

  /**
   * Reset configuration for ECU
   * @param pos - ECU record index
   */
  resetConfig(pos: number): void;

  /**
   * Get UDS (Unified Diagnostic Services) parameters
   * @param pos - ECU record index
   */
  UDSParameter(pos: number): void;

  /**
   * Save application log for ECU
   * Saves diagnostic logs to device storage for later upload
   * @param pos - ECU record index
   */
  saveAppLog(pos: number): void;

  /**
   * Check if both logs (dongle + app) should be uploaded
   * @param pos - ECU record index
   * @returns Promise with boolean result
   */
  isUploadBothLog(pos: number): Promise<boolean>;

  /**
   * Delete BAL application logs from device
   */
  deleteBalLogs(): void;

  // ============================================================================
  // Actuator Operations
  // ============================================================================

  /**
   * Get all actuator routines for ECU
   * @param pos - ECU record index
   * @returns Promise with array of actuator routines
   */
  getAllActuators(pos: number): Promise<ActuatorRoutine[]>;

  /**
   * Subscribe to actuator routine execution
   * @param pos - ECU record index
   * @param index - Actuator routine index
   */
  subscribeToActuator(pos: number, index: number): void;

  /**
   * Unsubscribe from actuator updates
   */
  unSubscribeToActuator(): void;

  // ============================================================================
  // Analytics Operations
  // ============================================================================

  /**
   * Subscribe to analytics graph data
   */
  subscribeToAnalyticsGraph(): void;

  /**
   * Unsubscribe from analytics graph
   */
  unSubscribeToAnalyticsGraph(): void;

  // ============================================================================
  // EE Dump Operations
  // ============================================================================

  /**
   * Subscribe to EEPROM dump operation
   * @param pos - ECU record index
   */
  subscribeToDump(pos: number): void;

  /**
   * Unsubscribe from dump operation
   */
  unsubscribeToDump(): void;

  // ============================================================================
  // Timer Management
  // ============================================================================

  /**
   * Stop all timers from React Native side
   * Stops all active countdown timers including flashing, parsing, and actuator timers
   */
  stopAllTimersFromReact(): void;
}

// ============================================================================
// Event Channel Names
// ============================================================================

/**
 * Event channels emitted by BluetoothModule via DeviceEventManagerModule
 */
export type BluetoothModuleEventName =
  | "updateFlashing" // Flashing progress updates
  | "updateBoot" // Boot update progress
  | "errorCodes" // Error codes list updates
  | "updateWriteVin" // VIN write operation updates
  | "updateWritePC" // Programming constants write updates
  | "updateWriteBin" // BIN write operation updates
  | "analytics" // Analytics graph data
  | "readVin" // Read VIN result
  | "clearCode" // Clear code operation result
  | "eeDump" // EEPROM dump progress
  | "readBinData" // Read BIN data result
  | "actuator" // Actuator routine progress
  | "readparameters" // Read parameters list (periodic updates)
  | "writeparameters"; // Write parameters list (periodic updates)

/**
 * Event payload type mapping for type-safe event listeners
 */
export type BluetoothModuleEvents = {
  updateFlashing: FlashingUpdatePayload;
  updateBoot: BootUpdatePayload;
  errorCodes: ErrorCodesListPayload;
  updateWriteVin: WriteVinUpdatePayload;
  updateWritePC: WritePCUpdatePayload;
  updateWriteBin: WriteBinUpdatePayload;
  analytics: AnalyticsGraphPayload;
  readVin: ReadVinPayload;
  clearCode: ClearCodePayload;
  eeDump: DumpPayload;
  readBinData: ReadBinDataPayload;
  actuator: ActuatorPayload;
  readparameters: ReadParametersPayload;
  writeparameters: WriteParametersPayload;
};

// ============================================================================
// Module Augmentation for React Native NativeModules
// ============================================================================

declare module "react-native" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: <T> Use type keyword
  interface NativeModulesStatic {
    BluetoothModule: BluetoothModuleType;
  }
}
