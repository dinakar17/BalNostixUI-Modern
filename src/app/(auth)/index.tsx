import { Feather } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  NativeModules,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { z } from "zod";
import { useLogin } from "@/api/auth";
import { backgroundImg, bajaj_logo } from "@/assets/images";
import { PrimaryButton } from "@/components/ui/button";
import { OverlayView } from "@/components/ui/overlay";
import { metrics } from "@/constants/metrics";
import { toastError } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";

const { BluetoothModule } = NativeModules;

// Zod validation schema
const loginSchema = z.object({
  mobileNumber: z
    .string()
    .min(1, "Mobile number is required")
    .regex(/^[0-9]{10}$/, "Please enter a valid 10-digit mobile number"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters long")
    .regex(/(?=.*[a-z])/, "Password must contain at least one lowercase letter")
    .regex(/(?=.*[A-Z])/, "Password must contain at least one uppercase letter")
    .regex(/(?=.*\d)/, "Password must contain at least one number")
    .regex(
      /(?=.*[@#$!%*&])/,
      "Password must contain at least one special character (@#$!%*&)"
    ),
});

type LoginForm = z.infer<typeof loginSchema>;

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const turnOnBluetooth = async (onSubmit: () => void) => {
  BluetoothModule.enableBluetooth();
  await delay(3000);
  onSubmit();
};

export default function LoginScreen() {
  const router = useRouter();
  const updateLoginStatus = useAuthStore((state) => state.updateLoginStatus);
  const { trigger: login } = useLogin();
  const [buttonLoading, setButtonLoading] = useState(false);
  const [bluetoothOverlay, setBluetoothOverlay] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      mobileNumber: "",
      password: "",
    },
    mode: "onChange",
  });

  const handleLoginError = (error: unknown) => {
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
      toastError("Login failed. Please try again.");
    }
  };

  const onSubmit = async (data: LoginForm) => {
    try {
      setButtonLoading(true);
      const initApplicationRes = await BluetoothModule.initApplication();

      if (!initApplicationRes) {
        setBluetoothOverlay(true);
        setButtonLoading(false);
        return;
      }

      const response = await login({
        serial_number: data.mobileNumber,
        password: data.password,
      });

      setButtonLoading(false);

      console.log("Login Response:", response);

      if (response.token && response.token_expire_at && response.dealer_code) {
        const tokenExpiryTime = new Date(
          response.token_expire_at.replace(" ", "T")
        );

        updateLoginStatus({
          token: response.token,
          serial_number: data.mobileNumber,
          dealer_code: response.dealer_code,
          tokenExpiryTime,
        });

        router.replace("/(main)");
      } else if (response.error !== 0) {
        toastError(response.message);
      }
    } catch (error: unknown) {
      setButtonLoading(false);
      handleLoginError(error);
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <StatusBar barStyle="light-content" />
        <ImageBackground source={backgroundImg} style={{ flex: 1 }}>
          <ScrollView
            contentContainerClassName="flex-grow justify-end"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            <View
              className="items-center"
              style={{
                marginTop: metrics.height < 800 ? 55 : 60,
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
                Log in to manage your vehicle ECU Flashing and Diagnostics all
                in one place
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
                        editable={!buttonLoading}
                        keyboardType="number-pad"
                        maxLength={12}
                        onChangeText={onChange}
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

                {/* Password Input */}
                <View className="mt-4 px-4">
                  <View className="relative">
                    <Controller
                      control={control}
                      name="password"
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          className="rounded border border-gray-200 p-2.5 pr-10 font-bold text-black"
                          editable={!buttonLoading}
                          onChangeText={onChange}
                          placeholder="Password"
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
                  {errors.password && (
                    <Text className="mt-1 text-[11px] text-red-500">
                      {errors.password.message}
                    </Text>
                  )}
                </View>

                {/* Footer Links */}
                <View className="my-4 flex-row justify-between px-4">
                  <TouchableOpacity
                    onPress={() => router.push("/(auth)/forgot-password")}
                  >
                    <Text className="text-[#003087]">Forgot Password?</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.push("/(auth)/change-password")}
                  >
                    <Text className="text-[#003087]">Change Password</Text>
                  </TouchableOpacity>
                </View>

                {/* Login Button */}
                <View className="px-4">
                  <PrimaryButton
                    isLoading={buttonLoading}
                    onPress={handleSubmit(onSubmit)}
                    text="LOGIN"
                  />
                </View>

                {/* OR Divider */}
                <View className="mt-4 flex-row items-center px-4">
                  <View className="h-px flex-1 bg-gray-200" />
                  <Text className="mx-2.5 text-gray-500">OR</Text>
                  <View className="h-px flex-1 bg-gray-200" />
                </View>

                {/* Sign Up Link */}
                <View className="mt-4 flex-row items-center justify-center px-4">
                  <Text>Don't have an account? </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/(auth)/register")}
                  >
                    <Text className="font-bold text-[#003087]">Sign Up</Text>
                  </TouchableOpacity>
                </View>

                <View className="mb-5" />
              </View>
            </View>
          </ScrollView>
        </ImageBackground>
      </KeyboardAvoidingView>

      {/* Bluetooth Overlay */}
      <Modal animationType="fade" transparent visible={bluetoothOverlay}>
        <View className="flex-1 items-center justify-center bg-black/50">
          <View
            className="max-w-[300px] rounded-lg bg-white p-5"
            style={{ maxWidth: metrics.width - 60 }}
          >
            <OverlayView
              description='This application requires bluetooth. Please click on "Turn On Bluetooth" to enable bluetooth'
              primaryButtonOnPress={() => {
                setBluetoothOverlay(false);
                turnOnBluetooth(handleSubmit(onSubmit));
              }}
              primaryButtonText="Turn On Bluetooth"
              renderOnlyPrimaryButton
              title="NOTE"
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
