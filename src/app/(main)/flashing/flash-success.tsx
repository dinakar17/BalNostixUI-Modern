import { FontAwesome5 } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React from "react";
import { BackHandler, Text, View } from "react-native";
import { PrimaryButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { ShadowBox } from "@/components/ui/shadow-box";
import { colors } from "@/constants/colors";
import { metrics } from "@/constants/metrics";

export default function FlashSuccessScreen() {
  useFocusEffect(
    React.useCallback(() => {
      const handleBackButton = () => {
        return true; // Prevent back navigation
      };

      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackButton
      );

      return () => backHandler.remove();
    }, [])
  );

  return (
    <View className="flex-1">
      <CustomHeader title="CONTROLLERS" />
      <View className="flex-1 items-center justify-center bg-[#f7f7f7]">
        <ShadowBox
          className="items-center justify-center rounded-3xl"
          style={{
            height: metrics.height / 1.5,
            width: metrics.width / 1.2,
          }}
        >
          <View
            className="mt-6 items-center justify-center rounded-full border"
            style={{
              height: metrics.height / 7,
              width: metrics.height / 7,
              backgroundColor: colors.successGreen,
              borderColor: "#48c427",
            }}
          >
            <FontAwesome5 color="white" name="check" size={60} />
          </View>

          <View className="mt-6 items-center">
            <Text className="mb-4 font-helveticaBold text-xl">
              Flashing Successful
            </Text>
            <Text className="mx-6 mb-4 text-center text-[#5d5d5d] text-lg">
              Control Unit reprogrammed successfully
            </Text>
            <View style={{ paddingHorizontal: metrics.width / 8 }}>
              <PrimaryButton
                onPress={() =>
                  router.dismissTo("/(main)/controllers/operations")
                }
                text="BACK TO HOME"
              />
            </View>
          </View>
        </ShadowBox>
      </View>
    </View>
  );
}
