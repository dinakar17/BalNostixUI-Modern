import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { ENV } from "@/config/env";

const setAppType = (appType: string) => {
  if (appType === "") {
    return "";
  }
  return ` - ${appType}`;
};

export default function AuthLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#fff" },
          animation: "simple_push",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="change-password" />
      </Stack>

      {/* App Version */}
      <View className="mb-2 items-center justify-center bg-white">
        <Text className="text-[10px]">
          v{ENV.APP_VERSION}
          {setAppType(ENV.FLAVOR_NAME)}
        </Text>
      </View>
    </>
  );
}
