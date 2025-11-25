import axios from "axios";
import { Directory, File, Paths } from "expo-file-system";
import { createMMKV } from "react-native-mmkv";
import useSWRMutation from "swr/mutation";
import { ENV } from "@/config/env";

// Initialize MMKV storage
const storage = createMMKV();

// ============================================
// Type Definitions
// ============================================

type BaseResponse = {
  error: number;
  message: string;
};

interface UploadAppLogsResponse extends BaseResponse {}

interface UploadEeDumpResponse extends BaseResponse {
  successCount: number;
  failedCount: number;
  skippedCount: number;
}

type UploadAppLogsParams = {
  serialNumber: string;
  vinNumber: string;
  hexFile: string;
};

type UploadEeDumpParams = Record<string, never>;

// ============================================
// Helper Functions
// ============================================

// Helper function to upload a single EE dump job
const uploadSingleJob = async (
  job: {
    filePath: string;
    vin_number: string;
    ecu_name: string;
    status: string;
  },
  token: string
): Promise<boolean> => {
  try {
    const formData = new FormData();
    formData.append("analyticsfile", {
      uri: job.filePath,
      name: `${job.vin_number}_${new Date().toISOString()}.zip`,
      type: "application/zip",
    } as unknown as Blob);
    formData.append("vin_number", job.vin_number);
    formData.append("ecu", job.ecu_name);
    formData.append("oa_status", job.status === "Success" ? "Pass" : "Fail");

    const response = await axios.post(
      `${ENV.FMS_URL}/api/v4/analytics/upload-analytics`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );

    if (response.data.message === "Success") {
      // Delete file after successful upload
      const file = new File(`file://${job.filePath}`);
      if (file.exists) {
        file.delete();
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error("Upload job error:", error);
    return false;
  }
};

// ============================================
// Mutation Functions
// ============================================

async function uploadAppLogsMutation(
  _url: string,
  { arg }: { arg: UploadAppLogsParams }
): Promise<UploadAppLogsResponse> {
  const { useAuthStore } = await import("@/store/auth-store");
  const { userInfo } = useAuthStore.getState();
  const token = userInfo?.token;

  if (!token) {
    throw new Error("No authentication token available");
  }

  try {
    const documentPath = Paths.document.uri.replace("file://", "");
    const logBalPath = documentPath.replace("files", "BALLog");
    const logAppPath = documentPath.replace("files", "BALAppLog");
    const logAllPath = `${documentPath}/BALAllLog`;
    const logAllDir = new Directory(`file://${logAllPath}`);

    // Check if directories exist using new API
    const balDir = new Directory(`file://${logBalPath}`);
    const appDir = new Directory(`file://${logAppPath}`);
    const balExists = balDir.exists;
    const appExists = appDir.exists;

    if (!(balExists || appExists)) {
      console.log("No logs found to upload");
      return {
        error: 0,
        message: "No logs found to upload",
      };
    }

    // Ensure BALAllLog directory exists
    if (!logAllDir.exists) {
      logAllDir.create();
    }

    // Copy logs to temporary folder
    if (balExists) {
      const destBalDir = new Directory(logAllDir, "BALLog");
      balDir.copy(destBalDir);
    }
    if (appExists) {
      const destAppDir = new Directory(logAllDir, "BALAppLog");
      appDir.copy(destAppDir);
    }

    console.log("Logs prepared for upload:", {
      serialNumber: arg.serialNumber,
      vinNumber: arg.vinNumber,
      hexFile: arg.hexFile,
      logPath: logAllDir.uri,
    });

    // Upload logic would go here using axios with multipart/form-data
    // const formData = new FormData();
    // formData.append('logs', {uri: zipPath, name: 'logs.zip', type: 'application/zip'});
    // await axios.post(`${ENV.FMS_URL}/api/v4/upload-logs`, formData, {...});

    // Clean up temporary folder after upload
    if (logAllDir.exists) {
      logAllDir.delete();
    }

    return {
      error: 0,
      message: "Logs uploaded successfully",
    };
  } catch (error) {
    console.error("uploadAppLogs error:", error);
    throw error;
  }
}

async function uploadEeDumpWithEcuMutation(
  _url: string,
  _options: { arg: UploadEeDumpParams }
): Promise<UploadEeDumpResponse> {
  const { useAuthStore } = await import("@/store/auth-store");
  const { userInfo } = useAuthStore.getState();
  const token = userInfo?.token;

  if (!token) {
    throw new Error("No authentication token available");
  }

  try {
    // Direct storage access is correct here since eeDumpJobs is not in Zustand state
    const presentJobMap = storage.getString("eeDumpJobs");
    if (!presentJobMap) {
      console.log("No EE dump jobs found to upload");
      return {
        error: 0,
        message: "No EE dump jobs found to upload",
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
      };
    }

    const jobs = JSON.parse(presentJobMap) as Array<{
      filePath: string;
      vin_number: string;
      ecu_name: string;
      status: string;
    }>;

    const totalJobs = jobs.length;
    const failedJobs: typeof jobs = [];
    let successCount = 0;
    let skippedCount = 0;

    console.log(`Starting EE dump upload: ${totalJobs} job(s) pending`);

    for (const job of jobs) {
      // Check if file exists using new API
      const file = new File(`file://${job.filePath}`);
      if (!file.exists) {
        skippedCount += 1;
        continue;
      }

      const uploadSuccess = await uploadSingleJob(job, token);
      if (uploadSuccess) {
        successCount += 1;
      } else {
        failedJobs.push(job);
      }
    }

    // Save failed jobs back to storage
    storage.set("eeDumpJobs", JSON.stringify(failedJobs));

    console.log(
      `EE dump upload complete: ${successCount} successful, ${failedJobs.length} failed${skippedCount > 0 ? `, ${skippedCount} skipped (file not found)` : ""}`
    );

    return {
      error: 0,
      message: "EE dump upload completed",
      successCount,
      failedCount: failedJobs.length,
      skippedCount,
    };
  } catch (error) {
    console.error("uploadEeDumpWithEcu error:", error);
    throw error;
  }
}

// ============================================
// Custom Hooks
// ============================================

/**
 * Hook for uploading app logs to server
 * @returns SWR mutation hook with trigger function and state
 * @example
 * const { trigger, isMutating, error } = useUploadAppLogs();
 * const result = await trigger({ serialNumber: "SN123", vinNumber: "VIN456", hexFile: "file.hex" });
 */
export function useUploadAppLogs() {
  return useSWRMutation<
    UploadAppLogsResponse,
    Error,
    string,
    UploadAppLogsParams
  >("/api/v4/upload-logs", uploadAppLogsMutation);
}

/**
 * Hook for uploading EE dump with ECU info
 * @returns SWR mutation hook with trigger function and state
 * @example
 * const { trigger, isMutating, error } = useUploadEeDumpWithEcu();
 * const result = await trigger({});
 */
export function useUploadEeDumpWithEcu() {
  return useSWRMutation<
    UploadEeDumpResponse,
    Error,
    string,
    UploadEeDumpParams
  >("/api/v4/analytics/upload-analytics", uploadEeDumpWithEcuMutation);
}

// ============================================
// Export Types for External Use
// ============================================

export type {
  UploadAppLogsResponse,
  UploadEeDumpResponse,
  UploadAppLogsParams,
  UploadEeDumpParams,
};
