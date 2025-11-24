import axios from "axios";
import { Directory, File, Paths } from "expo-file-system";
import { NativeModules } from "react-native";
import { createMMKV } from "react-native-mmkv";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ENV } from "@/config/env";

const { BluetoothModule } = NativeModules;

// Initialize MMKV storage
const storage = createMMKV();

// Zustand MMKV adapter
const mmkvStorage = {
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    storage.set(name, value);
  },
  removeItem: (name: string) => {
    storage.remove(name);
  },
};

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

export type UserInfo = {
  token: string;
  serial_number: string;
  dealer_code: string;
  tokenExpiryTime: Date;
};

type AuthState = {
  // State
  isSignedIn: boolean;
  isLoading: boolean;
  userInfo: UserInfo | null;
  isAppVersionVerified: boolean;
  isDataTransferModeSelected: boolean;
  dataTransferMode: "Bluetooth" | "USB" | "null";

  // Actions
  updateLoginStatus: (userInfo: UserInfo) => void;
  checkTokenValidity: () => void;
  appVersionVerification: () => void;
  handleLogout: () => void;
  dataTransferModeSelection: (
    modeName: "Bluetooth" | "USB" | "null"
  ) => Promise<void>;
  updateDataTransferSelectionState: () => void;
  uploadAppLogs: (
    serialNumber: string,
    vinNumber: string,
    hexFile: string
  ) => void;
  uploadEeDumpWithEcu: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial State
      isSignedIn: false,
      isLoading: true,
      userInfo: null,
      isAppVersionVerified: false,
      isDataTransferModeSelected: false,
      dataTransferMode: "null",

      // Update login status - Zustand persist middleware handles storage automatically
      updateLoginStatus: (userInfo: UserInfo) => {
        set({
          isSignedIn: true,
          userInfo,
          isLoading: false,
        });
      },

      // Check token validity after rehydration
      checkTokenValidity: () => {
        const { userInfo } = get();

        if (!userInfo) {
          set({ isSignedIn: false, isLoading: false });
          return;
        }

        try {
          const tokenExpiryTime = new Date(userInfo.tokenExpiryTime);
          const currentTime = new Date();
          const diff =
            (tokenExpiryTime.getTime() - currentTime.getTime()) / (1000 * 60);

          // If token expires in more than 10 minutes, user is logged in
          if (diff > 10) {
            set({
              isSignedIn: true,
              isLoading: false,
            });
          } else {
            // Token expired or expiring soon
            set({
              isSignedIn: false,
              userInfo: null,
              isLoading: false,
            });
          }
        } catch (error) {
          console.error("checkTokenValidity error:", error);
          set({
            isSignedIn: false,
            userInfo: null,
            isLoading: false,
          });
        }
      },

      // Mark app version as verified
      appVersionVerification: () => {
        set({ isAppVersionVerified: true });
      },

      // Logout user - Zustand persist middleware handles storage removal
      handleLogout: () => {
        set({
          isSignedIn: false,
          isLoading: false,
          userInfo: null,
          isAppVersionVerified: false,
        });
      },

      // Select data transfer mode (Bluetooth/USB)
      dataTransferModeSelection: async (
        modeName: "Bluetooth" | "USB" | "null"
      ) => {
        try {
          const mode = await BluetoothModule.setDataTransferMode(modeName);

          if (mode === "USB" || mode === "Bluetooth") {
            set({
              isDataTransferModeSelected: true,
              dataTransferMode: modeName,
            });
          } else if (mode === "null") {
            set({
              isDataTransferModeSelected: false,
              dataTransferMode: "null",
            });
          }
        } catch (error) {
          console.error("dataTransferModeSelection error:", error);
        }
      },

      // Reset data transfer mode selection
      updateDataTransferSelectionState: () => {
        set({
          dataTransferMode: "null",
          isDataTransferModeSelected: false,
        });
      },

      // Upload app logs to server
      uploadAppLogs: (
        serialNumber: string,
        vinNumber: string,
        hexFile: string
      ) => {
        try {
          const { userInfo } = get();
          if (!userInfo) {
            return;
          }

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
            return;
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
            serialNumber,
            vinNumber,
            hexFile,
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
        } catch (error) {
          console.error("uploadAppLogs error:", error);
        }
      },

      // Upload EE dump with ECU info
      // Note: eeDumpJobs is stored directly in MMKV (not in Zustand state)
      uploadEeDumpWithEcu: async () => {
        try {
          const { userInfo } = get();
          if (!userInfo) {
            return;
          }

          // Direct storage access is correct here since eeDumpJobs is not in Zustand state
          const presentJobMap = storage.getString("eeDumpJobs");
          if (!presentJobMap) {
            console.log("No EE dump jobs found to upload");
            return;
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

            const uploadSuccess = await uploadSingleJob(job, userInfo.token);
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
        } catch (error) {
          console.error("uploadEeDumpWithEcu error:", error);
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        isSignedIn: state.isSignedIn,
        userInfo: state.userInfo,
        isAppVersionVerified: state.isAppVersionVerified,
      }),
      onRehydrateStorage: () => {
        console.log("Starting rehydration...");
        return (state, error) => {
          if (error) {
            console.error("Rehydration error:", error);
            // Use the store's setState method directly
            useAuthStore.setState({ isLoading: false, isSignedIn: false });
          } else if (state) {
            // After rehydration, check token validity
            state.checkTokenValidity();
          }
        };
      },
    }
  )
);
