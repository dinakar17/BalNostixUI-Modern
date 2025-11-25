import FIcon from "@expo/vector-icons/EvilIcons";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { Directory, File, Paths } from "expo-file-system";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  NativeEventEmitter,
  NativeModules,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { FMSApi } from "@/api/fms";
import { PrimaryButton, WhiteButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { OverlayView } from "@/components/ui/overlay";
import { toastError } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";
import type { ECURecord, ECURecordExtended } from "@/types/bluetooth.types";

const { BluetoothModule, TestModule } = NativeModules;

// Create event emitter once, outside component
const bluetoothEventEmitter = new NativeEventEmitter(BluetoothModule);

const URL_VALIDATION_PATTERN =
  /^(?:\w+:)?\/\/([^\s.]+\.\S{2}|localhost[:?\d]*)\S*$/;

let isReadVinInProcess = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ReadVINScreen() {
  const params = useLocalSearchParams<{ ScanCode?: string }>();

  const { userInfo, handleLogout } = useAuthStore();
  const {
    isDonglePhase3State,
    isDongleStuckInBoot,
    setControllersData,
    disconnectFromDevice,
    updateDongleToDisconnected,
    updateIsDonglePhase3State,
    setVin,
  } = useDataTransferStore();

  const [screenMode, setScreenMode] = useState<
    "ScanVin" | "EnterVin" | "ValidVin"
  >("ScanVin");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [vinNumber, setVinNumber] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [totalFilesToDownload, setTotalFilesToDownload] = useState(0);
  const [totalFilesDownloaded, setTotalFilesDownloaded] = useState(0);
  const [isLoadingBlueButton, setIsLoadingBlueButton] = useState(false);
  const [isReadVinFailed, setIsReadVinFailed] = useState(false);
  const [scanVinFailed, setScanVinFailed] = useState(false);
  const [isPinModalVisible, setIsPinModalVisible] = useState(false);
  const [overlayView, setOverlayView] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const pinInputRef = useRef<TextInput>(null);

  const outputDir = new Directory(Paths.document, "balDownload");
  const outputJsonFile = new File(
    Paths.document,
    "balDownload",
    "response.json"
  );

  // Check if dongle is Phase 3
  const checkDonglePhase = useCallback(async () => {
    try {
      const res = await BluetoothModule.isDonglePhase3();
      console.log(`[ReadVINScreen] Dongle Hardware is Phase 3: ${res}`);
      updateIsDonglePhase3State(res);
      return res;
    } catch (error) {
      toastError("It looks like you haven't connected to the dongle yet.");
      console.log("[ReadVINScreen] Error checking dongle phase:", error);
      return false;
    }
  }, [updateIsDonglePhase3State]);

  // Remove files from directory
  const removeFiles = (path: string) => {
    try {
      const dir = new Directory(path);
      if (dir.exists) {
        const items = dir.list();
        for (const item of items) {
          if (item instanceof File) {
            item.delete();
            console.log("RVS removed file:", item.uri);
          }
        }
      }
    } catch (error) {
      console.log("Error removing files:", error);
    }
  };

  // Read VIN from scanner
  const readVinFromScanner = async () => {
    try {
      setIsLoadingBlueButton(true);
      BluetoothModule.subscribeToReadVin();
      isReadVinInProcess = true;
      let totalTime = 0;

      while (isReadVinInProcess) {
        await sleep(10);
        if (totalTime > 4000) {
          toastError("Failed to read VIN");
          isReadVinInProcess = false;
          setIsReadVinFailed(true);
          setIsLoadingBlueButton(false);
          setScanVinFailed(true);
        } else {
          totalTime += 10;
        }
      }
    } catch (error) {
      console.log("Error reading VIN from scanner:", error);
      isReadVinInProcess = false;
      setIsReadVinFailed(true);
      setIsLoadingBlueButton(false);
      setScanVinFailed(true);
      toastError("Failed to read VIN");
    }
  };

  // Check if VIN is valid
  const checkIfValid = async () => {
    if (scanVinFailed) {
      const res = await BluetoothModule.isValidVin(vinNumber);
      console.log("isValidVin:", res);
      return res;
    }
    return true;
  };

  // Validate URL
  const validateURL = (url: string) => URL_VALIDATION_PATTERN.test(url);

  // Download file
  const downloadFile = async (url: string, outputFilePath: string) => {
    try {
      const file = new File(outputFilePath);
      const result = await File.downloadFileAsync(url, file);

      if (result.exists) {
        // Check if it's a JSON error response
        const content = await result.text();
        try {
          const json = JSON.parse(content);
          if (json.error) {
            result.delete();
          }
        } catch {
          // Not JSON, file is valid
        }
      }
    } catch (error) {
      console.log("Error downloading file:", error);
    }
  };

  // Verify VIN with PIN
  const verifyVinOtp = async () => {
    try {
      const isValidVin = await checkIfValid();
      console.log("isValidVin on verifyVinOtp:", isValidVin);
      if (!isValidVin) {
        setIsPinModalVisible(false);
        setScreenMode("EnterVin");
        toastError("Please enter a valid VIN number");
        return null;
      }

      // Clean up download directory
      if (outputDir.exists) {
        outputDir.delete();
      }
      outputDir.create();

      setIsLoading(true);
      const response = await FMSApi.post(
        "api/v4/get-vin-details",
        {
          serial_number: userInfo?.serial_number,
          vin: vinNumber,
          pin,
        },
        {
          headers: { Authorization: `Bearer ${userInfo?.token}` },
          timeout: 5000,
        }
      );

      const message = response.data.message;
      console.log(response.data);
      setIsLoading(false);
      setPin("");

      if (message === "Vehicle details retrieved successfully!") {
        await BluetoothModule.validateVIN(vinNumber);
        setIsPinModalVisible(false);

        // Start downloads
        setIsDownloading(true);

        const ecuRecords: ECURecord[] = await BluetoothModule.getEcuRecords(
          JSON.stringify(response.data),
          vinNumber
        );

        setTotalFilesToDownload(ecuRecords.length);

        const extendedEcuRecords: ECURecordExtended[] = [];

        for (const ecuRecord of ecuRecords) {
          const controllerObj = response?.data?.data?.controllers.find(
            (o: { name: string }) => o.name === ecuRecord.ecuName
          ) as { hexfiles: { is_update_required: boolean }[] } | undefined;

          let tempIsUpdateRequired = false;
          if (controllerObj) {
            for (const hexfile of controllerObj.hexfiles) {
              if (hexfile.is_update_required) {
                tempIsUpdateRequired = true;
              }
            }
          }

          // Create extended ECU record with is_update_required field
          const extendedEcuRecord: ECURecordExtended = {
            ...ecuRecord,
            is_update_required: tempIsUpdateRequired,
          };

          extendedEcuRecords.push(extendedEcuRecord);

          // Download files
          if (ecuRecord.appHexUrl && validateURL(ecuRecord.appHexUrl)) {
            await downloadFile(
              ecuRecord.appHexUrl,
              `${outputDir.uri}/${ecuRecord.appHexFileName}`
            );
          }
          if (ecuRecord.didsXmlUrl && validateURL(ecuRecord.didsXmlUrl)) {
            await downloadFile(
              ecuRecord.didsXmlUrl,
              `${outputDir.uri}/${ecuRecord.didsXmlFileName}`
            );
          }
          if (ecuRecord.dtcsXmlUrl && validateURL(ecuRecord.dtcsXmlUrl)) {
            await downloadFile(
              ecuRecord.dtcsXmlUrl,
              `${outputDir.uri}/${ecuRecord.dtcsXmlFileName}`
            );
          }
          if (ecuRecord.btlHexUrl && validateURL(ecuRecord.btlHexUrl)) {
            await downloadFile(
              ecuRecord.btlHexUrl,
              `${outputDir.uri}/${ecuRecord.btlHexFileName}`
            );
          }
          setTotalFilesDownloaded((prev) => prev + 1);
        }

        // Write response JSON
        outputJsonFile.write(JSON.stringify(response.data));

        // Clean up log paths
        const documentUri = Paths.document.uri;
        const logBalPath = documentUri.replace("files", "BALLog");
        const logAppPath = documentUri.replace("files", "BALAppLog");
        const eeDumpPath = documentUri.replace("files", "EEDUMP");

        const logBalDir = new Directory(logBalPath);
        const logAppDir = new Directory(logAppPath);
        const eeDumpDir = new Directory(eeDumpPath);

        if (logAppDir.exists) {
          logAppDir.delete();
        }
        if (logBalDir.exists) {
          logBalDir.delete();
        }
        if (eeDumpDir.exists) {
          removeFiles(eeDumpPath);
        }

        // Copy files to location
        const outputPath = outputDir.uri.replace("file://", "");
        const res = await TestModule.copyFilesToLocation(outputPath);

        if (outputDir.exists) {
          outputDir.delete();
        }

        if (res) {
          setControllersData(extendedEcuRecords);

          // Navigate to SendBINDataScreen to handle BIN data sending
          setIsDownloading(false);
          router.replace("/(main)/vin/send-bin-data");
        } else {
          toastError("Download failed please try again");
          setIsDownloading(false);
          setTotalFilesDownloaded(0);
        }
      } else {
        if (response.data.error !== 0) {
          setIsPinModalVisible(false);
          setScreenMode("EnterVin");
          console.log(response.data.error);
        }
        toastError(message);
      }
    } catch (error: unknown) {
      console.log(error);
      setIsDownloading(false);
      setIsLoading(false);
      setTotalFilesDownloaded(0);

      const err = error as {
        response?: { status?: number };
        code?: string;
        message?: string;
      };

      if (err?.response?.status === 401) {
        toastError("You've been inactive for a while, Please login again.");
        handleLogout();
        return null;
      }
      if (err?.code === "ECONNABORTED") {
        toastError("API timeout");
        return null;
      }
      if (err?.message === "Network Error") {
        toastError(
          "Server not reachable. Please check internet connection and try again"
        );
        return null;
      }
      toastError("Download failed please try again");
    }
  };

  // Verify PIN number
  const verifyNumber = () => {
    if (pin.length !== 6) {
      toastError("Please Enter 6 Digit PIN");
      return null;
    }
    verifyVinOtp();
  };

  // Handle PIN change
  const handlePinChange = (text: string) => {
    // Only allow numbers
    const numericText = text.replace(/[^0-9]/g, "");
    setPin(numericText);
  };

  // Handle proceed button
  const onClickProceed = () => {
    if (vinNumber.length < 17) {
      toastError("Please enter a valid VIN number");
    } else {
      setVin(vinNumber);
      setIsPinModalVisible(true);
      // Auto-focus on PIN input after modal opens
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
    }
  };

  // Handle closing PIN modal
  const closePinModal = () => {
    setPin("");
    setIsPinModalVisible(false);
    Keyboard.dismiss();
  };

  // Handle VIN found from Vehicle
  const onVinFound = useCallback(
    (data: { name: string; value: string | null }) => {
      console.log(`[ReadVINScreen] onVinFound: ${data.name} = ${data.value}`);
      if (
        data.name === "readVin" &&
        data.value != null &&
        data.value !== "null"
      ) {
        if (data.value.length === 17) {
          setVinNumber(data.value);
          setVin(data.value);
          setScreenMode("EnterVin");
          setScanVinFailed(false);
        } else {
          toastError(data.value);
          setIsReadVinFailed(true);
          setScanVinFailed(true);
        }
        setIsLoadingBlueButton(false);
        isReadVinInProcess = false;
      }
    },
    [setVin]
  );

  // Handle scanned VIN from params
  useEffect(() => {
    if (params?.ScanCode) {
      setVinNumber(params.ScanCode);
      setVin(params.ScanCode);
      setScreenMode("EnterVin");
    }
  }, [params?.ScanCode, setVin]);

  // Setup read VIN listener
  useEffect(() => {
    if (!isDownloading) {
      const readVinListener = bluetoothEventEmitter.addListener(
        "readVin",
        onVinFound
      );
      return () => {
        readVinListener.remove();
        BluetoothModule.unsubscribeToReadVin();
      };
    }
  }, [isDownloading, onVinFound]);

  // Handle dongle stuck in boot mode
  useEffect(() => {
    if (!isDownloading && isDongleStuckInBoot) {
      setVinNumber("MDXXXXXXXXXXXXVIN");
      setVin("MDXXXXXXXXXXXXVIN");
      setScreenMode("EnterVin");
      setScanVinFailed(false);
      console.log("set VIN on dongle Stuck In Boot");
    }
  }, [isDongleStuckInBoot, isDownloading, setVin]);

  // Initialize
  useEffect(() => {
    checkDonglePhase();
    BluetoothModule.deleteBalLogs();
  }, [checkDonglePhase]);

  // Keyboard listeners
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Handle back button
  const handleBackButton = useCallback(() => {
    setOverlayView(true);
    return true;
  }, []);

  const onBackPress = () => {
    if (isDownloading) {
      console.log("readVin back press while download is in progress");
    } else {
      console.log("readVin back press when no download");
      if (isDonglePhase3State) {
        // Phase 3
        updateDongleToDisconnected();
      } else {
        // Phase 1, 2
        disconnectFromDevice();
      }
    }
    return true;
  };

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackButton
      );
      return () => subscription.remove();
    }, [handleBackButton])
  );

  // Show download screen
  if (isDownloading) {
    return (
      <View className="flex-1 bg-gray-50">
        <CustomHeader
          leftButtonType="back"
          renderLeftButton={true}
          title="DOWNLOAD DATA"
        />
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-full items-center rounded-3xl bg-white p-8 shadow-lg">
            <View className="mb-6 h-32 w-32 items-center justify-center rounded-full border-2 border-blue-600">
              <Image
                className="h-16 w-16"
                source={require("@/assets/images/index").file}
              />
            </View>
            <Text className="px-4 text-center font-bold text-gray-600 text-lg leading-7">
              Downloading Data, Please Wait ....
            </Text>
            <View className="mt-6 items-center">
              <View className="h-2 w-64 overflow-hidden rounded-full bg-gray-200">
                <View
                  className="h-full bg-blue-600"
                  style={{
                    width: `${(totalFilesDownloaded / totalFilesToDownload) * 100}%`,
                  }}
                />
              </View>
              <Text className="mt-4 font-bold text-gray-600">
                Controllers : {totalFilesDownloaded}/{totalFilesToDownload}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <>
      <CustomHeader
        leftButtonFunction={handleBackButton}
        leftButtonType="back"
        onDisconnect={updateDongleToDisconnected}
        renderLeftButton={true}
        renderRightButton
        rightButtonType="menu"
        title="Read VIN"
      />

      {screenMode === "ScanVin" && (
        <View className="px-4 pt-6">
          <Text className="mb-6 text-center font-bold text-2xl">
            READ VEHICLE IDENTIFICATION NUMBER
          </Text>
          <View>
            <View className="mt-6 rounded-lg border border-gray-300 bg-gray-100 px-2 opacity-50">
              <TextInput
                className="px-2 py-3 font-bold text-black"
                editable={false}
                placeholder="VIN No"
                placeholderTextColor="#A0A0A0"
              />
            </View>
            <Text className="mt-1 text-right text-gray-500 text-sm">
              {vinNumber.length}/17
            </Text>
          </View>
          <View className="mt-8">
            <PrimaryButton
              isLoading={isLoadingBlueButton}
              onPress={readVinFromScanner}
              text="READ FROM VEHICLE"
            />
            <View className="my-4 flex-row items-center">
              <View className="h-px flex-1 bg-gray-300" />
              <Text className="px-2">OR</Text>
              <View className="h-px flex-1 bg-gray-300" />
            </View>
            <PrimaryButton
              inactive={!isReadVinFailed || isLoadingBlueButton}
              onPress={() => setScreenMode("EnterVin")}
              text="ENTER VIN NUMBER"
            />
          </View>
        </View>
      )}

      {screenMode === "EnterVin" && (
        <View className="px-4 pt-6">
          <Text className="mb-6 text-center font-bold text-2xl">
            READ VEHICLE IDENTIFICATION NUMBER
          </Text>
          <View>
            <View className="mt-6 rounded-lg border border-gray-300 bg-white px-2">
              <TextInput
                className="px-2 py-3 font-bold text-black"
                maxLength={17}
                onChangeText={setVinNumber}
                placeholder="VIN No"
                placeholderTextColor="#A0A0A0"
                value={vinNumber}
              />
            </View>
            <Text className="mt-1 text-right text-gray-500 text-sm">
              {vinNumber.length}/17
            </Text>
          </View>
          <View className="mt-8">
            <PrimaryButton
              isLoading={isLoadingBlueButton}
              onPress={onClickProceed}
              text="PROCEED"
            />
            <View className="my-4 flex-row items-center">
              <View className="h-px flex-1 bg-gray-300" />
              <Text className="px-2">OR</Text>
              <View className="h-px flex-1 bg-gray-300" />
            </View>
            <PrimaryButton
              onPress={() => router.push("/(main)/vin/scan-barcode")}
              text="SCAN VIN"
            />
          </View>
        </View>
      )}

      {screenMode === "ValidVin" && (
        <View className="px-4 pt-6">
          <Text className="mb-6 text-center font-bold text-2xl">
            READ VEHICLE IDENTIFICATION NUMBER
          </Text>
          <View>
            <View className="mt-6 rounded-lg border border-gray-300 bg-gray-100 px-2 opacity-50">
              <TextInput
                className="px-2 py-3 font-bold text-black"
                editable={false}
                placeholder="VIN No"
                placeholderTextColor="#A0A0A0"
                value={vinNumber}
              />
            </View>
            <Text className="mt-1 text-right text-gray-500 text-sm">
              {vinNumber.length}/17
            </Text>
          </View>
          <View className="mt-8">
            <PrimaryButton
              isLoading={isLoadingBlueButton}
              onPress={onClickProceed}
              text="PROCEED"
            />
          </View>
        </View>
      )}

      {/* PIN Modal */}
      {isPinModalVisible && (
        <View className="absolute inset-0 z-50 items-center justify-center bg-black/50">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="w-full items-center justify-center"
            style={{
              marginBottom: keyboardHeight > 0 ? keyboardHeight / 2 : 0,
            }}
          >
            <View className="w-[90%] rounded-lg bg-white p-6">
              <View className="items-center">
                <View className="mb-4 w-full flex-row items-center justify-center">
                  <Icon color="#4CAF50" name="shield-check" size={40} />
                  <FIcon
                    color="#000"
                    name="close"
                    onPress={closePinModal}
                    size={30}
                    style={{ position: "absolute", right: -8, padding: 8 }}
                  />
                </View>
                <Text className="mb-2 font-bold text-2xl">Verify PIN</Text>
                <Text className="mb-6 text-center text-gray-600">
                  Please enter the six digit Transaction PIN
                </Text>
              </View>
              <View className="mb-6">
                <TextInput
                  autoFocus={true}
                  className="rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-center font-bold text-black text-lg tracking-widest"
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={handlePinChange}
                  placeholder="••••••"
                  placeholderTextColor="#D1D5DB"
                  ref={pinInputRef}
                  returnKeyType="done"
                  secureTextEntry={true}
                  value={pin}
                />
                <Text className="mt-2 text-center text-gray-500 text-xs">
                  {pin.length}/6 digits
                </Text>
              </View>
              <WhiteButton
                isLoading={isLoading}
                onPress={verifyNumber}
                text="SUBMIT"
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Back Press Overlay */}
      {overlayView && (
        <View className="absolute inset-0 z-50 items-center justify-center bg-black/50">
          <View className="w-[90%] rounded-lg bg-white p-4">
            <OverlayView
              description="The dongle will be disconnected and the device has to be manually turned off and turned on to connect again"
              primaryButtonOnPress={onBackPress}
              primaryButtonText="Yes"
              title="Are you sure?"
              whiteButtonOnPress={() => setOverlayView(false)}
              whiteButtonText="Cancel"
            />
          </View>
        </View>
      )}
    </>
  );
}
