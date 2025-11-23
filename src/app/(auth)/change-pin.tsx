import { Feather } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { z } from "zod";
import { useGetOTP, useResetPin } from "@/api/auth";
import { backgroundImg, bajaj_logo } from "@/assets/images";
import { Button } from "@/components/ui/button";
import { metrics } from "@/constants/metrics";
import { toastError, toastSuccess } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";

// Zod validation schema
const changePinSchema = z
  .object({
    dealerCode: z.string().min(1, "Dealer code is required"),
    otp: z
      .string()
      .min(4, "OTP must be 4 digits")
      .max(4, "OTP must be 4 digits")
      .regex(/^\d+$/, "OTP must contain only numbers"),
    pin: z
      .string()
      .min(6, "PIN must be exactly 6 digits")
      .max(6, "PIN must be exactly 6 digits")
      .regex(/^\d+$/, "PIN must contain only numbers"),
    confirmPin: z.string().min(1, "Please confirm PIN"),
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: "PINs do not match",
    path: ["confirmPin"],
  });

type ChangePinForm = z.infer<typeof changePinSchema>;

export default function ChangeTransactionPinScreen() {
  const router = useRouter();
  const userInfo = useAuthStore((state) => state.userInfo);
  const { trigger: getOTP } = useGetOTP();
  const { trigger: resetPin, isMutating } = useResetPin();

  const [timer, setTimer] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const [confirmPinVisible, setConfirmPinVisible] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ChangePinForm>({
    resolver: zodResolver(changePinSchema),
    defaultValues: {
      dealerCode: "",
      otp: "",
      pin: "",
      confirmPin: "",
    },
    mode: "onChange",
  });

  const dealerCode = watch("dealerCode");

  const getOTPButtonText = () => {
    if (timer > 0) {
      return `${timer}s`;
    }
    if (otpSent) {
      return "Resend";
    }
    return "Send OTP";
  };

  const handleGetOTP = async () => {
    if (!dealerCode || dealerCode.length === 0) {
      toastError("Please enter a valid dealer code");
      return;
    }

    try {
      const response = await getOTP({
        serial_number: userInfo?.serial_number || "",
        dealer_code: dealerCode,
      });

      if (response.error !== 0) {
        toastError(response.message);
      } else {
        setTimer(10);
        setOtpSent(true);
      }
    } catch {
      toastError("Failed to send OTP");
    }
  };

  const handleErrorResponse = (error: unknown) => {
    const isAxiosError = (
      err: unknown
    ): err is {
      response?: { status?: number; data?: { message?: string } };
      code?: string;
      message?: string;
    } => typeof err === "object" && err !== null && "response" in err;

    if (!isAxiosError(error)) {
      toastError("Failed to change PIN");
      return;
    }

    if (error.response?.status === 401) {
      toastError("Session expired. Please login again.");
      router.replace("/");
      return;
    }

    if (error.code === "ECONNABORTED") {
      toastError("API timeout");
      return;
    }

    if (error.message === "Network Error") {
      toastError(
        "Server not reachable. Please check internet connection and try again."
      );
      return;
    }

    toastError("Failed to change PIN");
  };

  const onSubmit = async (data: ChangePinForm) => {
    try {
      const response = await resetPin({
        serial_number: userInfo?.serial_number || "",
        otp: data.otp,
        pin: data.pin,
      });

      if (response.error !== 0) {
        toastError(response.message);
      } else {
        toastSuccess("Transaction PIN changed successfully");
        router.back();
      }
    } catch (error: unknown) {
      handleErrorResponse(error);
    }
  };

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <StatusBar barStyle="light-content" />
      <ImageBackground className="flex-1" source={backgroundImg}>
        <ScrollView
          contentContainerClassName="flex-grow justify-end"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <View
            className="items-center"
            style={{
              marginTop: metrics.height < 800 ? 30 : 30,
            }}
          >
            <Image
              source={bajaj_logo}
              style={{
                tintColor: "white",
                width: metrics.width,
                height: metrics.width / 3.5,
                resizeMode: "contain",
              }}
            />
          </View>

          <View className="flex-row items-center justify-center px-4">
            <Image
              source={require("../../assets/images/nostix-logo.png")}
              style={{
                width: metrics.width / 1.8,
                height: metrics.width / 2.8,
                resizeMode: "contain",
              }}
            />
          </View>

          <View className="items-center">
            <Text className="mt-6 mb-4 px-5 text-center text-sm text-white">
              Change your transaction PIN to secure your transactions
            </Text>
          </View>

          <View className="flex-1 flex-row items-end">
            <View className="flex-1 rounded-t-[30px] bg-white pt-5">
              {/* Dealer Code */}
              <View className="mt-4 px-4">
                <Controller
                  control={control}
                  name="dealerCode"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="rounded border border-gray-200 p-2.5 font-bold text-black"
                      onChangeText={(text) => {
                        onChange(text);
                        setOtpSent(false);
                      }}
                      placeholder="Dealer Code"
                      placeholderTextColor="gray"
                      value={value}
                    />
                  )}
                />
                {errors.dealerCode && (
                  <Text className="mt-1 text-[11px] text-red-500">
                    {errors.dealerCode.message}
                  </Text>
                )}
              </View>

              {/* OTP with Send Button */}
              <View className="mt-4 px-4">
                <View className="flex-row items-center space-x-2">
                  <Controller
                    control={control}
                    name="otp"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className="flex-1 rounded border border-gray-200 p-2.5 font-bold text-black"
                        keyboardType="number-pad"
                        maxLength={4}
                        onChangeText={onChange}
                        placeholder="Enter OTP"
                        placeholderTextColor="gray"
                        secureTextEntry
                        value={value}
                      />
                    )}
                  />
                  <Button
                    disabled={timer > 0}
                    inactive={timer > 0}
                    onPress={handleGetOTP}
                    size="sm"
                    text={getOTPButtonText()}
                    variant="primary"
                  />
                </View>
                {errors.otp && (
                  <Text className="mt-1 text-[11px] text-red-500">
                    {errors.otp.message}
                  </Text>
                )}
              </View>

              {/* New PIN */}
              <View className="mt-4 px-4">
                <View className="relative">
                  <Controller
                    control={control}
                    name="pin"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className="rounded border border-gray-200 p-2.5 pr-10 font-bold text-black"
                        keyboardType="number-pad"
                        maxLength={6}
                        onChangeText={onChange}
                        placeholder="New PIN"
                        placeholderTextColor="gray"
                        secureTextEntry={!pinVisible}
                        value={value}
                      />
                    )}
                  />
                  <TouchableOpacity
                    className="absolute top-3 right-3"
                    onPress={() => setPinVisible(!pinVisible)}
                  >
                    <Feather
                      color="#666"
                      name={pinVisible ? "eye" : "eye-off"}
                      size={20}
                    />
                  </TouchableOpacity>
                </View>
                {errors.pin && (
                  <Text className="mt-1 text-[11px] text-red-500">
                    {errors.pin.message}
                  </Text>
                )}
              </View>

              {/* Confirm New PIN */}
              <View className="mt-4 px-4">
                <View className="relative">
                  <Controller
                    control={control}
                    name="confirmPin"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className="rounded border border-gray-200 p-2.5 pr-10 font-bold text-black"
                        keyboardType="number-pad"
                        maxLength={6}
                        onChangeText={onChange}
                        placeholder="Confirm New PIN"
                        placeholderTextColor="gray"
                        secureTextEntry={!confirmPinVisible}
                        value={value}
                      />
                    )}
                  />
                  <TouchableOpacity
                    className="absolute top-3 right-3"
                    onPress={() => setConfirmPinVisible(!confirmPinVisible)}
                  >
                    <Feather
                      color="#666"
                      name={confirmPinVisible ? "eye" : "eye-off"}
                      size={20}
                    />
                  </TouchableOpacity>
                </View>
                {errors.confirmPin && (
                  <Text className="mt-1 text-[11px] text-red-500">
                    {errors.confirmPin.message}
                  </Text>
                )}
              </View>

              {/* Change PIN Button */}
              <View className="px-4">
                <Button
                  isLoading={isMutating}
                  onPress={handleSubmit(onSubmit)}
                  size="lg"
                  text="CHANGE PIN"
                  variant="primary"
                />
              </View>

              <View className="mb-5" />
            </View>
          </View>
        </ScrollView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}
