import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { warningSmall } from "@/assets/images/index";
import { PrimaryButton } from "@/components/ui/button";

type SessionExpiredWarningProps = {
  isExpired: boolean;
};

export default function SessionExpiredWarning({
  isExpired,
}: SessionExpiredWarningProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isWarningShown, setIsWarningShown] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Run on isExpired change
  useEffect(() => {
    if (isExpired && !isWarningShown) {
      setIsVisible(true);
      setIsWarningShown(true);
    }
  }, [isExpired]);

  const handleClose = () => {
    setIsVisible(false);
    // User should be redirected to login screen
    // This will be handled by the navigation logic
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleClose}
      transparent
      visible={isVisible}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/50"
        onPress={handleClose}
      >
        <Pressable
          className="w-[90%] rounded-lg bg-white p-4"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="items-center">
            <View className="mb-4 flex-row">
              <Image contentFit="contain" source={warningSmall} />
            </View>

            <Text className="mb-4 text-center font-bold text-2xl">
              Login Session Expired
            </Text>

            <Text className="mb-6 text-center text-base text-gray-600">
              Please login again!!
            </Text>
          </View>

          <View className="mt-3">
            <PrimaryButton onPress={handleClose} text="OK" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
