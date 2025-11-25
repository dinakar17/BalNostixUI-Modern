/**
 * ECU (Electronic Control Unit) types
 */

export type ECURecord = {
  index: number;
  ecuName: string;
  ecuId: string;
  position: number;
  vinNumber: string;
  oldHexFileName: string;

  // Feature flags
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
  isProgConstWriteEnabled: boolean;

  // Configuration
  dynamicWaitTime: number;
  updateFrameTime: number;
  isUpdatePerFrame: boolean;
  isShowUpdatePerFrameTime: boolean;
  isForceEachTimeOA: boolean;
  isCheckBIOError: boolean;
  readParamAutoRefreshShownInGroupName: string;

  // Motor Type related
  isWriteMotorType: boolean;
  isAutomateMotorType: boolean;
  motorTypeId: string;
  mcuOffsetLearnTriggerId: string;

  // Update status
  isUpdateRequired: boolean;
  isUpdateAvailable?: boolean;
};

/**
 * DID (Data Identifier) Parameter types
 */
export type DIDParameter = {
  // Read parameters fields
  name?: string; // Parameter name (e.g., "VCU_Assembly_part_number")
  detail?: string; // Parameter value/detail (e.g., "GL440627")

  // Write parameters fields
  didHex?: string; // DID hex value (e.g., "F117")
  description?: string; // Parameter description (e.g., "VCU_TriggerVINTeach")
  value?: string; // Current value
  hint?: string | string[]; // Input hints or dropdown options
  min?: string;
  max?: string;
  minValue?: string | null;
  maxValue?: string | null;
  valueType?: string; // "FLOAT", "HEX", "ASCII", "INT"

  // Write operation fields
  showProgress?: boolean;
  timeoutInMs?: number;
  isCallProPackStatusUploadApi?: boolean;
  isRedColorEnable?: boolean;
  isResultRaw?: boolean;
  checkDid?: string | null;
  newValue?: string | null;
  resultToFail?: string;
  resultToPass?: string;
};

/**
 * Error Code types
 */
export type ErrorCode = {
  text: string; // The DTC code (e.g., "P071A-13")
  name: string; // Internal name (e.g., "DRV_OPEN_CKT")
  description: string;
  remedy: string;
  status: "Current" | "History" | "Both";
};

/**
 * Actuator Routine types
 */
export type ActuatorRoutine = {
  name: string;
  routineId: string;
  description: string;
  isEnabled: boolean;
};

/**
 * Read Parameter types
 */
export type ReadParameter = {
  name: string;
  value: string;
  unit: string;
  min?: string;
  max?: string;
  description?: string;
};

/**
 * Flashing Progress types
 */
export type FlashingProgress = {
  mainProgress: number;
  subProgress: number;
  status: string;
  message?: string;
};

export type FlashingState = {
  status: "idle" | "inprogress" | "success" | "error" | "DONE";
  mainProgress: number;
  subProgress: number;
  message: string;
};

/**
 * VIN related types
 */
export type VINInfo = {
  vinNumber: string;
  isValid: boolean;
  vehicleModel?: string;
};

/**
 * BIN related types
 */
export type BINInfo = {
  binNumber: string;
  isValid: boolean;
};

/**
 * Motor Type types
 */
export type MotorType = "LRE" | "HRE";

export type MotorTypeData = {
  type: MotorType;
  value: string;
  isWritten: boolean;
};
