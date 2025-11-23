import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import { PrimaryButton } from "@/components/ui/button";

export default function ScanBarcodeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // Request camera permission on mount
  useEffect(() => {
    if (permission && !permission.granted && !permission.canAskAgain) {
      // Permission denied permanently
      Alert.alert(
        "Camera Permission Required",
        "Please enable camera access in your device settings to scan barcodes.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
    }
  }, [permission]);

  // Reset scanned state when screen is focused
  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      return () => {
        // Cleanup if needed
      };
    }, [])
  );

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    if (scanned) {
      return;
    }
    setScanned(true);

    // Navigate to ReadVIN screen with scanned code
    router.push({
      pathname: "/(main)/vin/read",
      params: { ScanCode: data },
    });
  };

  const handleRequestPermission = async () => {
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert(
        "Permission Denied",
        "Camera access is required to scan barcodes.",
        [{ text: "OK" }]
      );
    }
  };

  // Loading state
  if (permission === null) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-base text-gray-800">
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  // Permission not granted
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8">
        <Text className="mb-6 text-center text-base text-gray-800">
          Camera access is required to scan barcodes
        </Text>
        <PrimaryButton
          className="w-full"
          onPress={handleRequestPermission}
          text="Grant Permission"
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        barcodeScannerSettings={{
          barcodeTypes: [
            "qr",
            "pdf417",
            "aztec",
            "ean13",
            "ean8",
            "code39",
            "code93",
            "code128",
            "datamatrix",
            "itf14",
            "upc_a",
            "upc_e",
          ],
        }}
        className="absolute inset-0"
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={{ flex: 1 }}
      />

      {/* Overlay UI with absolute positioning */}
      <View className="absolute inset-0 flex-1" pointerEvents="none">
        {/* Top overlay */}
        <View className="flex-1 bg-black/60" />

        {/* Middle row with scan area */}
        <View className="h-[250px] flex-row">
          <View className="flex-1 bg-black/60" />
          <View className="relative h-[250px] w-[250px]">
            {/* Corner markers */}
            <View className="absolute top-0 left-0 h-10 w-10 border-[#006AD0] border-t-4 border-l-4" />
            <View className="absolute top-0 right-0 h-10 w-10 border-[#006AD0] border-t-4 border-r-4" />
            <View className="absolute bottom-0 left-0 h-10 w-10 border-[#006AD0] border-b-4 border-l-4" />
            <View className="absolute right-0 bottom-0 h-10 w-10 border-[#006AD0] border-r-4 border-b-4" />
          </View>
          <View className="flex-1 bg-black/60" />
        </View>

        {/* Bottom overlay with instruction */}
        <View className="flex-1 items-center justify-center bg-black/60 px-8">
          <Text className="text-center text-base text-white">
            Position the barcode or QR code within the frame
          </Text>
        </View>
      </View>
    </View>
  );
}
