import {
  Image,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PrimaryButton } from "@/components/ui/button";

type DongleDisconnectModalProps = {
  visible: boolean;
  deviceName: string;
  onClose: () => void;
  onReconnect?: () => void;
};

export default function DongleDisconnectModal({
  visible,
  deviceName,
  onClose,
  onReconnect,
}: DongleDisconnectModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/50"
        onPress={onClose}
      >
        <Pressable
          className="w-[90%] rounded-lg bg-white p-6"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="items-center">
            <Image
              className="h-24 w-24"
              resizeMode="contain"
              source={require("@/assets/Images/images.no_bluetooth.png")}
            />

            <Text className="mt-4 px-4 text-center font-primaryBold text-base text-textPrimary">
              {deviceName} device got disconnected. Please make sure turn off
              and turn on dongle.
            </Text>
          </View>

          <View className="mt-6">
            <PrimaryButton onPress={onClose} text="CLOSE" />
            {onReconnect && (
              <TouchableOpacity className="mt-3" onPress={onReconnect}>
                <Text className="text-center font-primaryMedium text-base text-primary">
                  Try Reconnecting
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
