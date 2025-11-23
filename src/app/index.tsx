import { Camera } from "expo-camera";
import { requestForegroundPermissionsAsync } from "expo-location";
import { requestPermissionsAsync } from "expo-media-library";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useVerifyAppVersion } from "@/api/auth";
import {
  backgroundImg,
  bajaj_logo,
  cancelImg,
  checkImg,
  reload,
  settingImg,
} from "@/assets/images/index";
import { PrimaryButton } from "@/components/ui/button";
import { OverlayView } from "@/components/ui/overlay";
import { ENV } from "@/config/env";
import { metrics } from "@/constants/metrics";
import { useAuthStore } from "@/store/auth-store";

const { BluetoothModule, USBModule } = NativeModules;
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

type PermissionStatus = {
  location: boolean;
  camera: boolean;
  storage: boolean;
  bluetooth: boolean;
};

const requestAllPermissions = async (): Promise<{
  granted: boolean;
  status: PermissionStatus;
  deniedPermissions: string[];
}> => {
  const status: PermissionStatus = {
    location: false,
    camera: false,
    storage: false,
    bluetooth: false,
  };
  const deniedPermissions: string[] = [];

  try {
    // Request Location Permission (Fine + Coarse)
    const locationResult = await requestForegroundPermissionsAsync();
    status.location = locationResult.status === "granted";
    if (!status.location) {
      deniedPermissions.push("Location (required for Bluetooth scanning)");
    }

    // Request Camera Permission
    const cameraResult = await Camera.requestCameraPermissionsAsync();
    status.camera = cameraResult.status === "granted";
    if (!status.camera) {
      deniedPermissions.push("Camera");
    }

    // Request Storage Permission (Read/Write External Storage)
    const storageResult = await requestPermissionsAsync();
    status.storage = storageResult.status === "granted";
    if (!status.storage) {
      deniedPermissions.push("Storage (for reading/writing files)");
    }

    // Request Bluetooth Permissions (Android 12+)
    if (Platform.OS === "android") {
      const bluetoothPermissions = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      ];

      const bluetoothResults =
        await PermissionsAndroid.requestMultiple(bluetoothPermissions);

      const bluetoothGranted =
        bluetoothResults["android.permission.BLUETOOTH_CONNECT"] ===
          "granted" &&
        bluetoothResults["android.permission.BLUETOOTH_SCAN"] === "granted";

      status.bluetooth = bluetoothGranted;

      if (!status.bluetooth) {
        deniedPermissions.push("Bluetooth (required for device connection)");
      }
    } else {
      // iOS doesn't require explicit Bluetooth permissions
      status.bluetooth = true;
    }

    const allGranted =
      status.location && status.camera && status.storage && status.bluetooth;

    return {
      granted: allGranted,
      status,
      deniedPermissions,
    };
  } catch {
    return {
      granted: false,
      status,
      deniedPermissions: ["Unknown error occurred"],
    };
  }
};

const openSettings = async () => {
  await Linking.openSettings();
};

const isAuthError = (error: unknown): boolean =>
  error !== null &&
  typeof error === "object" &&
  "response" in error &&
  error.response !== null &&
  typeof error.response === "object" &&
  "status" in error.response &&
  error.response.status === 401;

const getErrorMessage = (error: unknown): string => {
  if (
    error !== null &&
    typeof error === "object" &&
    "response" in error &&
    error.response !== null &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data !== null &&
    typeof error.response.data === "object" &&
    "message" in error.response.data
  ) {
    return String(error.response.data.message);
  }
  return "Initialization failed";
};

