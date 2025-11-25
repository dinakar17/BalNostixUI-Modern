/**
 * Controllers Screen
 *
 * Main screen displaying available vehicle ECUs (Electronic Control Units).
 * Handles:
 * - Auto-triggering offline analytics collection for VCU/BMS on launch
 * - Manual ECU selection for diagnostics/operations
 * - Config reset and basic info reading workflow
 */

import { useFocusEffect } from "@react-navigation/native";
import { captureMessage } from "@sentry/react-native";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  BackHandler,
  NativeEventEmitter,
  NativeModules,
  ScrollView,
  View,
} from "react-native";

import { cpu } from "@/assets/images";
import type { TileItem } from "@/components/tiles/tile";
import { Tiles } from "@/components/tiles/tiles";
import { CustomHeader } from "@/components/ui/header";
import { OverlayLoading, OverlayView } from "@/components/ui/overlay";
import {
  cleanupOldCollectionData,
  isCollectionNeeded,
} from "@/lib/offline-analytics";
import { toastError } from "@/lib/toast";
import { handleJsonParse } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import type { ControllerData } from "@/store/bluetooth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";
import type { ECURecord } from "@/types";
import type { UpdateUINotification } from "@/types/update-ui.types";

const { BluetoothModule, USBModule } = NativeModules;

let isConfigResetInProgress = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an ECU should trigger offline analytics collection
 */
function isTargetECUForCollection(ecuName: string): boolean {
  const name = ecuName.toLowerCase();
  return name.includes("vcu") || name.includes("bms");
}

