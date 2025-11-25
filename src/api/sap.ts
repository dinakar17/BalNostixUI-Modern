import axios from "axios";
import { createMMKV } from "react-native-mmkv";
import { ENV } from "@/config/env";
import { checkIfNrcError } from "@/lib/utils";

// Configuration
const BASE_URL = ENV.SAP_URL;
const FLAVOR_NAME = ENV.FLAVOR_NAME;
const FAILED_REQUESTS_KEY = "sap_failed_requests";
const VIN_BIN_MAPPING_KEY = "sap_vin_bin_mapping";

// Initialize MMKV storage with V4 API
const storage = createMMKV({
  id: "sap-storage",
});

// Types
type SAPAuth = {
  username: string;
  password: string;
};

type BinUploadData = {
  bin: string;
  status: number;
};

type VinBinMapping = {
  bin: string;
  lastUpdated: string;
};

type FailedRequest = {
  request: {
    vin: string;
    data: Array<{ type: string; serial_num: string }>;
    source: string;
    partner: string;
    device_id: string;
    date: string;
    time: string;
    statusByApp: number | null;
  };
  failedAt?: string;
};

type SAPResponse = {
  response: {
    status: "S" | "E";
    message?: Array<{ error_text: string }>;
  };
  status?: number;
};

type UploadCallbacks = {
  onSuccess?: (data: unknown) => void;
  onError?: (error: unknown) => void;
};

// Set credentials based on flavor
let DEFAULT_AUTH: SAPAuth;
let DEFAULT_API_KEY: string;

if (FLAVOR_NAME === "dev" || FLAVOR_NAME === "uat") {
  DEFAULT_AUTH = {
    username: "piconn",
    password: "bajaj@123",
  };
  DEFAULT_API_KEY = ENV.SAP_API_KEY;
} else if (FLAVOR_NAME === "prod") {
  DEFAULT_AUTH = {
    username: "piconn",
    password: "Bajaj@1234",
  };
  DEFAULT_API_KEY = ENV.SAP_API_KEY;
}

/**
 * Get SAP API headers
 */
function getSAPHeaders(): Record<string, string> {
  const authString = Buffer.from(
    `${DEFAULT_AUTH.username}:${DEFAULT_AUTH.password}`
  ).toString("base64");
  return {
    "Content-Type": "application/json",
    "api-key": DEFAULT_API_KEY,
    Authorization: `Basic ${authString}`,
  };
}

/**
 * Get storage data with type safety
 */
