/**
 * Offline Analytics (OA) Collection Management
 *
 * This module handles the tracking and validation of offline analytics data
 * collected from vehicle ECUs (Electronic Control Units).
 */

import dayjs from "dayjs";
import { createMMKV } from "react-native-mmkv";

// ============================================
// Constants
// ============================================

/**
 * Collection status codes for offline analytics
 * Status 1 = Success, all other values indicate failure/retry needed
 */
export const OACollectionStatus = {
  /** Collection started (in progress) */
  STARTED: 0,
  /** Data collected successfully - no retry needed */
  SUCCESS: 1,
  /** Library error/failure - no retry (same result expected) */
  LIBRARY_ERROR: 2,
  /** Library error with negative code */
  LIBRARY_ERROR_NEG2: -2,
  /** UI exception - no retry */
  EXCEPTION: 3,
  /** Timeout (10+ minutes) - no retry */
  TIMEOUT_GENERAL: 4,
  /** Custom ECU timeout (no response within configured time) - no retry */
  TIMEOUT_NO_RESPONSE: 5,
  /** 10-minute max timeout from UI - no retry */
  TIMEOUT_MAX: 6,
} as const;

export type OACollectionStatusCode =
  (typeof OACollectionStatus)[keyof typeof OACollectionStatus];

/**
 * Storage structure for offline analytics collection data
 * Organized by VIN -> ECU Name -> Collection Record
 */
export type OACollectionData = {
  [vinNumber: string]: {
    [ecuName: string]: {
      /** Date of last collection attempt (YYYY-MM-DD) */
      oaDate: string;
      /** Status code of collection attempt */
      oaDataStatus: OACollectionStatusCode;
    };
  };
};

// ============================================
// Storage Key Constants
// ============================================

const STORAGE_KEY_OAC = "jsonDataOAC";

// Initialize MMKV storage
const storage = createMMKV();

// ============================================
// Storage Operations
// ============================================

/**
 * Get offline analytics collection data from storage
 */
export function getOACollectionData(): OACollectionData {
  try {
    const data = storage.getString(STORAGE_KEY_OAC);
    if (!data) {
      return {};
    }
    return JSON.parse(data) as OACollectionData;
  } catch (error) {
    console.error("[OA] Failed to parse collection data:", error);
    return {};
  }
}

/**
 * Save offline analytics collection data to storage
 */
export function saveOACollectionData(data: OACollectionData): void {
  try {
    storage.set(STORAGE_KEY_OAC, JSON.stringify(data));
  } catch (error) {
    console.error("[OA] Failed to save collection data:", error);
  }
}

/**
 * Update collection status for a specific VIN and ECU
 */
export function updateCollectionStatus(
  vinNumber: string,
  ecuName: string,
  status: OACollectionStatusCode
): void {
  const data = getOACollectionData();
  const today = dayjs().format("YYYY-MM-DD");

  // Initialize nested structure if needed
  if (!data[vinNumber]) {
    data[vinNumber] = {};
  }

  data[vinNumber][ecuName] = {
    oaDate: today,
    oaDataStatus: status,
  };

  saveOACollectionData(data);

  console.log(
    `[OA] Updated status - VIN: ${vinNumber}, ECU: ${ecuName}, Status: ${status}, Date: ${today}`
  );
}

// ============================================
// Validation Logic
// ============================================

/**
 * Check if offline analytics collection is needed for a specific VIN and ECU
 *
 * Collection is needed if:
 * - No data exists
 * - Data is from a previous day
 * - Previous collection failed (status !== SUCCESS)
 *
 * @param vinNumber Vehicle identification number
 * @param ecuName ECU name (e.g., "VCU", "BMS")
 * @returns true if collection is needed, false if already collected successfully today
 */
