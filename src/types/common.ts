/**
 * API Response types
 */

export type FMSApiResponse<T = any> = {
  error: number;
  message: string;
  data: T;
  token?: string;
};

export type SAPApiResponse = {
  response: {
    status: "S" | "E";
    message?: Array<{ error_text: string }>;
  };
};

export type AppVersionResponse = {
  version: string;
  isUpdateRequired: boolean;
  updateUrl?: string;
};

export type WhoAmIResponse = {
  token: string;
  error: number;
};

/**
 * Upload types
 */
export type AppLogUpload = {
  serialNumber: string;
  vinNumber: string;
  oldHexFileName: string;
  ecuName: string;
  logType: string;
};

export type EEDumpUpload = {
  dealerCode: string;
  serialNumber: string;
  ecuName: string;
  vinNumber: string;
};

/**
 * Dropdown types
 */
export type DropdownItem = {
  label: string;
  value: string;
};

/**
 * Toast types
 */
export type ToastType = "success" | "error" | "info";

export type ToastMessage = {
  type: ToastType;
  text1: string;
  text2?: string;
  visibilityTime?: number;
};

/**
 * Permission types
 */
export type PermissionStatus = "granted" | "denied" | "blocked";

export type AppPermissions = {
  bluetooth: PermissionStatus;
  location: PermissionStatus;
  storage: PermissionStatus;
  camera: PermissionStatus;
};