function getStorageData<T>(key: string, defaultValue: T): T {
  try {
    const data = storage.getString(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error(`Error getting data from storage (${key}):`, error);
    return defaultValue;
  }
}

/**
 * Save storage data
 */
function saveStorageData(key: string, data: unknown): boolean {
  try {
    storage.set(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Error saving data to storage (${key}):`, error);
    return false;
  }
}

/**
 * Clear storage by key - V4 uses remove() instead of delete()
 */
function clearStorage(key: string, logMessage: string): void {
  try {
    storage.remove(key);
    console.log(logMessage);
  } catch (error) {
    console.error(`Error clearing storage (${key}):`, error);
  }
}

/**
 * Get last BIN for VIN
 */
function getLastBinForVin(vin: string): VinBinMapping | null {
  const vinBinMap = getStorageData<Record<string, VinBinMapping>>(
    VIN_BIN_MAPPING_KEY,
    {}
  );
  return vinBinMap[vin] || null;
}

/**
 * Save VIN-BIN mapping
 */
function saveVinBinMapping(vin: string, bin: string): boolean {
  const vinBinMap = getStorageData<Record<string, VinBinMapping>>(
    VIN_BIN_MAPPING_KEY,
    {}
  );
  vinBinMap[vin] = {
    bin,
    lastUpdated: new Date().toISOString(),
  };
  return saveStorageData(VIN_BIN_MAPPING_KEY, vinBinMap);
}

/**
 * Save failed request
 */
function saveFailedRequest(payload: FailedRequest): boolean {
  const requests = getStorageData<Record<string, FailedRequest>>(
    FAILED_REQUESTS_KEY,
    {}
  );
  const vin = payload.request.vin;

  requests[vin] = {
    ...payload,
    failedAt: new Date().toISOString(),
  };

  return saveStorageData(FAILED_REQUESTS_KEY, requests);
}

/**
 * Get failed requests
 */
function getFailedRequests(): FailedRequest[] {
  const requestsMap = getStorageData<Record<string, FailedRequest>>(
    FAILED_REQUESTS_KEY,
    {}
  );
  return Object.values(requestsMap);
}

/**
 * Retry failed requests
 */
async function retryFailedRequests(): Promise<{
  success: number;
  failed: number;
}> {
  const failedRequests = await getFailedRequests();

  if (failedRequests.length === 0) {
    console.log("[SAP] No failed SAP requests to retry.");
    return { success: 0, failed: 0 };
  }

  let successCount = 0;
  let failedCount = 0;
  const successfulVins: string[] = [];

  for (const request of failedRequests) {
    try {
      const response = await axios.post<SAPResponse>(BASE_URL, request, {
        headers: getSAPHeaders(),
        timeout: 5000,
      });

      if (
        response.status >= 200 &&
        response.status < 300 &&
        response.data.response.status === "S"
      ) {
        successfulVins.push(request.request.vin);
        // biome-ignore lint/style/useShorthandAssign: Avoiding increment operator
        successCount = successCount + 1;
      } else {
        // biome-ignore lint/style/useShorthandAssign: Avoiding increment operator
        failedCount = failedCount + 1;
        console.error("SAP Retry Failed - Non-success response:", {
          vin: request.request.vin,
          status: response.status,
          responseStatus: response.data?.response?.status,
          message: response.data?.response?.message,
        });
      }
    } catch (error: unknown) {
      // biome-ignore lint/style/useShorthandAssign: Avoiding increment operator
      failedCount = failedCount + 1;
      console.error("SAP Retry Failed - Request error:", {
        vin: request.request.vin,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Remove successful requests
  if (successfulVins.length > 0) {
    const requests = getStorageData<Record<string, FailedRequest>>(
      FAILED_REQUESTS_KEY,
      {}
    );
    for (const vin of successfulVins) {
      delete requests[vin];
    }
    saveStorageData(FAILED_REQUESTS_KEY, requests);
  }

  return { success: successCount, failed: failedCount };
}

/**
 * Send VIN component serial number directly
 */
// biome-ignore lint: SAP API requires 6 parameters for comprehensive payload
async function sendVinCompSerialDirect(
  vinNumber: string,
  binNumber: string,
  dealerCode: string,
  serialNumber: string,
  callbacks: UploadCallbacks = {},
  status: number | null = null
): Promise<SAPResponse | { message: string } | undefined> {
  // Check for duplicate
  const lastBinData = getLastBinForVin(vinNumber);

  if (lastBinData && lastBinData.bin === binNumber) {
    const message = "Same BIN already submitted, duplicate request skipped";
    callbacks.onSuccess?.({ message });
    return { message };
  }

  const payload: FailedRequest = {
    request: {
      vin: vinNumber,
      data: [{ type: "bin", serial_num: binNumber }],
      source: "nstx",
      partner: dealerCode,
      device_id: serialNumber,
      date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
      time: new Date().toTimeString().slice(0, 8).replace(/:/g, ""),
      statusByApp: status,
    },
  };

  try {
    const response = await axios.post<SAPResponse>(BASE_URL, payload, {
      headers: getSAPHeaders(),
      timeout: 5000,
    });

    if (response.status >= 200 && response.status < 300) {
      if (response.data.response.status === "S") {
        saveVinBinMapping(vinNumber, binNumber);
        callbacks.onSuccess?.(response.data);
        return response.data;
      }
      callbacks.onError?.(response.data);
      return response.data;
    }
    saveFailedRequest(payload);
    callbacks.onError?.(response.data);
    return response.data;
  } catch (err: unknown) {
    const error = err as {
      response?: { data?: { message?: string }; status?: number };
      message?: string;
      code?: string;
    };
    const errorMessage =
      error.response?.data?.message || error.message || "An error occurred";
    const isServerError =
      !error.response ||
      (error.response.status !== undefined && error.response.status >= 500) ||
      error.code === "ECONNABORTED" ||
      error.message === "Network Error";

    if (isServerError) {
      saveFailedRequest(payload);
    }

    callbacks.onError?.(errorMessage);
  }
}

/**
 * Upload BIN from JSON string
 */
// biome-ignore lint: SAP API requires 5 parameters for comprehensive payload
export async function uploadBINFromJSON(
  vinNumber: string,
  jsonString: string,
  dealerCode: string,
  serialNumber: string,
  callbacks: UploadCallbacks = {}
): Promise<SAPResponse | { message: string } | undefined> {
  const trimmedStatus = jsonString.trim();

  try {
    if (trimmedStatus.startsWith("{")) {
      const statusJson = JSON.parse(trimmedStatus);

      if (statusJson.BinUploadData) {
        const binUploadData: BinUploadData = JSON.parse(
          statusJson.BinUploadData
        );
        return await sendVinCompSerialDirect(
          vinNumber,
          binUploadData.bin,
          dealerCode,
          serialNumber,
          callbacks,
          binUploadData.status
        );
      }
      // No VCU or BMS record found
      return await sendVinCompSerialDirect(
        vinNumber,
        "",
        dealerCode,
        serialNumber,
        callbacks,
        6
      );
    }
    if (checkIfNrcError(trimmedStatus)) {
      // NRC response from ECU
      return await sendVinCompSerialDirect(
        vinNumber,
        "",
        dealerCode,
        serialNumber,
        callbacks,
        7
      );
    }
    // Unknown status format
    return await sendVinCompSerialDirect(
      vinNumber,
      "",
      dealerCode,
      serialNumber,
      callbacks,
      8
    );
  } catch (sapError) {
    callbacks.onError?.(sapError);
  }
}

/**
 * Clear all failed requests - V4 uses remove()
 */
function clearAllFailedRequests(): void {
  clearStorage(
    FAILED_REQUESTS_KEY,
    "Cleared all failed requests from SAP queue"
  );
}

/**
 * Clear VIN-BIN mappings - V4 uses remove()
 */
function clearVinBinMappings(): void {
  clearStorage(VIN_BIN_MAPPING_KEY, "Cleared all VIN-BIN mappings from cache");
}

/**
 * SAP retry utilities
 */
export const sapRetryUtils = {
  getFailedRequests,
  retryFailedRequests,
  clearAllFailedRequests,
  getLastBinForVin,
  clearVinBinMappings,
  getAllVinBinMappings: () =>
    getStorageData<Record<string, VinBinMapping>>(VIN_BIN_MAPPING_KEY, {}),
  getAllFailedRequests: () =>
    getStorageData<Record<string, FailedRequest>>(FAILED_REQUESTS_KEY, {}),
};
