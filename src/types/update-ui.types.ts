/**
 * Type definitions for UpdateUI responses from native BluetoothModule
 * These responses come from the native layer's updateUI LiveData observer
 */

/**
 * Base response structure from jsonKeyValueString
 */
type UpdateUIResponse = {
  status: boolean; // true = success, false = error/failure
  value: string; // The actual data/message
  message?: string; // Optional additional message (3-param version)
};

/**
 * All possible value strings observed in the codebase
 */
type UpdateUIValue =
  // Connection & Initialization
  | "Connected"
  | "Not Connected"
  | "ConnectionLost"
  | "BIOError"
  | "Error"

  // ECU Operations
  | "readEcuBasicnfo"
  | "Done"

  // Configuration
  | "ConfigReset"
  | "update DID xml on server"
  | "start progress"

  // Dongle Operations
  | "KillBT_OK"
  | "Dongle_InBoot"
  | "Self_Flash_OK"

  // BIN Operations
  | "BinUploadData"

  // Serial/Version Info (dynamic strings)
  | string; // For serial numbers (SerialNo:...), version info, error details

/**
 * Success response when status is true
 */
export interface SuccessResponse extends UpdateUIResponse {
  status: true;
  value: UpdateUIValue;
}

/**
 * Error response when status is false
 */
export interface ErrorResponse extends UpdateUIResponse {
  status: false;
  value: string; // Error message or description
  message?: string; // Additional error context
}

/**
 * Union type for all possible UpdateUI responses
 */
export type UpdateUINotification = SuccessResponse | ErrorResponse;

/**
 * Type guard to check if response is a success
 */
export function isSuccessResponse(
  response: UpdateUINotification
): response is SuccessResponse {
  return response.status === true;
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(
  response: UpdateUINotification
): response is ErrorResponse {
  return response.status === false;
}