export default function RootIndex() {
  const router = useRouter();
  const {
    appVersionVerification,
    checkTokenValidity,
    isLoading: isStoreLoading,
  } = useAuthStore();
  const { trigger: verifyVersion } = useVerifyAppVersion();
  const tokenCounts = useRef(0);

  const [loading, setLoading] = useState(true);
  const [isSuccess, setSuccess] = useState(false);
  const [isDenied, setIsDenied] = useState(false);
  const [bluetoothOverlay, setBluetoothOverlay] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [appVersionModal, setAppVersionModal] = useState(false);
  const tempRef = useRef(false);

  const checkPermissions = useCallback(async (): Promise<boolean> => {
    const permissionResult = await requestAllPermissions();

    if (!permissionResult.granted) {
      setIsDenied(true);
      setLoading(false);
      setErrorMessage(
        "All permissions are required to Login. Please Allow Permission"
      );
      tempRef.current = true;
      return false;
    }
    return true;
  }, []);

  const handleSuccessfulVerification =
    useCallback(async (): Promise<boolean> => {
      const initApplicationRes = await BluetoothModule.initApplication();
      if (!initApplicationRes) {
        setBluetoothOverlay(true);
        return false;
      }
      return true;
    }, []);

  const handleDeviceNotFound = useCallback(
    async (serial_number: string | undefined): Promise<boolean> => {
      if (serial_number) {
        setErrorMessage("Device not found!");
        setLoading(false);
        return false;
      }
      // No serial number, allow connection
      return await handleSuccessfulVerification();
    },
    [handleSuccessfulVerification]
  );

  const handleVerificationError = useCallback((error: unknown) => {
    const errorStr = String(error);
    if (errorStr.includes("timeout of 120000ms exceeded")) {
      setErrorMessage("Timeout, please check internet connection");
    } else if (errorStr.includes("Network Error")) {
      setErrorMessage("Please check internet connection");
    } else {
      setErrorMessage("Failed to verify app version");
    }
    setLoading(false);
  }, []);

  const verifyAppVersion = useCallback(async (): Promise<boolean> => {
    try {
      const { userInfo: storedUserInfo } = useAuthStore.getState();
      const serial_number = storedUserInfo?.serial_number;

      const response = await verifyVersion({
        serial_number: serial_number || "0",
        appversion: ENV.APP_VERSION,
      });

      if (response.message === "Success") {
        return await handleSuccessfulVerification();
      }
      if (response.error === -4) {
        setErrorMessage("App version did not match");
        setAppVersionModal(true);
        setLoading(false);
        return false;
      }
      if (response.error === -2) {
        return await handleDeviceNotFound(serial_number);
      }
      if (response?.response === "Permission denied") {
        setErrorMessage("Permission denied");
        setLoading(false);
        return false;
      }
      setErrorMessage(response.message || "Verification failed");
      setLoading(false);
      return false;
    } catch (error: unknown) {
      handleVerificationError(error);
      return false;
    }
  }, [
    verifyVersion,
    handleSuccessfulVerification,
    handleDeviceNotFound,
    handleVerificationError,
  ]);

  const initializeApp = useCallback(async () => {
    try {
      // Initialize native modules
      BluetoothModule.initIntentFilters();
      USBModule.initUSBCom();

      // Wait for Zustand store to rehydrate if needed
      if (isStoreLoading) {
        console.log("Waiting for store to rehydrate...");
        // Wait a bit for rehydration to complete
        await delay(100);
      }

      // Check token validity (validates persisted session)
      checkTokenValidity();

      // Check permissions
      const hasPermissions = await checkPermissions();
      if (!hasPermissions) {
        return;
      }

      // Verify app version
      const isVersionValid = await verifyAppVersion();
      if (!isVersionValid) {
        return;
      }

      // App version verification successful
      setSuccess(true);

      // Mark app as version verified
      appVersionVerification();

      // Get fresh login status after token validation
      const { isSignedIn: currentSignedInStatus } = useAuthStore.getState();

      // Navigate immediately based on login status
      if (currentSignedInStatus) {
        router.replace("/(main)");
      } else {
        router.replace("/(auth)");
      }
    } catch (error: unknown) {
      setLoading(false);

      if (isAuthError(error)) {
        if (tokenCounts.current < 3) {
          tokenCounts.current += 1;
          setTimeout(() => {
            initializeApp().catch(() => {
              // Error already handled in initializeApp
            });
          }, 1000);
        } else {
          setErrorMessage("Authentication failed. Please restart the app.");
        }
      } else {
        setErrorMessage(getErrorMessage(error));
      }
    }
  }, [
    isStoreLoading,
    checkTokenValidity,
    appVersionVerification,
    router,
    checkPermissions,
    verifyAppVersion,
  ]);

  const turnOnBluetooth = async () => {
    BluetoothModule.enableBluetooth();
    await delay(3000);
    await initializeApp();
  };

  const openBalAppUpgrader = () => {
    const uri = "upgrade://BalAppUpgrader";
    Linking.openURL(uri).catch((err: unknown) =>
      console.error("An error occurred", err)
    );
  };

  useEffect(() => {
    initializeApp().catch(() => {
      // Error already handled in initializeApp
    });
  }, [initializeApp]);

  // Verify Intro Component
  const VerifyIntro = () => (
    <>
      <View className="mb-8 self-center">
        <Image source={settingImg} />
      </View>
      <View>
        <Text className="mb-2 text-center font-bold text-base text-white">
          Verifying the application
        </Text>
        <Text className="text-center text-base text-white">Please wait</Text>
      </View>
    </>
  );

  // Success Intro Component
  const SuccessIntro = () => (
    <>
      <View className="mb-8 self-center">
        <Image
          source={checkImg}
          style={{ height: metrics.width / 5, width: metrics.width / 5 }}
        />
      </View>
      <View>
        <Text className="mb-2 text-center font-bold text-base text-white">
          Application verified successfully
        </Text>
        <Text className="text-center text-base text-white">
          Setting up the application ...
        </Text>
      </View>
    </>
  );

  // Failure Intro Component
  const FailureIntro = ({
    message,
    retry,
  }: {
    message: string;
    retry: () => void;
  }) => (
    <>
      <View className="mb-8 items-center justify-center">
        <Image source={cancelImg} />
      </View>

      <View className="items-center justify-center">
        <Text className="mb-2 text-center font-bold text-base text-white">
          {message}
        </Text>
      </View>
      <View className="items-center">
        <TouchableOpacity
          className="mt-4 flex-row items-center justify-center rounded-lg bg-white px-8 py-2.5"
          onPress={retry}
        >
          <Text className="mr-2 self-center text-black">Retry</Text>
          <Image
            className="h-4 w-4 self-center"
            source={reload}
            style={{ resizeMode: "contain" }}
          />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View className="flex-1">
      <Image
        className="absolute"
        source={backgroundImg}
        style={{
          width: metrics.width,
          height: metrics.height,
          resizeMode: "cover",
        }}
      />
      <View className="flex-1 items-center">
        <View
          className="items-center"
          style={{
            marginTop: metrics.height < 800 ? 55 : 100,
          }}
        >
          <Image
            source={bajaj_logo}
            style={{
              tintColor: "white",
              width: metrics.width,
              height: metrics.width / 3.5,
              resizeMode: "contain",
            }}
          />
        </View>

        <View className="flex-row items-center justify-center px-4">
          <Image
            source={require("../assets/images/nostix-logo.png")}
            style={{
              width: metrics.width / 1.8,
              height: metrics.width / 2,
              resizeMode: "contain",
            }}
          />
        </View>
        <View className="mb-16 flex-1 justify-end">
          {loading && <VerifyIntro />}
          {!loading && isSuccess && <SuccessIntro />}
          {loading || isSuccess ? null : (
            <FailureIntro message={errorMessage} retry={initializeApp} />
          )}
        </View>
      </View>

      {/* Bluetooth Overlay */}
      <Modal animationType="fade" transparent visible={bluetoothOverlay}>
        <View className="flex-1 items-center justify-center bg-black/50">
          <View className="max-w-[300px] rounded-lg bg-white p-5">
            <OverlayView
              description='This application requires bluetooth. Please click on "Turn On Bluetooth" to enable bluetooth'
              primaryButtonOnPress={() => {
                setLoading(true);
                setSuccess(false);
                setBluetoothOverlay(false);
                turnOnBluetooth();
              }}
              primaryButtonText="Turn On Bluetooth"
              renderOnlyPrimaryButton
              title="NOTE"
            />
          </View>
        </View>
      </Modal>

      {/* App Version Modal. Todo: This API isn't properly implemented yet*/}
      <Modal animationType="fade" transparent visible={appVersionModal}>
        <View className="flex-1 items-center justify-center bg-black/50">
          <View className="max-w-[300px] rounded-lg bg-white p-5">
            <OverlayView
              description="Current application version is not supported. Please contact service manager and install the latest application."
              primaryButtonOnPress={() => {
                setAppVersionModal(false);
                openBalAppUpgrader();
              }}
              primaryButtonText="Okay"
              renderOnlyPrimaryButton
              title="NOTE"
            />
          </View>
        </View>
      </Modal>

      {/* Permissions Denied Modal */}
      <Modal animationType="fade" transparent visible={isDenied}>
        <View className="flex-1 items-center justify-center bg-black/50">
          <View
            className="rounded-lg bg-white p-4"
            style={{ width: metrics.width - 40 }}
          >
            <Text className="mb-4 text-center text-sm">
              All permissions are required to continue.{"\n"}
              Please grant all permissions in Settings.
            </Text>
            <PrimaryButton
              onPress={async () => {
                await openSettings();
                // Don't dismiss modal - user must grant permissions
              }}
              text="Go to Settings"
            />
            <TouchableOpacity
              className="mt-4 rounded-lg bg-gray-200 px-4 py-3"
              onPress={async () => {
                setIsDenied(false);
                setLoading(true);
                await initializeApp();
              }}
            >
              <Text className="text-center text-black">Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
