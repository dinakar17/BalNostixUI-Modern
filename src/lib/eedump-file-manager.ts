/**
 * EEDUMP File Management
 *
 * Handles file operations for ECU dump data including:
 * - Cleanup of previous dump attempts
 * - Zip file creation
 * - Job queue management
 */

import dayjs from "dayjs";
import { Directory, File, Paths } from "expo-file-system";
import { createMMKV } from "react-native-mmkv";
import { zip } from "react-native-zip-archive";

// ============================================
// Types
// ============================================

export type EEDumpJob = {
  filePath: string;
  time: string;
  vin_number: string;
  ecu_name: string;
  status: "Success" | "Failure";
};

// ============================================
// Constants
// ============================================

const STORAGE_KEY_JOBS = "eeDumpJobs";
const EEDUMP_FOLDER_NAME = "EEDUMP";
const JOBS_FOLDER_NAME = "EE_DUMP_Jobs";

// Initialize storage
const storage = createMMKV();

// ============================================
// Path Utilities
// ============================================

/**
 * Get EEDUMP folder path (where native module writes raw dump data)
 */
export function getEEDumpPath(): string {
  const documentPath = Paths.document.uri.replace("file://", "");
  return documentPath.replace("files", EEDUMP_FOLDER_NAME);
}

/**
 * Get jobs folder path (where zipped files are queued for upload)
 */
export function getJobsFolderPath(): string {
  const documentPath = Paths.document.uri.replace("file://", "");
  return `${documentPath}/${JOBS_FOLDER_NAME}`;
}

// ============================================
// EEDUMP Cleanup
// ============================================

/**
 * Delete all files in the EEDUMP folder from previous collection attempts
 * This ensures a clean state before starting a new collection
 */
export function cleanupPreviousEEDump(): void {
  try {
    const eeDumpPath = getEEDumpPath();
    const eeDumpDir = new Directory(`file://${eeDumpPath}`);

    if (eeDumpDir.exists) {
      const items = eeDumpDir.list();
      console.log(
        `[EEDUMP] Cleaning up ${items.length} file(s) from previous attempt`
      );

      for (const item of items) {
        if (item instanceof File) {
          item.delete();
          console.log(`[EEDUMP] Deleted: ${item.name}`);
        }
      }
    } else {
      console.log("[EEDUMP] No previous dump folder found, skipping cleanup");
    }
  } catch (error) {
    console.log("[EEDUMP] Cleanup error (non-fatal):", error);
  }
}

// ============================================
// EEDUMP Existence Check
// ============================================

/**
 * Check if EEDUMP folder exists and contains files
 */
export function hasEEDumpFiles(): boolean {
  try {
    const eeDumpPath = getEEDumpPath();
    const eeDumpDir = new Directory(`file://${eeDumpPath}`);

    if (!eeDumpDir.exists) {
      return false;
    }

    const items = eeDumpDir.list();
    return items.length > 0;
  } catch (error) {
    console.log("[EEDUMP] Error checking files:", error);
    return false;
  }
}

// ============================================
// Job Queue Management
// ============================================

/**
 * Get all pending upload jobs from storage
 */
export function getPendingJobs(): EEDumpJob[] {
  try {
    const jobsStr = storage.getString(STORAGE_KEY_JOBS);
    if (!jobsStr) {
      return [];
    }
    return JSON.parse(jobsStr) as EEDumpJob[];
  } catch (error) {
    console.error("[EEDUMP] Failed to parse pending jobs:", error);
    return [];
  }
}

/**
 * Save jobs to storage
 */
export function savePendingJobs(jobs: EEDumpJob[]): void {
  try {
    storage.set(STORAGE_KEY_JOBS, JSON.stringify(jobs));
  } catch (error) {
    console.error("[EEDUMP] Failed to save pending jobs:", error);
  }
}

/**
 * Add a new job to the upload queue
 */
export function addJobToQueue(job: EEDumpJob): void {
  const currentJobs = getPendingJobs();
  const updatedJobs = [...currentJobs, job];
  savePendingJobs(updatedJobs);

  console.log(
    `[EEDUMP] Job queued - VIN: ${job.vin_number}, ECU: ${job.ecu_name}, Total jobs: ${updatedJobs.length}`
  );
}

/**
 * Remove a job from the queue (typically after successful upload)
 */
export function removeJobFromQueue(jobFilePath: string): void {
  const currentJobs = getPendingJobs();
  const updatedJobs = currentJobs.filter((job) => job.filePath !== jobFilePath);
  savePendingJobs(updatedJobs);

  console.log(
    `[EEDUMP] Job removed from queue - File: ${jobFilePath}, Remaining: ${updatedJobs.length}`
  );
}

// ============================================
// Zip Creation
// ============================================

/**
 * Create a zip file from EEDUMP folder and add it to upload queue
 *
 * @param vinNumber Vehicle identification number
 * @param ecuName ECU name
 * @param status Collection status (Success/Failure)
 * @returns true if zip created successfully, false otherwise
 */
export async function createZipAndQueueJob(
  vinNumber: string,
  ecuName: string,
  status: "Success" | "Failure"
): Promise<boolean> {
  try {
    // Ensure EEDUMP has files
    if (!hasEEDumpFiles()) {
      console.log("[EEDUMP] No files to zip");
      return false;
    }

    // Prepare paths
    const eeDumpPath = getEEDumpPath();
    const jobsFolderPath = getJobsFolderPath();
    const jobsDir = new Directory(`file://${jobsFolderPath}`);

    // Ensure jobs directory exists
    if (!jobsDir.exists) {
      jobsDir.create();
      console.log(`[EEDUMP] Created jobs directory: ${jobsDir.uri}`);
    }

    // Create zip file name
    const timestamp = dayjs().format("YYYY-MM-DD_HH:mm:ss");
    const zipFileName = `${timestamp}_${vinNumber}.zip`;
    const zipFilePath = `${jobsFolderPath}/${zipFileName}`;

    console.log(`[EEDUMP] Creating zip: ${zipFileName}`);

    // Create zip (react-native-zip-archive uses plain paths)
    await zip(eeDumpPath, zipFilePath);

    // Clean up source files after zipping
    cleanupPreviousEEDump();

    // Add to job queue
    const job: EEDumpJob = {
      filePath: zipFilePath,
      time: dayjs().format("YYYY-MM-DD_HH:mm:ss"),
      vin_number: vinNumber,
      ecu_name: ecuName,
      status,
    };

    addJobToQueue(job);

    console.log(`[EEDUMP] Zip created successfully: ${zipFileName}`);
    return true;
  } catch (error) {
    console.error("[EEDUMP] Failed to create zip:", error);
    return false;
  }
}
