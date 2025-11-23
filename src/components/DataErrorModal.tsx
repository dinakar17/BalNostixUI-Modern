import { OverlayView } from "./ui/overlay";

type DataErrorModalProps = {
  visible: boolean;
  errorMessage?: string;
  onClose: () => void;
  onRetry?: () => void;
};

export default function DataErrorModal({
  visible,
  errorMessage = "A data transfer error occurred. Please try again.",
  onClose,
  onRetry,
}: DataErrorModalProps) {
  return (
    <OverlayView
      description={errorMessage}
      primaryButtonOnPress={onRetry || onClose}
      primaryButtonText={onRetry ? "RETRY" : "CLOSE"}
      renderOnlyPrimaryButton={!onRetry}
      title="Data Transfer Error"
      topIcon={require("@/assets/Images/images.error.png")}
      visible={visible}
      whiteButtonOnPress={onClose}
      whiteButtonText="CLOSE"
    />
  );
}
