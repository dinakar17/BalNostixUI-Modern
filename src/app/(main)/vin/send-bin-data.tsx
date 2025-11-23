import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  NativeEventEmitter,
  NativeModules,
  Text,
  View,
} from "react-native";
import { uploadBINFromJSON } from "@/api/sap";
import { file } from "@/assets/images";
import { CustomHeader } from "@/components/ui/header";
import { ShadowBox } from "@/components/ui/shadow-box";
import { colors } from "@/constants/colors";
import { handleJsonParse } from "@/lib/utils";
import type { ControllerData } from "@/store/bluetooth-store";
import type { UserInfo } from "@/types";

const { BluetoothModule } = NativeModules;
const eventEmitter = new NativeEventEmitter(BluetoothModule);

export default function SendBinDataScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    controllersData?: string;
    vin?: string;
    userInfo?: string;
  }>();

  // Parse params
  const controllersData: ControllerData[] = params.controllersData
    ? JSON.parse(params.controllersData as string)
    : [];
  const vin = params.vin as string;
  const userInfo: UserInfo = params.userInfo
    ? JSON.parse(params.userInfo as string)
    : {};

  const [binDataListener, setBinDataListener] = useState<{
    remove: () => void;
  } | null>(null);
  const [resetConfigListener, setResetConfigListener] = useState<{
    remove: () => void;
  } | null>(null);
  const [binTimeoutId, setBinTimeoutId] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  const navigateToControllerScreen = useCallback(() => {
    router.replace("/(main)/controllers");
  }, [router]);

  // Clean up BIN data listeners and navigate
  const cleanupAndNavigate = useCallback(() => {
    if (binDataListener) {
      binDataListener.remove();
      setBinDataListener(null);
    }
    if (binTimeoutId) {
      clearTimeout(binTimeoutId);
      setBinTimeoutId(null);
    }
    BluetoothModule.unsubscribeToReadBinData();
    navigateToControllerScreen();
  }, [binDataListener, binTimeoutId, navigateToControllerScreen]);

  // Handle BIN data response
  const onBinDataResponse = useCallback(
    async (response: { name: string; value: string }) => {
      console.log("BIN data response received:", response);
      if (response.name !== "readBinData") {
        return;
      }

      try {
        console.log("BIN data response received (value):", response.value);

        // Clean up timeout as we received valid BIN data
        if (binTimeoutId) {
          clearTimeout(binTimeoutId);
          setBinTimeoutId(null);
        }

        if (!response.value || response.value === "null") {
          cleanupAndNavigate();
          return;
        }

        // Send to SAP API - payload preparation happens inside the API
        try {
          await uploadBINFromJSON(
            vin,
            response.value,
            userInfo?.dealer_code,
            userInfo?.serial_number,
            {
              onSuccess: (data: unknown) => {
                console.log("BIN data sent successfully to the api", data);
              },
              onError: (error: unknown) => {
                console.log("Error sending BIN data to the api:", error);
              },
            }
          );
        } catch (sapError) {
          console.log("Error sending BIN data to SAP:", sapError);
          // Don't block the flow even if SAP API fails
        }

        cleanupAndNavigate();
      } catch (error) {
        console.log("Error processing BIN data response:", error);
        cleanupAndNavigate();
      }
    },
    [binTimeoutId, cleanupAndNavigate, vin, userInfo]
  );

  // Handle config reset response
  const handleConfigResetResponse = useCallback(
    (
      response: { value: string },
      configListener: { remove: () => void },
      bmsRecord: ControllerData,
      vcuRecord: ControllerData
    ) => {
      try {
        const jsonData = handleJsonParse<{ value?: string }>(response.value);
        if (typeof jsonData === "object" && jsonData?.value === "ConfigReset") {
          console.log(
            "BMS Config reset successful, now subscribing to readBinData"
          );

          // Clean up the reset config listener
          configListener.remove();
          setResetConfigListener(null);

          // Now subscribe to readBinData events after successful reset
          BluetoothModule.subscribeToReadBinData(
            bmsRecord.index,
            vcuRecord.index
          );

          // Set up event listener for BIN data response
          const listener = eventEmitter.addListener(
            "readBinData",
            onBinDataResponse
          );

          // Store the listener reference for cleanup
          setBinDataListener(listener);

          // Start reading BIN data
          console.log("Starting BIN data read for VCU and BMS");
        }
      } catch (error) {
        console.log("Error handling config reset response:", error);
        configListener.remove();
        setResetConfigListener(null);
        if (binTimeoutId) {
          clearTimeout(binTimeoutId);
          setBinTimeoutId(null);
        }
        navigateToControllerScreen();
      }
    },
    [binTimeoutId, onBinDataResponse, navigateToControllerScreen]
  );

  // Send BIN data to SAP portal
  const sendBINToSAP = useCallback(async () => {
    try {
      // Set a master 20-second timeout for the entire BIN operation
      const timeoutId = setTimeout(() => {
        console.log(
          "BIN operation timeout after 20 seconds, proceeding with navigation"
        );
        navigateToControllerScreen();
        setBinTimeoutId(null);
      }, 20_000);

      // Store timeout ID for potential cleanup
      setBinTimeoutId(timeoutId);

      // Request BIN data from ECU records (VCU and BMS)
      const vcuRecord = controllersData.find((record) =>
        record.ecuName?.toLowerCase().includes("vcu")
      );
      const bmsRecord = controllersData.find((record) =>
        record.ecuName?.toLowerCase().includes("bms")
      );

      if (vcuRecord && bmsRecord) {
        // Reset the BMS controller config before reading BIN data
        console.log("Resetting BMS controller config before reading BIN data");
        BluetoothModule.resetConfig(bmsRecord.index);

        // Set up event listener for config reset response
        const configListener = eventEmitter.addListener(
          "updateUI",
          (response: { value: string }) => {
            handleConfigResetResponse(
              response,
              configListener,
              bmsRecord,
              vcuRecord
            );
          }
        );

        // Store the listener reference for cleanup
        setResetConfigListener(configListener);
      } else {
        // Upload the error to the SAP API
        console.log("VCU or BMS record not found");
        try {
          await uploadBINFromJSON(
            vin,
            JSON.stringify({}),
            userInfo?.dealer_code,
            userInfo?.serial_number,
            {
              onSuccess: (data: unknown) => {
                console.log("Error status sent successfully to the api", data);
              },
              onError: (error: unknown) => {
                console.log("Error sending error status to the api:", error);
              },
            }
          );
        } catch (error) {
          console.log("Failed to upload error status to SAP:", error);
        }
        if (binTimeoutId) {
          clearTimeout(binTimeoutId);
          setBinTimeoutId(null);
        }
        navigateToControllerScreen();
        throw new Error("Required ECU records not found");
      }
    } catch (error) {
      console.log("Error initiating BIN data read:", error);
      if (binTimeoutId) {
        clearTimeout(binTimeoutId);
        setBinTimeoutId(null);
      }
      navigateToControllerScreen();
    }
  }, [
    controllersData,
    vin,
    userInfo,
    binTimeoutId,
    handleConfigResetResponse,
    navigateToControllerScreen,
  ]);

  useFocusEffect(
    useCallback(() => {
      // Disable back button during BIN data processing
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        () => true
      );

      // Start BIN data sending process
      sendBINToSAP();

      // Cleanup function
      return () => {
        backHandler.remove();

        // Clean up all listeners
        if (binDataListener) {
          binDataListener.remove();
        }
        if (resetConfigListener) {
          resetConfigListener.remove();
        }
        if (binTimeoutId) {
          clearTimeout(binTimeoutId);
        }

        // Unsubscribe from BIN data
        try {
          BluetoothModule.unsubscribeToReadBinData();
        } catch (error) {
          console.log("Error unsubscribing from BIN data:", error);
        }
      };
    }, [binDataListener, resetConfigListener, binTimeoutId, sendBINToSAP])
  );

  return (
    <>
      <CustomHeader
        leftButtonType="back"
        renderLeftButton={true}
        title="SETTING UP"
      />
      <View className="flex-1 bg-light-white">
        <ShadowBox className="mx-[12.5%] my-[55.5%] flex-1 items-center justify-center rounded-[30px] bg-white">
          <View className="aspect-square w-[33.33%] items-center justify-center rounded-full border-2 border-[#006ad0]">
            <Image className="aspect-square w-[16.66%]" source={file} />
          </View>

          <Text className="mx-[10%] p-4.5 text-center font-helvetica-bold text-[#5d5d5d] text-lg leading-[30px]">
            Setting up initial configuration...
          </Text>

          <ActivityIndicator
            className="my-1.25"
            color={colors.primaryColor}
            size="large"
          />

          <View className="mt-2 items-center">
            <Text className="text-center font-helvetica-regular text-[#5d5d5d] text-sm">
              Please wait while we prepare everything
            </Text>
            <Text className="mt-3 text-center font-helvetica-bold text-[#006ad0] text-base">
              Please keep the vehicle on
            </Text>
          </View>
        </ShadowBox>
      </View>
    </>
  );
}
