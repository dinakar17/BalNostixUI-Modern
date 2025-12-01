import { NativeModules } from "react-native";
import { createMMKV } from "react-native-mmkv";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
  hasRehydrated: boolean;
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
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial State
      isSignedIn: false,
      isLoading: true,
      hasRehydrated: false,
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
            // Set default values on error
            if (state) {
              state.isLoading = false;
              state.isSignedIn = false;
              state.hasRehydrated = true;
            }
          } else if (state) {
            // Mark as rehydrated first
            state.hasRehydrated = true;
            // After rehydration, check token validity
            state.checkTokenValidity();
            console.log("Rehydration completed successfully");
          } else {
            // Handle case where state is undefined
            console.warn("Rehydration completed but state is undefined");
          }
        };
      },
    }
  )
);