export function isCollectionNeeded(
  vinNumber: string,
  ecuName: string
): boolean {
  const data = getOACollectionData();
  const today = dayjs().format("YYYY-MM-DD");

  // No data for this VIN
  if (!data[vinNumber]) {
    console.log(
      `[OA] ✅ COLLECTION NEEDED | VIN: ${vinNumber} | ECU: ${ecuName} | Reason: No data exists for this VIN`
    );
    return true;
  }

  // No data for this ECU
  if (!data[vinNumber][ecuName]) {
    console.log(
      `[OA] ✅ COLLECTION NEEDED | VIN: ${vinNumber} | ECU: ${ecuName} | Reason: No data exists for this ECU`
    );
    return true;
  }

  const record = data[vinNumber][ecuName];

  // Missing date or status
  if (!record.oaDate || record.oaDataStatus === undefined) {
    console.log(
      `[OA] ✅ COLLECTION NEEDED | VIN: ${vinNumber} | ECU: ${ecuName} | Reason: Incomplete record (missing date or status)`
    );
    return true;
  }

  // Data is from previous day
  if (record.oaDate !== today) {
    console.log(
      `[OA] ✅ COLLECTION NEEDED | VIN: ${vinNumber} | ECU: ${ecuName} | Reason: Outdated data (Last: ${record.oaDate}, Today: ${today})`
    );
    return true;
  }

  // Check if previous collection was successful
  const needsCollection = record.oaDataStatus !== OACollectionStatus.SUCCESS;
  const statusText = getStatusText(record.oaDataStatus);

  if (needsCollection) {
    console.log(
      `[OA] ✅ COLLECTION NEEDED | VIN: ${vinNumber} | ECU: ${ecuName} | Reason: Previous collection failed (Status: ${record.oaDataStatus} - ${statusText}, Date: ${record.oaDate})`
    );
  } else {
    console.log(
      `[OA] ⏭️  COLLECTION SKIPPED | VIN: ${vinNumber} | ECU: ${ecuName} | Reason: Already collected successfully today (Status: ${record.oaDataStatus} - ${statusText}, Date: ${record.oaDate})`
    );
  }

  return needsCollection;
}

/**
 * Get human-readable status text for OA collection status code
 */
function getStatusText(status: OACollectionStatusCode): string {
  switch (status) {
    case OACollectionStatus.STARTED:
      return "Started";
    case OACollectionStatus.SUCCESS:
      return "Success";
    case OACollectionStatus.LIBRARY_ERROR:
      return "Library Error";
    case OACollectionStatus.LIBRARY_ERROR_NEG2:
      return "Library Error (-2)";
    case OACollectionStatus.EXCEPTION:
      return "Exception";
    case OACollectionStatus.TIMEOUT_GENERAL:
      return "Timeout (General)";
    case OACollectionStatus.TIMEOUT_NO_RESPONSE:
      return "Timeout (No Response)";
    case OACollectionStatus.TIMEOUT_MAX:
      return "Timeout (Max 10min)";
    default:
      return `Unknown (${status})`;
  }
}

/**
 * Clean up old collection data (keep only today's records)
 * Returns true if any ECU needs collection after cleanup
 */
export function cleanupOldCollectionData(): boolean {
  const data = getOACollectionData();
  const today = dayjs().format("YYYY-MM-DD");
  let needsCollection = false;

  console.log("[OA] Cleaning up old collection data...");

  for (const vinNumber of Object.keys(data)) {
    const ecuNames = Object.keys(data[vinNumber]);

    for (const ecuName of ecuNames) {
      const record = data[vinNumber][ecuName];

      // Remove outdated records
      if (record.oaDate !== today) {
        console.log(
          `[OA] Removing outdated record - VIN: ${vinNumber}, ECU: ${ecuName}, Date: ${record.oaDate}`
        );
        delete data[vinNumber][ecuName];
        needsCollection = true;
      } else if (record.oaDataStatus !== OACollectionStatus.SUCCESS) {
        // Check if today's collection was successful
        needsCollection = true;
      }
    }

    // Clean up empty VIN entries
    if (Object.keys(data[vinNumber]).length === 0) {
      delete data[vinNumber];
    }
  }

  saveOACollectionData(data);

  console.log(
    `[OA] Cleanup complete - Collection needed: ${needsCollection}, VINs remaining: ${Object.keys(data).length}`
  );

  return needsCollection;
}

/**
 * Check if any VCU or BMS controllers need collection for the current vehicle
 */
export function hasAnyCollectionNeeded(
  vinNumber: string,
  ecuNames: string[]
): boolean {
  return ecuNames.some((ecuName) => {
    const isVcuOrBms =
      ecuName.toLowerCase().includes("vcu") ||
      ecuName.toLowerCase().includes("bms");

    if (!isVcuOrBms) {
      return false;
    }

    return isCollectionNeeded(vinNumber, ecuName);
  });
}
