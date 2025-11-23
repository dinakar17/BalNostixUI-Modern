import { Feather } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
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
import { useChangePassword, useLogin } from "@/api/auth";
import { backgroundImg, bajaj_logo } from "@/assets/images";
import { PrimaryButton } from "@/components/ui/button";
import { metrics } from "@/constants/metrics";
import { toastError, toastSuccess } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";

// Zod validation schema
const changePasswordSchema = z
  .object({
    mobileNumber: z
      .string()
      .min(1, "Serial number is required")
      .regex(/^[0-9]{10}$/, "Enter valid 10-digit number"),
    dealerCode: z.string(),
    oldLoginPassword: z
      .string()
      .min(1, "Old password is required")
      .min(8, "Old password must be at least 8 characters long"),
    loginPassword: z
      .string()
      .min(1, "New password is required")
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
    confirmLoginPassword: z.string().min(1, "Please confirm new password"),
  })
  .refine((data) => data.loginPassword === data.confirmLoginPassword, {
    message: "Passwords do not match",
    path: ["confirmLoginPassword"],
  });

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordScreen() {
  const router = useRouter();
  const userInfo = useAuthStore((state) => state.userInfo);
  const isSignedIn = useAuthStore((state) => state.isSignedIn);
  const updateIsSessionExpired = useDataTransferStore(
    (state) => state.updateIsSessionExpired
  );
  const { trigger: login } = useLogin();
  const { trigger: changePassword } = useChangePassword();

  const [buttonLoading, setButtonLoading] = useState(false);
  const [oldPasswordVisible, setOldPasswordVisible] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      mobileNumber: userInfo?.serial_number || "",
      dealerCode: "",
      oldLoginPassword: "",
      loginPassword: "",
      confirmLoginPassword: "",
    },
    mode: "onChange",
  });

  const handleLoginForPasswordChange = async (data: ChangePasswordForm) => {
    const res = await login({
      serial_number: data.mobileNumber,
      password: data.oldLoginPassword,
    });

    if (res.error !== 0) {
      toastError(res.message);
      return false;
    }
    return true;
  };

  const handlePasswordChange = async (data: ChangePasswordForm) => {
    const response = await changePassword({
      serial_number: data.mobileNumber,
      dealer_code: data.dealerCode,
      old_password: data.oldLoginPassword,
      new_password: data.loginPassword,
    });

    if (response.error === 0) {
      toastSuccess("Password changed successfully!");
      if (isSignedIn) {
        router.back();
      } else {
        router.replace("/(auth)");
      }
      return true;
    }
    toastError(response.message);
    return false;
  };

  const handleError = (error: unknown) => {
    const isAxiosError = (
      err: unknown
    ): err is {
      response?: { status?: number; data?: { message?: string } };
    } => typeof err === "object" && err !== null && "response" in err;

    if (isAxiosError(error) && error.response?.status === 401) {
      if (isSignedIn) {
        updateIsSessionExpired(true);
      }
      toastError("Session expired. Please login again.");
    } else if (isAxiosError(error) && error.response?.data?.message) {
      toastError(error.response.data.message);
    } else {
      toastError("Failed to change password");
    }
  };

  const onSubmit = async (data: ChangePasswordForm) => {
    try {
      setButtonLoading(true);

      if (!isSignedIn) {
        const loginSuccess = await handleLoginForPasswordChange(data);
        if (!loginSuccess) {
          setButtonLoading(false);
          return;
        }
      }

      await handlePasswordChange(data);
      setButtonLoading(false);
    } catch (error: unknown) {
      setButtonLoading(false);
      handleError(error);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
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
                      keyboardType="number-pad"
                      maxLength={12}
                      onChangeText={(text) => {
                        onChange(text);
                        setButtonLoading(false);
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
                        setButtonLoading(false);
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

              {/* Old Password Input */}
              <View className="mt-4 px-4">
                <View className="relative">
                  <Controller
                    control={control}
                    name="oldLoginPassword"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className="rounded border border-gray-200 p-2.5 pr-10 font-bold text-black"
                        onChangeText={(text) => {
                          onChange(text);
                          setButtonLoading(false);
                        }}
                        placeholder="Old Password"
                        placeholderTextColor="gray"
                        secureTextEntry={!oldPasswordVisible}
                        value={value}
                      />
                    )}
                  />
                  <TouchableOpacity
                    className="absolute top-3 right-3"
                    onPress={() => setOldPasswordVisible(!oldPasswordVisible)}
                  >
                    <Feather
                      color="#666"
                      name={oldPasswordVisible ? "eye" : "eye-off"}
                      size={20}
                    />
                  </TouchableOpacity>
                </View>
                {errors.oldLoginPassword && (
                  <Text className="mt-1 text-[11px] text-red-500">
                    {errors.oldLoginPassword.message}
                  </Text>
                )}
              </View>

              {/* New Password Input */}
              <View className="mt-4 px-4">
                <View className="relative">
                  <Controller
                    control={control}
                    name="loginPassword"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className="rounded border border-gray-200 p-2.5 pr-10 font-bold text-black"
                        onChangeText={(text) => {
                          onChange(text);
                          setButtonLoading(false);
                        }}
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
                        onChangeText={(text) => {
                          onChange(text);
                          setButtonLoading(false);
                        }}
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

              {/* Change Password Button */}
              <View className="px-4">
                <PrimaryButton
                  isLoading={buttonLoading}
                  onPress={handleSubmit(onSubmit)}
                  text="CHANGE PASSWORD"
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
