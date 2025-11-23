import { useState } from "react";
import { NativeModules } from "react-native";
import { OverlayLoading, OverlayView } from "./ui/overlay";

const { BluetoothModule } = NativeModules;

type DongleShutdownModalProps = {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
};

export default function DongleShutdownModal({
  visible,
  onCancel,
  onSuccess,
  onError,
}: DongleShutdownModalProps) {
  const [isShuttingDown, setIsShuttingDown] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsShuttingDown(true);

      await BluetoothModule.initShutDown?.();

      // Wait for shutdown (6 seconds timeout)
      const timeout = setTimeout(() => {
        setIsShuttingDown(false);
        onError("Failed to disconnect with the dongle");
      }, 6000);

      // Simulate shutdown completion
      setTimeout(() => {
        clearTimeout(timeout);
        setIsShuttingDown(false);
        onSuccess();
      }, 5000);
    } catch (error) {
      console.error("Shutdown error:", error);
      setIsShuttingDown(false);
      onError("Failed to disconnect with the dongle");
    }
  };

  return (
    <>
      <OverlayView
        description="To disconnect with dongle click ok and wait till the Led is turned Off."
        primaryButtonOnPress={handleConfirm}
        primaryButtonText="OK"
        secondaryButtonText="Cancel"
        title="Disconnect Dongle"
        topIcon={require("@/assets/Images/images.warning_small.png")}
        visible={visible}
        whiteButtonOnPress={onCancel}
      />
      <OverlayLoading loading={isShuttingDown} />
    </>
  );
}
