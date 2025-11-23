import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  type EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  Text,
  View,
} from "react-native";

import { CustomHeader } from "@/components/ui/header";
import { useDataTransferStore } from "@/store/data-transfer-store";

const { BluetoothModule } = NativeModules;

export default function AnalyticsScreen() {
  const router = useRouter();
  const { selectedEcu, isDonglePhase3State } = useDataTransferStore();

  const [analyticsData, setAnalyticsData] = useState<unknown>(null);
  const eventSubscriptionRef = useRef<EmitterSubscription | null>(null);
  const isProcessingRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Complex setup with cleanup
  useEffect(() => {
    if (!selectedEcu) {
      router.push("/(main)/controllers/operations");
      return;
    }

    getAnalytics();

    return () => {
      if (eventSubscriptionRef.current) {
        eventSubscriptionRef.current.remove();
      }

      // const Module = dataTransferMode === "USB" ? USBModule : BluetoothModule;
      try {
        BluetoothModule.unSubscribeToAnalyticsGraph?.();
      } catch (error) {
        console.error("Error unsubscribing from analytics:", error);
      }
    };
  }, [selectedEcu]);

  const getAnalytics = async () => {
    try {
      // const Module = dataTransferMode === "USB" ? USBModule : BluetoothModule;

      // Subscribe to analytics updates
      const eventEmitter = new NativeEventEmitter(BluetoothModule);
      eventSubscriptionRef.current = eventEmitter.addListener(
        "analytics",
        (response: { name: string; value: unknown }) => {
          console.log("Analytics response:", response);
          if (response.name === "analytics") {
            setAnalyticsData(response);
            isProcessingRef.current = false;
          }
        }
      );

      // Start analytics graph subscription
      await BluetoothModule.subscribeToAnalyticsGraph();
      isProcessingRef.current = true;

      // Timeout mechanism
      const timeout = 10_000;
      const startTime = Date.now();

      while (isProcessingRef.current && Date.now() - startTime < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      if (isProcessingRef.current) {
        isProcessingRef.current = false;
        console.log("Analytics timeout");
      }
    } catch (error) {
      console.error("Analytics error:", error);
      isProcessingRef.current = false;
    }
  };

  const handleDisconnect = () => {
    // Handle dongle disconnect
    console.log("Disconnect dongle");
  };

  return (
    <View className="flex-1 bg-primaryBg">
      <CustomHeader
        leftButtonType="back"
        renderLeftButton
        renderRightButton={isDonglePhase3State}
        rightButtonFunction={handleDisconnect}
        rightButtonType="settings"
        title="Analytics"
      />

      <View className="flex-1 px-5 pt-5">
        {selectedEcu && (
          <View
            className="mb-5 rounded-2xl bg-white p-5"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="text-center font-primaryBold text-textPrimary text-xl">
              {selectedEcu.ecuName}
            </Text>
          </View>
        )}

        {analyticsData ? (
          <View
            className="rounded-2xl bg-white p-5"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="mb-3 font-primarySemiBold text-base text-textPrimary">
              Analytics Data
            </Text>
            <Text className="font-primaryRegular text-sm text-textSecondary">
              {JSON.stringify(analyticsData, null, 2)}
            </Text>
          </View>
        ) : (
          <View
            className="items-center rounded-2xl bg-white p-5"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="font-primaryRegular text-base text-textSecondary">
              Loading analytics data...
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
