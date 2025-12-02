import dayjs from "dayjs";
import { Directory, File, Paths } from "expo-file-system";
import { createMMKV } from "react-native-mmkv";
import { zip } from "react-native-zip-archive";
import useSWRMutation from "swr/mutation";
import { ENV } from "@/config/env";

const storage = createMMKV();

type BaseResponse = {
  error: number;
  message: string;
};

interface UploadAppLogsResponse extends BaseResponse {}

interface PostFlashSuccessResponse extends BaseResponse {}

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

type PostFlashSuccessParams = {
  serialNumber: string;
  vinNumber: string;
  hexFileName: string;
};

type UploadEeDumpParams = Record<string, never>;

// Helper function to upload a single EE dump job using fetch
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
    // Ensure the file path has the file:// prefix
    const fileUri = job.filePath.startsWith("file://")
      ? job.filePath
      : `file://${job.filePath}`;

    const file = new File(fileUri);

    // Check if file exists
    if (!file.exists) {
      console.log(`[DataTransferAPI] File not found: ${fileUri}`);
      return false;
    }

    const formData = new FormData();

    // Append file using the React Native FormData format
    formData.append("analyticsfile", {
      uri: fileUri,
      name: `${job.vin_number}_${dayjs().toISOString()}.zip`,
      type: "application/zip",
    } as any);

    formData.append("vin_number", job.vin_number);
    formData.append("ecu", job.ecu_name);
    formData.append("oa_status", job.status === "Success" ? "Pass" : "Fail");

    const response = await fetch(
      `${ENV.FMS_URL}/api/v4/analytics/upload-analytics`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type for FormData - fetch will set it automatically with boundary
        },
        body: formData,
      }
    );

    const data = await response.json();

    if (response.ok && data.message === "Success") {
      // Delete file after successful upload
      if (file.exists) {
        file.delete();
      }
      return true;
    }

    console.log("[DataTransferAPI] Upload failed:", data);
    return false;
  } catch (error) {
    console.error("[DataTransferAPI] Upload job error:", error);
    return false;
  }
};

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
    const logZipPath = `${documentPath}/logFile.zip`;

    // Check if directories exist using new API
    const balDir = new Directory(`file://${logBalPath}`);
    const appDir = new Directory(`file://${logAppPath}`);
    const balExists = balDir.exists;
    const appExists = appDir.exists;

    if (!(balExists || appExists)) {
      console.log("[DataTransferAPI] No logs found to upload");
      return {
        error: 0,
        message: "No logs found to upload",
      };
    }

    const logAllDir = new Directory(`file://${logAllPath}`);

    // Ensure BALAllLog directory exists
    if (!logAllDir.exists) {
      logAllDir.create();
    }

    // Zip individual log directories
    if (appExists) {
      const timestamp = dayjs().format("YYYY-MM-DDTHH-mm-ss-SSSZ");
      await zip(
        `file://${logAppPath}`,
        `file://${logAllPath}/BALAppLog_${timestamp}.zip`
      );
      // Delete original directory after zipping
      appDir.delete();
    }

    if (balExists) {
      const timestamp = dayjs().format("YYYY-MM-DDTHH-mm-ss-SSSZ");
      await zip(
        `file://${logBalPath}`,
        `file://${logAllPath}/BALLog_${timestamp}.zip`
      );
      // Delete original directory after zipping
      balDir.delete();
    }

    // Zip the entire BALAllLog directory
    await zip(`file://${logAllPath}`, `file://${logZipPath}`);

    console.log("[DataTransferAPI] Logs zipped, preparing upload:", {
      serialNumber: arg.serialNumber,
      vinNumber: arg.vinNumber,
      hexFile: arg.hexFile,
      zipPath: logZipPath,
    });

    // Upload the zipped file
    const formData = new FormData();
    formData.append("logfile", {
      uri: `file://${logZipPath}`,
      name: "logs.zip",
      type: "application/zip",
    } as any);
    formData.append("serial_number", arg.serialNumber);
    formData.append("vin_number", arg.vinNumber);
    formData.append("hexfile_name", arg.hexFile);

    const response = await fetch(
      `${ENV.FMS_URL}/api/v2/vin/hexfile/log/install`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type for FormData - fetch will set it automatically with boundary
        },
        body: formData,
      }
    );

    const data = await response.json();

    // Clean up files after upload attempt
    if (logAllDir.exists) {
      logAllDir.delete();
    }
    const zipFile = new File(`file://${logZipPath}`);
    if (zipFile.exists) {
      zipFile.delete();
    }

    if (response.ok && data.message === "Success") {
      console.log("[DataTransferAPI] App logs uploaded successfully");
      return {
        error: 0,
        message: data.message || "Logs uploaded successfully",
      };
    }

    console.log("[DataTransferAPI] App logs upload failed:", data);
    return {
      error: 1,
      message: data.message || "Upload failed",
    };
  } catch (error) {
    console.error("[DataTransferAPI] uploadAppLogs error:", error);

    // Clean up on error
    try {
      const documentPath = Paths.document.uri.replace("file://", "");
      const logAllPath = `${documentPath}/BALAllLog`;
      const logZipPath = `${documentPath}/logFile.zip`;

      const logAllDir = new Directory(`file://${logAllPath}`);
      if (logAllDir.exists) {
        logAllDir.delete();
      }

      const zipFile = new File(`file://${logZipPath}`);
      if (zipFile.exists) {
        zipFile.delete();
      }
    } catch (cleanupError) {
      console.error("[DataTransferAPI] Cleanup error:", cleanupError);
    }

    throw error;
  }
}

