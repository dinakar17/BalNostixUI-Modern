import { StatusBar } from "expo-status-bar";
import { Image, Text, View } from "react-native";

export default function NoInternetScreen() {
  return (
    <>
      <StatusBar style="dark" />
      <View className="flex-1 items-center justify-center bg-white px-5">
        <Image
          className="h-48 w-48"
          resizeMode="contain"
          source={require("@/assets/images/nointernet.png")}
        />

        <Text className="mt-16 text-center font-primaryBold text-textPrimary text-xl">
          No Internet Found
        </Text>

        <Text className="mt-3 text-center font-primaryRegular text-sm text-textSecondary">
          Check your network and try again
        </Text>
      </View>
    </>
  );
}
