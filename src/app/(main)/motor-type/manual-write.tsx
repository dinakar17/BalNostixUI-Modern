import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  NativeEventEmitter,
  NativeModules,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PrimaryButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { ShadowBox } from "@/components/ui/shadow-box";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";
import { metrics } from "@/constants/metrics";
import { toastError } from "@/lib/toast";
import { checkIfNrcError } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";

const { BluetoothModule, USBModule } = NativeModules;

type WriteMotorTypeProgress = {
  status: "inprogress" | "Done";
  message: string;
};

export default function WriteMotorTypeScreen() {
  const params = useLocalSearchParams<{ ecuPosition?: string }>();
  const { dataTransferMode } = useAuthStore();
  const { selectedEcu, updateIsMotorTypeAlreadyWritten } =
    useDataTransferStore();

  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedValue, setScannedValue] = useState<string | null>(null);
  const [qrResult, setQrResult] = useState<"HRE" | "LRE" | "NULL" | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  const [ecuPosition, setEcuPosition] = useState(0);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [writeMotorTypeProgress, setWriteMotorTypeProgress] =
    useState<WriteMotorTypeProgress>({
      status: "Done",
      message: "",
    });
  const [isWriteMotorTypeSuccess, setisWriteMotorTypeSuccess] = useState(false);

  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const isWritingMotorTypeRef = useRef(false);

  // Get ECU position
  useEffect(() => {
    if (params.ecuPosition !== undefined) {
      setEcuPosition(Number.parseInt(params.ecuPosition, 10));
    } else if (selectedEcu?.index !== undefined) {
      setEcuPosition(selectedEcu.index);
    }
  }, [params, selectedEcu]);

  // Get write parameter on mount
  useEffect(() => {
    const getWriteParameter = async () => {
      try {
        if (!selectedEcu) {
          return;
        }
        const moduleToUse =
          dataTransferMode === "USB" ? USBModule : BluetoothModule;
        // biome-ignore lint/suspicious/noExplicitAny: USB module doesn't have getWriteParameter
        await (moduleToUse as any).getWriteParameter(selectedEcu.index);
      } catch (err) {
        console.log("Get write parameter error:", err);
        toastError("ECU isn't properly initialized");
      }
    };
    getWriteParameter();
  }, [selectedEcu, dataTransferMode]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (typeof data !== "string" || !data) {
      setQrResult("NULL");
      setScannedValue(null);
      setShowScanner(false);
      return;
    }

    setScannedValue(data);
    setShowScanner(false);

    // Determine motor type from scanned data
    if (!data || data === "null" || data === "") {
      setQrResult("NULL");
    } else {
      const upperData = data.toUpperCase();
      const hasHRE = upperData.includes("HRE");
      const hasLRE = upperData.includes("LRE");

      if (hasHRE) {
        setQrResult("HRE");
      } else if (hasLRE) {
        setQrResult("LRE");
      } else {
        setQrResult("HRE"); // Default to HRE
      }
    }
  };

  const startQRScanner = async () => {
    if (permission?.granted) {
      setShowScanner(true);
    } else {
      const result = await requestPermission();
      if (result.granted) {
        setShowScanner(true);
      } else {
        toastError("Camera permission is required to scan QR codes");
      }
    }
  };

  const closeScanner = React.useCallback(() => {
    setShowScanner(false);
  }, []);

  const getStatus = React.useCallback((message: unknown): string => {
    try {
      if (message == null) {
        return "";
      }
      const trimmedMessage = String(message).trim();
      if (trimmedMessage[0] === "{") {
        const json = JSON.parse(trimmedMessage);
        return String(json.value || message);
      }
      return String(message);
    } catch {
      console.log("Get status error:", message);
      return "";
    }
  }, []);

  const onUpdateUIResponse = React.useCallback(
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Motor type update handler requires conditional logic
    (response: unknown) => {
      try {
        const resp = response as { name: string; value: unknown };
        if (resp.name === "updateUI") {
          const responseString = getStatus(resp.value);

          if (
            responseString === "Rescan" ||
            responseString === "RescanWriteParam" ||
            responseString === "ResultPassWriteParam" ||
            responseString === "ResultFailWriteParam" ||
            responseString === "SuccessfullyWritten"
          ) {
            if (isWritingMotorTypeRef.current) {
              isWritingMotorTypeRef.current = false;

              let msgResult = "Write Motor Type was successful";
              let msgStatus: "Done" | "inprogress" = "Done";

              if (responseString === "ResultFailWriteParam") {
                msgResult =
                  "Operation Result reported by ECU is Fail, Please retry again!";
              } else if (responseString === "ResultPassWriteParam") {
                msgResult = "Operation Result reported by ECU is Success.";
                updateIsMotorTypeAlreadyWritten(true);
              } else if (responseString === "SuccessfullyWritten") {
                msgResult =
                  "Write Motor Type was successful.\\n\\nWaiting for the Operation Result...";
                msgStatus = "inprogress";
                isWritingMotorTypeRef.current = true;
              } else {
                updateIsMotorTypeAlreadyWritten(true);
              }

              setWriteMotorTypeProgress({
                status: msgStatus,
                message: msgResult,
              });

              if (!isWritingMotorTypeRef.current) {
                setIsWriting(false);
              }
            }
            setisWriteMotorTypeSuccess(true);
          } else if (
            checkIfNrcError(responseString) ||
            responseString === "TimeOutInWriteParam"
          ) {
            isWritingMotorTypeRef.current = false;
            setWriteMotorTypeProgress({
              status: "Done",
              message: `Write Motor Type failed - ${responseString}`,
            });
            setIsWriting(false);
          }
        }
      } catch (err) {
        console.log("UpdateUI response error:", err);
      }
    },
    [updateIsMotorTypeAlreadyWritten, getStatus]
  );

  useEffect(() => {
    const moduleToUse =
      dataTransferMode === "USB" ? USBModule : BluetoothModule;
    const eventEmitter = new NativeEventEmitter(moduleToUse);
    subscriptionRef.current = eventEmitter.addListener(
      "updateUI",
      onUpdateUIResponse
    );

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
    };
  }, [dataTransferMode, onUpdateUIResponse]);

  const writeMotorTypeWithResult = (motorType: "HRE" | "LRE" | "NULL") => {
    if (!motorType) {
      return;
    }

    try {
      setWriteMotorTypeProgress({
        status: "inprogress",
        message: "Write Motor Type is in progress",
      });
      setShowWriteModal(true);
      setIsWriting(true);

      const motorTypeValue = motorType === "LRE" ? "7" : "6"; // LRE = 7, HRE = 6

      const moduleToUse =
        dataTransferMode === "USB" ? USBModule : BluetoothModule;
      // biome-ignore lint/suspicious/noExplicitAny: USB module doesn't have getWriteDidParameter
      (moduleToUse as any).getWriteDidParameter(
        ecuPosition,
        "Motor_Type_Identification",
        motorTypeValue
      );

      isWritingMotorTypeRef.current = true;

      // Timeout mechanism
      let totalTime = 0;
      const waitTimeByDefault = 26_000;

      const checkTimeout = async () => {
        while (isWritingMotorTypeRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          if (totalTime > waitTimeByDefault) {
            isWritingMotorTypeRef.current = false;
            setWriteMotorTypeProgress({
              status: "Done",
              message: "Write Motor Type failed - Timeout",
            });
            setIsWriting(false);
            break;
          }
          totalTime += 10;
        }
      };
      checkTimeout();
    } catch (error) {
      console.log("Write Motor Type error:", error);
      setWriteMotorTypeProgress({
        status: "Done",
        message: "Failed to write Motor Type",
      });
      setIsWriting(false);
    }
  };

  const onWriteModelOkPress = () => {
    setShowWriteModal(false);
    if (isWriteMotorTypeSuccess) {
      router.back();
    }
  };

  const handleBackButton = React.useCallback(() => {
    if (showScanner) {
      closeScanner();
      return true;
    }
    return false;
  }, [showScanner, closeScanner]);

  useFocusEffect(
    React.useCallback(() => {
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackButton
      );

      return () => backHandler.remove();
    }, [handleBackButton])
  );

  const getResultColor = () => {
    switch (qrResult) {
      case "HRE":
        return colors.successGreen;
      case "LRE":
        return colors.warningOrange;
      case "NULL":
        return colors.darkGrey;
      default:
        return colors.primaryColor;
    }
  };

  if (showScanner) {
    return (
      <>
        <CameraView
          barcodeScannerSettings={{
            barcodeTypes: ["qr", "pdf417", "aztec", "code128"],
          }}
          facing="back"
          onBarcodeScanned={handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
        <CustomHeader
          leftButtonFunction={closeScanner}
          leftButtonType="back"
          renderLeftButton
          title="Scan QR Code"
        />
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerFrame} />
          <Text style={styles.scannerText}>
            Position the QR code within the frame
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <CustomHeader
        leftButtonType="back"
        renderLeftButton
        title="Write Motor Type"
      />

      <View style={styles.container}>
        <ShadowBox style={styles.scanSection}>
          <View style={styles.scanHeader}>
            <Icon color={colors.primaryColor} name="qrcode-scan" size={40} />
            <Text style={styles.scanTitle}>QR Code Scanner</Text>
          </View>

          {scannedValue ? (
            <View style={styles.resultContainer}>
              <View style={styles.resultHeader}>
                <Icon
                  color={colors.successGreen}
                  name="check-circle"
                  size={24}
                />
                <Text style={styles.resultTitle}>QR Code Scanned</Text>
              </View>

              <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>Scanned Value:</Text>
                <Text style={styles.scannedText}>{scannedValue}</Text>
              </View>

              <View
                style={[
                  styles.resultBox,
                  { backgroundColor: `${getResultColor()}20` },
                ]}
              >
                <Text style={styles.resultLabel}>Determined Type:</Text>
                <Text style={[styles.resultValue, { color: getResultColor() }]}>
                  {qrResult}
                </Text>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  onPress={startQRScanner}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>SCAN AGAIN</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.scanPrompt}>
              <Text style={styles.promptText}>
                Tap to scan QR code on motor
              </Text>
              <TouchableOpacity
                onPress={startQRScanner}
                style={styles.scanButton}
              >
                <LinearGradient
                  colors={["#009CDE", "#003087"]}
                  end={{ x: 0, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={styles.gradientButton}
                >
                  <Icon color="white" name="camera" size={24} />
                  <Text style={styles.scanButtonText}>SCAN QR CODE</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {qrResult && (
            <View style={styles.writeButton}>
              <PrimaryButton
                inactive={isWriting}
                onPress={() => writeMotorTypeWithResult(qrResult)}
                text={
                  qrResult === "NULL"
                    ? "CONFIRM NULL VALUE"
                    : `WRITE ${qrResult} MOTOR TYPE`
                }
              />
            </View>
          )}
        </ShadowBox>
      </View>

      {/* Write Progress Modal */}
      {showWriteModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalMessage}>
              {writeMotorTypeProgress.message}
            </Text>
            <View style={styles.modalButton}>
              <PrimaryButton
                inactive={writeMotorTypeProgress.status === "inprogress"}
                onPress={onWriteModelOkPress}
                text="Okay"
              />
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scanSection: {
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 20,
  },
  scanHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  scanTitle: {
    fontSize: 18,
    fontFamily: fonts.helveticaBold,
    marginLeft: 12,
  },
  scanPrompt: {
    alignItems: "center",
    paddingVertical: 15,
  },
  promptText: {
    fontSize: 16,
    fontFamily: fonts.helvetica,
    color: colors.lightText,
    marginBottom: 20,
  },
  scanButton: {
    width: "100%",
  },
  gradientButton: {
    flexDirection: "row",
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  scanButtonText: {
    color: colors.white,
    fontFamily: fonts.helveticaBold,
    fontSize: 16,
    marginLeft: 8,
  },
  resultContainer: {
    paddingVertical: 12,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 16,
    fontFamily: fonts.helveticaBold,
    marginLeft: 8,
  },
  resultBox: {
    backgroundColor: colors.lightGrey,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 14,
    fontFamily: fonts.helvetica,
    color: colors.lightText,
    marginBottom: 4,
  },
  scannedText: {
    fontSize: 16,
    fontFamily: fonts.helveticaBold,
    color: colors.primaryColor,
  },
  resultValue: {
    fontSize: 18,
    fontFamily: fonts.helveticaBold,
  },
  actionButtons: {
    marginTop: 16,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primaryColor,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.primaryColor,
    fontFamily: fonts.helveticaBold,
    fontSize: 16,
  },
  writeButton: {
    marginTop: 8,
  },
  scannerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: "transparent",
  },
  scannerText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: fonts.helveticaBold,
    marginTop: 20,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    width: metrics.width / 1.1,
    paddingVertical: 32,
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  modalMessage: {
    textAlign: "center",
    fontFamily: fonts.helveticaBold,
    fontSize: 18,
    marginBottom: 16,
  },
  modalButton: {
    marginTop: 8,
  },
});
