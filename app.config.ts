import type { ExpoConfig } from "expo/config";
import "tsx/cjs";

const config: ExpoConfig = {
  name: "BAL Nostix",
  slug: "bal-nostix-ui",
  version: "1.0.0",
  scheme: "balnostix",
  platforms: ["ios", "android"],
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./src/assets/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "./plugins/withNativeModules",
      { aarPath: "native-modules/android/libs/BalDongleLib-debug.aar" },
    ],
    [
      "react-native-ble-plx",
      {
        isBackgroundEnabled: true,
        modes: ["peripheral", "central"],
        bluetoothAlwaysPermission:
          "Allow $(PRODUCT_NAME) to connect to Bluetooth devices for vehicle diagnostics",
        neverForLocation: false, // Set to true only if you never use location from BLE
      },
    ],
    ["react-native-ble-manager", {}],
    [
      "@sentry/react-native/expo",
      {
        url: "https://sentry.io/",
        project: "react-native",
        organization: "nothing-mh",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
  },
  orientation: "portrait",
  icon: "./src/assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./src/assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.nostix.balnostix",
    infoPlist: {
      NSBluetoothAlwaysUsageDescription:
        "This app requires Bluetooth to connect to vehicle diagnostic devices",
      NSBluetoothPeripheralUsageDescription:
        "This app requires Bluetooth to connect to vehicle diagnostic devices",
      NSLocationWhenInUseUsageDescription:
        "Location permission is required for Bluetooth scanning on iOS",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./src/assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.nostix",
    permissions: [
      // Bluetooth permissions (handled by react-native-ble-plx plugin, but kept for clarity)
      "BLUETOOTH",
      "BLUETOOTH_ADMIN",
      "BLUETOOTH_SCAN",
      "BLUETOOTH_CONNECT",
      "BLUETOOTH_ADVERTISE",
      // Location permissions (required for BLE scanning)
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      // Other app permissions
      "CAMERA",
      "WRITE_EXTERNAL_STORAGE",
      "READ_EXTERNAL_STORAGE",
    ],
  },
};

export default config;
