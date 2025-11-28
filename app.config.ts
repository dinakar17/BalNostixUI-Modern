import type { ExpoConfig } from "expo/config";
import "tsx/cjs";

type Environment = "development" | "uat" | "production";

const APP_VARIANT =
  (process.env.EXPO_PUBLIC_APP_VARIANT as Environment) || "development";

const ENV_CONFIG = {
  development: {
    name: "DEV BALNOSTIX+",
    bundleIdentifier: "com.nostix.balnostix.dev",
    androidPackage: "com.nostix",
    scheme: "balnostix-dev",
  },
  uat: {
    name: "UAT BALNOSTIX+",
    bundleIdentifier: "com.nostix.balnostix.uat",
    androidPackage: "com.nostix.uat",
    scheme: "balnostix-uat",
  },
  production: {
    name: "BALNOSTIX+",
    bundleIdentifier: "com.nostix.balnostix.app",
    androidPackage: "com.nostix.app",
    scheme: "balnostix",
  },
} as const;

const currentConfig = ENV_CONFIG[APP_VARIANT];

console.log(`Using app config for variant: ${APP_VARIANT}`);

const config: ExpoConfig = {
  name: currentConfig.name,
  slug: "bal-nostix-ui",
  version: "1.0.0",
  scheme: currentConfig.scheme,
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
  icon: "./src/assets/ic_launcher.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./src/assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: currentConfig.bundleIdentifier,
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
    package: currentConfig.androidPackage,
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
  extra: {
    eas: {
      projectId: "9eedb854-ebab-4441-acbf-8f8638d87a2b",
    },
  },
};

export default config;
