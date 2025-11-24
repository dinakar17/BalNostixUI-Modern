import { FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { FlatList, NativeModules, Text, View } from "react-native";
import { PrimaryButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { ShadowBox } from "@/components/ui/shadow-box";
import { colors } from "@/constants/colors";
import { useAuthStore } from "@/store/auth-store";

const { USBModule } = NativeModules;

const instructions = [
  "Check all the LEDs are off except blue LED. In case of USB red LED will continue to glow.",
  "Click on the BACK TO HOME button",
  "Remove the dongle from vehicle",
];

export default function DongleShutdownSuccessScreen() {
  const router = useRouter();
  const { dataTransferMode } = useAuthStore();

  const handleBackToHome = async () => {
    try {
      // Reset USB permission if in USB mode
      if (dataTransferMode === "USB") {
        await USBModule.resetUSBPermission?.();
      }

      // Navigate to device selection
      router.replace("/(main)/devices/select");
    } catch (error) {
      console.error("Error resetting:", error);
      router.replace("/(main)/devices/select");
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <CustomHeader title="DISCONNECTED" />

      <View className="flex-1 bg-primaryBg px-5 py-6">
        <ShadowBox className="items-center rounded-2xl px-6 py-6">
          <View
            className="h-24 w-24 items-center justify-center rounded-full border"
            style={{
              backgroundColor: colors.successGreen,
              borderColor: "#48c427",
            }}
          >
            <FontAwesome5 color="white" name="check" size={50} />
          </View>

          <View className="mt-4 items-center">
            <Text className="mb-3 text-center font-primaryBold text-lg text-textPrimary">
              Dongle Shutdown Successful
            </Text>

            <FlatList
              contentContainerStyle={{ paddingHorizontal: 8 }}
              data={instructions}
              keyExtractor={(_item, index) => index.toString()}
              renderItem={({ item }) => (
                <View className="mb-2 flex-row">
                  <Text className="font-primaryRegular text-sm text-textPrimary">
                    {"\u2022 "}
                    {item}
                  </Text>
                </View>
              )}
              scrollEnabled={true}
            />

            <View className="mt-4 w-full">
              <PrimaryButton onPress={handleBackToHome} text="BACK TO HOME" />
            </View>
          </View>
        </ShadowBox>
      </View>
    </>
  );
}
