import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { notwifi } from "@/assets/images";

import { PrimaryButton } from "@/components/ui/button";

export default function ErrorScreen() {
  const router = useRouter();

  const handleGoHome = () => {
    // Reset navigation to home screen (devices)
    router.replace("/(main)/devices/select");
  };

  return (
    <>
      <StatusBar style="dark" />
      <View className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center px-5">
          <Image className="h-48 w-48" contentFit="contain" source={notwifi} />

          <Text className="mt-16 text-center font-primaryBold text-textPrimary text-xl">
            Something went wrong!
          </Text>

          <Text className="mt-3 text-center font-primaryRegular text-sm text-textSecondary">
            Please Try Again
          </Text>
        </View>

        <View className="px-5 pb-16">
          <PrimaryButton onPress={handleGoHome} text="GO TO HOME" />
        </View>
      </View>
    </>
  );
}
