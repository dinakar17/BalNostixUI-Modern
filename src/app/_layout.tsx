import "../../global.css";
import "@/types/bluetooth.types";
import "@/types/usb.types";

import {
  feedbackIntegration,
  init,
  mobileReplayIntegration,
  wrap,
} from "@sentry/react-native";
import { Stack, useSegments } from "expo-router";
import { useEffect } from "react";
import Toast from "react-native-toast-message";
import { ENV } from "@/config/env";
import { toastConfig } from "@/lib/toast-config";

console.log(`App Environment: ${ENV.ENV_NAME}`);
console.log(`Sentry Enabled status: ${!ENV.IS_DEV}`);

// Initialize Sentry BEFORE wrap() to avoid warning
if (ENV.IS_DEV) {
  // Initialize Sentry in dev mode too, but with minimal config
  init({
    dsn: "https://60e054e9764332a263aa51e16758900a@o4504036848173056.ingest.us.sentry.io/4510406722387968",
    environment: "dev",
    enabled: false, // Disable sending events in dev
  });
} else {
  init({
    dsn: "https://60e054e9764332a263aa51e16758900a@o4504036848173056.ingest.us.sentry.io/4510406722387968",
    environment: ENV.ENV_NAME,
    sendDefaultPii: true,
    enableLogs: true,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [
      mobileReplayIntegration({
        maskAllText: false,
      }),
      feedbackIntegration(),
    ],
  });
}

export default wrap(function Layout() {
  const segments = useSegments();

  useEffect(() => {
    const currentScreen = segments.join("/");
    console.log(`📍 Current Screen: /${currentScreen}`);
  }, [segments]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <Toast config={toastConfig} />
    </>
  );
});