export default function ControllersScreen() {
  const { dataTransferMode } = useAuthStore();
  const {
    controllersData,
    isDonglePhase3State,
    vin,
    isDongleStuckInBoot,
    setSelectedEcu,
    setControllersUpdatedData,
    disconnectFromDevice,
    updateDongleToDisconnected,
    updateIsDongleStuckInBoot,
    updateIsDongleDeviceInfoSet,
  } = useDataTransferStore();

  const [showDisconnectOverlay, setShowDisconnectOverlay] = useState(false);
  const [isCollectionMode, setIsCollectionMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEcuIndex, setSelectedEcuIndex] = useState<number | null>(null);
  const [eventEmitter, setEventEmitter] = useState<NativeEventEmitter | null>(
    null
  );

  // Derive controller tiles from controllersData - no need for separate state
  const controllersList: TileItem[] = controllersData.map((controller) => ({
    id: controller.index.toString(),
    name: controller.ecuName,
    image: cpu,
    function: () => setupECU(controller.index),
    isActive: true,
  }));

  // ============================================
  // ECU Configuration & Info Reading
  // ============================================

  /**
   * Reset ECU configuration and handle special cases (Dongle self-flash)
   */
  const resetECUConfig = async (ecuIndex: number): Promise<void> => {
    try {
      const ecu = controllersData[ecuIndex];
      // Note: This is never found since we don't have Dongle Record in VNSM server
      const isDongle = ecu.ecuName.toLowerCase().includes("dongle");

      console.log(`[Controllers] Resetting config for: ${ecu.ecuName}`);

      // Special handling for Dongle in USB mode
      if (isDongle && dataTransferMode === "USB" && !isDongleStuckInBoot) {
        console.log("[Controllers] Starting dongle self-flash");
        BluetoothModule.startSelfFlash(ecuIndex);
        updateIsDongleDeviceInfoSet(true);
        return;
      }

      // Normal config reset
      if (!isDongleStuckInBoot) {
        BluetoothModule.resetConfig(ecuIndex);
      }

      // Stuck in boot mode - read basic info directly
      if (isDongleStuckInBoot && isDongle) {
        console.log("[Controllers] Dongle stuck in boot, reading basic info");
        // Read basic ECU information via native module (Todo: readEcuBasicnfo needs to be renamed in the module)
        BluetoothModule.readEcuBasicnfo(ecuIndex);
      }

      // Wait for config reset with timeout
      isConfigResetInProgress = true;
      let elapsedTime = 0;
      const TIMEOUT_MS = 2000;

      while (isConfigResetInProgress && elapsedTime < TIMEOUT_MS) {
        await sleep(10);
        elapsedTime += 10;
      }

      if (elapsedTime >= TIMEOUT_MS) {
        console.log("[Controllers] Config reset timeout");

        captureMessage("Dongle not responding during config reset", {
          level: "error",
          tags: {
            operation: "config_reset_timeout",
            ecu_name: ecu.ecuName,
          },
          extra: {
            ecu_index: ecuIndex,
            is_dongle: isDongle,
            data_transfer_mode: dataTransferMode,
            is_stuck_in_boot: isDongleStuckInBoot,
            timeout_ms: TIMEOUT_MS,
          },
        });

        toastError("Dongle Not Responding", "Please disconnect and try again");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("[Controllers] Reset config failed:", error);
      setIsLoading(false);
    }
  };

  // ============================================
  // Offline Analytics Collection Logic
  // ============================================

  /**
   * Scan controllers for any that need offline analytics collection
   * Starts from specified index to allow resuming after previous collection
   */
  const scanForCollectionNeeds = async (
    vinNumber: string,
    startIndex = 0
  ): Promise<boolean> => {
    console.log(
      `[Controllers] Scanning for OA needs - Start: ${startIndex}, Total: ${controllersData.length} for VIN: ${vinNumber}`
    );

    for (let i = startIndex; i < controllersData.length; i++) {
      const ecu = controllersData[i];

      // Only check VCU/BMS controllers
      if (!isTargetECUForCollection(ecu.ecuName)) {
        continue;
      }

      console.log(`[Controllers] Checking ${ecu.ecuName} at index ${i}`);

      // Setup and check if collection needed
      const needsCollection = await setupECU(i, true);

      if (needsCollection) {
        console.log(`[Controllers] Collection needed for ${ecu.ecuName}`);
        return true;
      }
    }

    console.log("[Controllers] No collection needed");
    return false;
  };

  /**
   * Initialize offline analytics collection check on app launch
   * Cleans up old data and triggers collection if needed
   */
  const initializeCollectionCheck = async (
    vinNumber: string
  ): Promise<void> => {
    console.log(`[Controllers] Initializing OA check for VIN: ${vinNumber}`);

    // Clean up old records (keep only today's data)
    const hasStaleData = cleanupOldCollectionData();

    // Scan for any ECUs that need collection
    const needsCollection = await scanForCollectionNeeds(vinNumber);

    if (!(needsCollection || hasStaleData)) {
      setIsLoading(false);
    }

    setIsCollectionMode(needsCollection);
  };

  // ============================================
  // ECU Setup & Navigation
  // ============================================

  /**
   * Setup ECU for operations or offline analytics collection
   *
   * @param ecuIndex Index in controllersData array
   * @param checkCollectionNeeds If true, validates if OA collection is needed
   * @returns true if should navigate to collection screen, false otherwise
   */
  const setupECU = async (
    ecuIndex: number,
    checkCollectionNeeds = false
  ): Promise<boolean> => {
    try {
      console.log(`[Controllers] Setting up ECU at index: ${ecuIndex}`);

      isConfigResetInProgress = false;
      setIsLoading(true);
      setSelectedEcuIndex(ecuIndex);

      // Fetch UDS parameters for this ECU
      BluetoothModule.UDSParameter(ecuIndex);

      // Get updated ECU record with latest data
      const updatedECUData =
        await BluetoothModule.getUpdatedEcuRecords(ecuIndex);

      console.log(
        `[Controllers] ECU data fetched - Name: ${updatedECUData?.ecuName}, Supports OA: ${updatedECUData?.isEEDumpOperation}`
      );

      // Check if offline analytics collection is needed
      if (checkCollectionNeeds) {
        let needsCollection = false;
        let reason = "";

        // Check if ECU supports offline analytics
        if (!updatedECUData.isEEDumpOperation) {
          reason = "ECU does not support OA";
          console.log(
            `[OA] ⏭️  COLLECTION SKIPPED | VIN: ${vin} | ECU: ${updatedECUData.ecuName} | Reason: ${reason}`
          );
        } else if (updatedECUData.isForceEachTimeOA) {
          // Force collection if configured
          reason = "Force collection enabled for this ECU";
          needsCollection = true;
          console.log(
            `[OA] ✅ COLLECTION NEEDED | VIN: ${vin} | ECU: ${updatedECUData.ecuName} | Reason: ${reason}`
          );
        } else {
          // Check if collection is needed based on storage
          needsCollection = isCollectionNeeded(vin, updatedECUData.ecuName);
        }

        if (!needsCollection) {
          return false;
        }

        setIsCollectionMode(true);
      }

      // Update store with latest ECU data
      const updatedController = setControllersUpdatedData(
        controllersData,
        ecuIndex,
        updatedECUData as unknown as Partial<ControllerData>
      );

      if (updatedController) {
        setSelectedEcu(updatedController as unknown as ECURecord);
      }

      // Trigger config reset workflow
      await resetECUConfig(ecuIndex);

      return checkCollectionNeeds;
    } catch (error) {
      console.error("[Controllers] Setup ECU failed:", error);
      setIsLoading(false);
      return false;
    }
  };

  // ============================================
  // Native Module Event Handlers
  // ============================================

  /**
   * Handle updateUI events from native Bluetooth/USB modules
   */
  const handleNativeEvents = (response: {
    name: string;
    value?: string;
  }): void => {
    if (response.name !== "updateUI" || !response.value) {
      return;
    }

    console.log(`[Controllers] Native event received: ${response.value}`);

    try {
      const notification = handleJsonParse<UpdateUINotification>(
        response.value
      );

      if (typeof notification !== "object") {
        return;
      }

      switch (notification.value) {
        case "ConfigReset":
          handleConfigResetEvent();
          break;

        case "readEcuBasicnfo":
          handleBasicInfoReadEvent();
          break;

        case "BIOError":
          handleBasicInfoErrorEvent();
          break;

        case "Dongle_InBoot":
          handleDongleInBootEvent();
          break;

        default:
          console.log(`[Controllers] Unhandled event: ${notification.value}`);
      }
    } catch (error) {
      console.error("[Controllers] Event handler error:", error);
      setIsLoading(false);
    }
  };

  /**
   * Config reset completed - read basic ECU info
   */
  const handleConfigResetEvent = (): void => {
    console.log("[Controllers] Config reset completed");

    if (selectedEcuIndex !== null) {
      BluetoothModule.readEcuBasicnfo(selectedEcuIndex);
    }

    updateIsDongleStuckInBoot(false);
  };

  /**
   * Basic info read completed - determine next navigation
   */
  const handleBasicInfoReadEvent = (): void => {
    isConfigResetInProgress = false;
    setIsLoading(false);

    if (selectedEcuIndex === null) {
      return;
    }

    const selectedECU = controllersData[selectedEcuIndex];

    console.log(
      `[Controllers] Basic info read - ECU: ${selectedECU.ecuName}, Collection mode: ${isCollectionMode}`
    );

    // In collection mode - navigate to dump screen or continue scanning
    if (isCollectionMode) {
      if (selectedECU.isEEDumpOperation) {
        router.push("/(main)/diagnostics/ecu-dump");
        setIsCollectionMode(false);
      } else {
        // Continue scanning next controllers
        scanForCollectionNeeds(vin, selectedEcuIndex + 1);
      }
      return;
    }

    // Normal mode - navigate to operations screen
    router.push("/controllers/operations");
  };

  /**
   * Basic info operation error - stop loading
   */
  const handleBasicInfoErrorEvent = (): void => {
    console.log("[Controllers] Basic info read error");
    setIsLoading(false);
  };

  /**
   * Dongle is stuck in boot mode - navigate to flashing screen
   */
  const handleDongleInBootEvent = (): void => {
    console.log("[Controllers] Dongle in boot mode detected");
    router.push("/flashing/controller-flash");
  };

  // ============================================
  // User Actions
  // ============================================

  /**
   * Handle back button press - show disconnect confirmation
   */
  const handleBackButton = (): boolean => {
    setShowDisconnectOverlay(true);
    return true;
  };

  /**
   * Disconnect from device and reset state
   */
  const handleDisconnect = (): void => {
    if (dataTransferMode === "USB") {
      USBModule.resetUSBPermission();
    }

    if (isDonglePhase3State) {
      updateDongleToDisconnected();
    } else {
      disconnectFromDevice();
    }
  };

  // ============================================
  // Effects
  // ============================================

  /**
   * Initialize event emitter based on transfer mode
   */
  useEffect(() => {
    const emitter =
      dataTransferMode === "USB"
        ? new NativeEventEmitter(USBModule)
        : new NativeEventEmitter(BluetoothModule);

    setEventEmitter(emitter);
  }, [dataTransferMode]);

  /**
   * Subscribe to native events from Bluetooth/USB modules
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: dependencies are correct
  useEffect(() => {
    if (!eventEmitter) {
      return;
    }

    // Subscribe to native events
    const subscription = eventEmitter.addListener(
      "updateUI",
      handleNativeEvents
    );

    return () => {
      subscription.remove();
    };
  }, [eventEmitter, isCollectionMode, selectedEcuIndex]);

  /**
   * Initialize offline analytics check on mount
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: needed only on mount
  useEffect(() => {
    initializeCollectionCheck(vin);
  }, []);

  /**
   * Setup hardware back button handler
   */
  useFocusEffect(
    // biome-ignore lint/correctness/useExhaustiveDependencies: needed only on mount
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackButton
      );
      return () => subscription.remove();
    }, [])
  );

  return (
    <View className="flex-1 bg-gray-50">
      <CustomHeader
        leftButtonFunction={handleBackButton}
        leftButtonType="back"
        renderLeftButton={false}
        renderRightButton={isDonglePhase3State}
        rightButtonFunction={updateDongleToDisconnected}
        rightButtonType="settings"
        title="CONTROLLERS"
      />

      <ScrollView className="flex-1">
        <View className="mt-8 mb-8">
          <Tiles data={controllersList} gap={32} overlayText />
        </View>
      </ScrollView>

      {/* Disconnect Confirmation Overlay */}
      {/* Todo: Remove this later. Keep it in the layout file */}
      <OverlayView
        description="The dongle will be disconnected and the device has to be manually turned off and turned on to connect again"
        primaryButtonOnPress={handleDisconnect}
        primaryButtonText="Yes"
        title="Are you sure?"
        visible={showDisconnectOverlay}
        whiteButtonOnPress={() => setShowDisconnectOverlay(false)}
        whiteButtonText="Cancel"
      />

      <OverlayLoading loading={isLoading} />
    </View>
  );
}