async function postFlashSuccessMutation(
  _url: string,
  { arg }: { arg: PostFlashSuccessParams }
): Promise<PostFlashSuccessResponse> {
  const { useAuthStore } = await import("@/store/auth-store");
  const { userInfo } = useAuthStore.getState();
  const token = userInfo?.token;

  if (!token) {
    throw new Error("No authentication token available");
  }

  try {
    const response = await fetch(`${ENV.FMS_URL}/api/v4/vin/hexfile/install`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        serial_number: arg.serialNumber,
        vin_number: arg.vinNumber,
        hexfiles: [
          {
            hexfile_name: arg.hexFileName,
            status: "1",
            logfile: "",
            comments: "Done",
          },
        ],
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("[DataTransferAPI] Flash success posted successfully");
      return {
        error: 0,
        message: data.message || "Flash success posted",
      };
    }

    if (response.status === 401) {
      return {
        error: 401,
        message: "Unauthorized",
      };
    }

    console.log("[DataTransferAPI] Post flash success failed:", data);
    return {
      error: 1,
      message: data.message || "Post failed",
    };
  } catch (error) {
    console.error("[DataTransferAPI] postFlashSuccess error:", error);
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
      console.log("[OADataUpload] No EE dump jobs found to upload");
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

    console.log(
      `[DataTransferAPI] Starting EE dump upload: ${totalJobs} job(s) pending`
    );

    for (const job of jobs) {
      // Check if file exists using new API
      const fileUri = job.filePath.startsWith("file://")
        ? job.filePath
        : `file://${job.filePath}`;

      const file = new File(fileUri);

      if (!file.exists) {
        console.log(`[DataTransferAPI] File not found, skipping: ${fileUri}`);
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
      `[DataTransferAPI] EE dump upload complete: ${successCount} successful, ${failedJobs.length} failed${skippedCount > 0 ? `, ${skippedCount} skipped (file not found)` : ""}`
    );
    return {
      error: 0,
      message: "EE dump upload completed",
      successCount,
      failedCount: failedJobs.length,
      skippedCount,
    };
  } catch (error) {
    console.error("[DataTransferAPI] uploadEeDumpWithEcu error:", error);
    throw error;
  }
}

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
 * Hook for posting flash success to server
 * @returns SWR mutation hook with trigger function and state
 * @example
 * const { trigger, isMutating, error } = usePostFlashSuccess();
 * const result = await trigger({ serialNumber: "SN123", vinNumber: "VIN456", hexFileName: "file.hex" });
 */
export function usePostFlashSuccess() {
  return useSWRMutation<
    PostFlashSuccessResponse,
    Error,
    string,
    PostFlashSuccessParams
  >("/api/v4/vin/hexfile/install", postFlashSuccessMutation);
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

export type {
  UploadAppLogsResponse,
  PostFlashSuccessResponse,
  UploadEeDumpResponse,
  UploadAppLogsParams,
  PostFlashSuccessParams,
  UploadEeDumpParams,
};
