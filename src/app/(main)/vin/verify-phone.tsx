import Icon from "@expo/vector-icons/EvilIcons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WhiteButton } from "@/components/ui/button";
import { CustomHeader } from "@/components/ui/header";
import { colors } from "@/constants/colors";

export default function VerifyPhoneScreen() {
  const [otp, setOtp] = useState("");
  const [showModal, setShowModal] = useState(true);

  const handleVerify = () => {
    if (otp.length === 6) {
      // Handle OTP verification
      console.log("Verifying OTP:", otp);
      router.back();
    }
  };

  const handleResendOtp = () => {
    console.log("Resending OTP");
    setOtp("");
  };

  return (
    <>
      <CustomHeader
        leftButtonFunction={() => router.back()}
        leftButtonType="back"
        renderLeftButton
        title="READ VIN"
      />

      <Modal animationType="fade" transparent visible={showModal}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 p-6"
          onPress={() => {
            setShowModal(false);
            router.back();
          }}
        >
          <Pressable
            className="w-full max-w-md rounded-2xl bg-white p-6"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <Icon
              color="#000"
              name="close"
              onPress={() => {
                setShowModal(false);
                router.back();
              }}
              size={30}
              style={{ position: "absolute", right: 16, top: 16, padding: 8 }}
            />

            {/* Icon */}
            <View className="mb-4 items-center">
              <View className="relative h-16 w-16">
                <Image
                  className="h-16 w-16"
                  resizeMode="contain"
                  source={require("@/assets/images/index").phone}
                />
                <Image
                  className="absolute left-8 h-8 w-8"
                  resizeMode="contain"
                  source={require("@/assets/images/index").message}
                />
              </View>
            </View>

            {/* Title */}
            <Text className="mb-4 text-center font-bold text-gray-800 text-lg">
              Verify Phone Number
            </Text>

            {/* Description */}
            <Text className="mb-4 px-4 text-center text-base text-gray-600">
              Please enter the six digit OTP sent to the registered mobile
              number
            </Text>

            {/* OTP Input */}
            <View className="mb-4">
              <TextInput
                className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-4 font-bold text-base text-black"
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={setOtp}
                placeholder="Enter OTP"
                placeholderTextColor={colors.darkGrey}
                value={otp}
              />
            </View>

            {/* Resend OTP */}
            <View className="mb-4 flex-row items-center justify-center">
              <Text className="p-2 text-base text-gray-800">
                Did not receive the OTP?
              </Text>
              <TouchableOpacity className="p-2" onPress={handleResendOtp}>
                <Text className="font-bold text-[#006AD0] text-base">
                  Resend OTP
                </Text>
              </TouchableOpacity>
            </View>

            {/* Verify Button */}
            <WhiteButton onPress={handleVerify} text="VERIFY NUMBER" />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
