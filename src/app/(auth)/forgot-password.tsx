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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { z } from "zod";
import { useForgotPassword, useGetOTP } from "@/api/auth";
import { backgroundImg, bajaj_logo } from "@/assets/images";
import { PrimaryButton } from "@/components/ui/button";
import { metrics } from "@/constants/metrics";
import { toastError, toastSuccess } from "@/lib/toast";

// Zod validation schema
const forgotPasswordSchema = z
  .object({
    mobileNumber: z
      .string()
      .min(1, "Serial number is required")
      .regex(/^[0-9]{10}$/, "Enter valid 10-digit number"),
    dealerCode: z.string().min(1, "Dealer code is required"),
    otp: z
      .string()
      .min(1, "OTP is required")
      .regex(/^[0-9]{4}$/, "Enter valid 4-digit OTP"),
    loginPassword: z
      .string()
      .min(1, "Password is required")
      .min(8, "Password must be at least 8 characters long")
      .regex(
        /(?=.*[a-z])/,
        "Password must contain at least one lowercase letter"
      )
      .regex(
        /(?=.*[A-Z])/,
        "Password must contain at least one uppercase letter"
      )
      .regex(/(?=.*\d)/, "Password must contain at least one number")
      .regex(
        /(?=.*[@#$!%*&])/,
        "Password must contain at least one special character (@#$!%*&)"
      ),
    confirmLoginPassword: z.string().min(1, "Please confirm password"),
  })
  .refine((data) => data.loginPassword === data.confirmLoginPassword, {
    message: "Passwords do not match",
    path: ["confirmLoginPassword"],
  });

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

const handleMobileOrDealerChange = (
  setValue: (
    name:
      | "mobileNumber"
      | "dealerCode"
      | "otp"
      | "loginPassword"
      | "confirmLoginPassword",
    value: string
  ) => void,
  setOtpSent: (value: boolean) => void
) => {
  setOtpSent(false);
  setValue("otp", "");
};

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { trigger: getOTPTrigger } = useGetOTP();
  const { trigger: resetPassword } = useForgotPassword();
  const [buttonLoading, setButtonLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    trigger,
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      mobileNumber: "",
      dealerCode: "",
      otp: "",
      loginPassword: "",
      confirmLoginPassword: "",
    },
    mode: "onChange",
  });

  const watchedMobileNumber = watch("mobileNumber");
  const watchedDealerCode = watch("dealerCode");

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const getOTP = async () => {
    try {
      const response = await getOTPTrigger({
        serial_number: watchedMobileNumber,
        dealer_code: watchedDealerCode,
      });

      if (response.error !== 0) {
        toastError(response.message);
      } else {
        setTimer(10);
        setOtpSent(true);
      }
    } catch (error: unknown) {
      const isAxiosError = (
        err: unknown
      ): err is {
        response?: { status?: number; data?: { message?: string } };
      } => typeof err === "object" && err !== null && "response" in err;

      if (isAxiosError(error) && error.response?.status === 401) {
        toastError("Authentication failed. Please check your credentials.");
      } else if (isAxiosError(error) && error.response?.data?.message) {
        toastError(error.response.data.message);
      } else {
        toastError("Failed to send OTP");
      }
    }
  };

  const sendOtp = async () => {
    const mobileValid = await trigger("mobileNumber");
    const dealerValid = await trigger("dealerCode");

    if (mobileValid && dealerValid) {
      getOTP();
    }
  };

  const onSubmit = async (data: ForgotPasswordForm) => {
    if (!otpSent) {
      toastError("Please generate the OTP to continue!");
      return;
    }

    try {
      setButtonLoading(true);

      const response = await resetPassword({
        serial_number: data.mobileNumber,
        dealer_code: data.dealerCode,
        otp: data.otp,
        new_password: data.loginPassword,
      });

      setButtonLoading(false);

      console.log("Password Reset Response:", response);

      if (response.error !== 0) {
        toastError(response.message);
      } else {
        router.replace("/(auth)");
        toastSuccess("Password changed successfully");
      }
    } catch (error: unknown) {
      setButtonLoading(false);
      const isAxiosError = (
        err: unknown
      ): err is {
        response?: { status?: number; data?: { message?: string } };
      } => typeof err === "object" && err !== null && "response" in err;

      if (isAxiosError(error) && error.response?.status === 401) {
        toastError("Authentication failed. Please try again.");
      } else if (isAxiosError(error) && error.response?.data?.message) {
        toastError(error.response.data.message);
      } else {
        toastError("Password reset failed");
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ImageBackground className="flex-1" source={backgroundImg}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}
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
            <Text className="mt-6 mb-4 px-5 text-center text-[14px] text-white">
              Log in to manage your vehicle ECU Flashing and Diagnostics all in
              one place
            </Text>
          </View>

          <View className="flex-1 flex-row items-end">
            <View className="flex-1 rounded-t-[30px] bg-white pt-5">
              {/* Mobile Number Input */}
              <View className="mt-4 px-4">
                <Controller
                  control={control}
                  name="mobileNumber"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="rounded border border-gray-200 p-2.5 font-bold text-black"
                      editable={timer === 0}
                      keyboardType="number-pad"
                      maxLength={12}
                      onChangeText={(text) => {
                        onChange(text);
                        handleMobileOrDealerChange(setValue, setOtpSent);
                      }}
                      placeholder="Mobile Number"
                      placeholderTextColor="gray"
                      value={value}
                    />
                  )}
                />
                {errors.mobileNumber && (
                  <Text className="mt-1 text-[11px] text-red-500">
                    {errors.mobileNumber.message}
                  </Text>
                )}
              </View>

              {/* Dealer Code with Send OTP Button */}
              <View className="mt-4 px-4">
                <Controller
                  control={control}
                  name="dealerCode"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="rounded border border-gray-200 p-2.5 font-bold text-black"
                      editable={timer === 0}
                      onChangeText={(text) => {
                        onChange(text);
                        handleMobileOrDealerChange(setValue, setOtpSent);
                      }}
                      placeholder="Dealer Code"
                      placeholderTextColor="gray"
                      value={value}
                    />
                  )}
                />
                {timer === 0 ? (
                  <PrimaryButton
                    className="mb-0.5 px-4"
                    onPress={sendOtp}
                    text={otpSent ? "Resend OTP" : "Send OTP"}
                  />
                ) : (
                  <PrimaryButton
                    className="mb-0.5 px-4"
                    inactive={true}
                    onPress={sendOtp}
                    text={`Resend OTP in ${timer}`}
                  />
                )}
                {errors.dealerCode && (
                  <Text className="mt-1 text-[11px] text-red-500">
                    {errors.dealerCode.message}
                  </Text>
                )}
              </View>

              {/* OTP and Password Fields (shown after OTP sent) */}
              {otpSent && (
                <View>
                  {/* OTP Input */}
                  <View className="mx-4 mt-4 rounded border border-gray-200 px-4">
                    <Controller
                      control={control}
                      name="otp"
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          className="flex-1 font-bold text-black"
                          keyboardType="number-pad"
                          maxLength={4}
                          onChangeText={onChange}
                          placeholder="OTP"
                          placeholderTextColor="gray"
                          secureTextEntry={true}
                          value={value}
                        />
                      )}
                    />
                  </View>
                  {errors.otp && (
                    <Text className="mt-1 ml-4 text-[11px] text-red-500">
                      {errors.otp.message}
                    </Text>
                  )}

                  {/* New Password Input */}
                  <View className="mt-4 px-4">
                    <View className="relative">
                      <Controller
                        control={control}
                        name="loginPassword"
                        render={({ field: { onChange, value } }) => (
                          <TextInput
                            className="rounded border border-gray-200 p-2.5 pr-10 font-bold text-black"
                            onChangeText={onChange}
                            placeholder="New Password"
                            placeholderTextColor="gray"
                            secureTextEntry={!passwordVisible}
                            value={value}
                          />
                        )}
                      />
                      <TouchableOpacity
                        className="absolute top-3 right-3"
                        onPress={() => setPasswordVisible(!passwordVisible)}
                      >
                        <Feather
                          color="#666"
                          name={passwordVisible ? "eye" : "eye-off"}
                          size={20}
                        />
                      </TouchableOpacity>
                    </View>
                    {errors.loginPassword && (
                      <Text className="mt-1 text-[11px] text-red-500">
                        {errors.loginPassword.message}
                      </Text>
                    )}
                  </View>

                  {/* Confirm Password Input */}
                  <View className="mt-4 px-4">
                    <View className="relative">
                      <Controller
                        control={control}
                        name="confirmLoginPassword"
                        render={({ field: { onChange, value } }) => (
                          <TextInput
                            className="rounded border border-gray-200 p-2.5 pr-10 font-bold text-black"
                            onChangeText={onChange}
                            placeholder="Confirm New Password"
                            placeholderTextColor="gray"
                            secureTextEntry={!confirmPasswordVisible}
                            value={value}
                          />
                        )}
                      />
                      <TouchableOpacity
                        className="absolute top-3 right-3"
                        onPress={() =>
                          setConfirmPasswordVisible(!confirmPasswordVisible)
                        }
                      >
                        <Feather
                          color="#666"
                          name={confirmPasswordVisible ? "eye" : "eye-off"}
                          size={20}
                        />
                      </TouchableOpacity>
                    </View>
                    {errors.confirmLoginPassword && (
                      <Text className="mt-1 text-[11px] text-red-500">
                        {errors.confirmLoginPassword.message}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Reset Password Button */}
              <PrimaryButton
                className="mx-4 mt-4 rounded-[10px]"
                isLoading={buttonLoading}
                onPress={handleSubmit(onSubmit)}
                text="RESET PASSWORD"
              />

              <View className="mb-5" />
            </View>
          </View>
        </ScrollView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}
