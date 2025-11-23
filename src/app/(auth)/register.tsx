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
import { useGetOTP, useRegister } from "@/api/auth";
import { backgroundImg, bajaj_logo } from "@/assets/images";
import { PrimaryButton } from "@/components/ui/button";
import { metrics } from "@/constants/metrics";
import { toastError, toastSuccess } from "@/lib/toast";

// Zod validation schema
const registerSchema = z
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
    password: z
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
    confirmPassword: z.string().min(1, "Please confirm password"),
    vinPin: z
      .string()
      .min(1, "VIN PIN is required")
      .length(6, "PIN must be exactly 6 digits")
      .regex(/^\d+$/, "PIN must contain only numbers"),
    vinPinConfirm: z.string().min(1, "Please confirm PIN"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.vinPin === data.vinPinConfirm, {
    message: "PINs do not match",
    path: ["vinPinConfirm"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

const handleMobileOrDealerChange = (
  setValue: (
    name:
      | "mobileNumber"
      | "dealerCode"
      | "otp"
      | "password"
      | "confirmPassword"
      | "vinPin"
      | "vinPinConfirm",
    value: string
  ) => void,
  setOtpSent: (value: boolean) => void
) => {
  setOtpSent(false);
  setValue("otp", "");
};

export default function RegisterScreen() {
  const router = useRouter();
  const { trigger: getOTPTrigger } = useGetOTP();
  const { trigger: registerUser } = useRegister();
  const [buttonLoading, setButtonLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const [confirmPinVisible, setConfirmPinVisible] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    trigger,
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      mobileNumber: "",
      dealerCode: "",
      otp: "",
      password: "",
      confirmPassword: "",
      vinPin: "",
      vinPinConfirm: "",
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
        response?: { data?: { message?: string } };
      } => typeof err === "object" && err !== null && "response" in err;

      if (isAxiosError(error) && error.response?.data?.message) {
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

  const onSubmit = async (data: RegisterForm) => {
    if (!otpSent) {
      toastError("Please generate the OTP to continue!");
      return;
    }

    try {
      setButtonLoading(true);

      const response = await registerUser({
        serial_number: data.mobileNumber,
        dealer_code: data.dealerCode,
        otp: data.otp,
        password: data.password,
        pin: data.vinPin,
      });

      setButtonLoading(false);

      if (response.error === 0) {
        toastSuccess("User registered successfully");
        router.replace("/(auth)");
      } else {
        toastError(response.message);
      }
    } catch (error: unknown) {
      setButtonLoading(false);
      const isAxiosError = (
        err: unknown
      ): err is {
        response?: { data?: { message?: string } };
      } => typeof err === "object" && err !== null && "response" in err;

      if (isAxiosError(error) && error.response?.data?.message) {
        toastError(error.response.data.message);
      } else {
        toastError("Registration failed");
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
              marginTop: metrics.height < 800 ? 20 : 20,
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
            <Text className="mt-6 mb-4 text-center text-[14px] text-white">
              Log in to manage your vehicle ECU Flashing and Diagnostics all in
              one place
            </Text>
          </View>
          <View className="flex-1 flex-row items-end">
            <View className="flex-1 rounded-t-[30px] bg-white pt-5">
              <Text className="mx-4 mb-2.5 font-bold text-[16px] text-black">
                REGISTER
              </Text>

              {/* Mobile Number */}
              <View className="mx-4">
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

              {/* Dealer Code with inline Send OTP button */}
              <View className="mx-4 mt-4 flex-row items-center rounded border border-gray-200 pr-2">
                <Controller
                  control={control}
                  name="dealerCode"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="flex-1 p-2.5 font-bold text-black"
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
              </View>
              {errors.dealerCode && (
                <Text className="mx-4 mt-1 text-[11px] text-red-500">
                  {errors.dealerCode.message}
                </Text>
              )}

              {otpSent && (
                <View>
                  {/* OTP Input */}
                  <View className="mx-4 mt-4 rounded border border-gray-200 px-4">
                    <Controller
                      control={control}
                      name="otp"
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          className="flex-1 p-2.5 font-bold text-black"
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
                    <Text className="mx-4 mt-1 text-[11px] text-red-500">
                      {errors.otp.message}
                    </Text>
                  )}

                  <Text className="mx-4 mt-4 mb-2.5 font-bold text-[16px] text-black">
                    Set Login Credentials
                  </Text>

                  {/* Password */}
                  <View className="mx-4">
                    <Controller
                      control={control}
                      name="password"
                      render={({ field: { onChange, value } }) => (
                        <View className="relative">
                          <TextInput
                            className="rounded border border-gray-200 p-2.5 pr-10 font-bold text-black"
                            onChangeText={onChange}
                            placeholder="New Password"
                            placeholderTextColor="gray"
                            secureTextEntry={!passwordVisible}
                            value={value}
                          />
                          <TouchableOpacity
                            className="absolute top-3 right-3"
                            onPress={() => setPasswordVisible(!passwordVisible)}
                          >
                            <Feather
                              color="#666"
                              name={passwordVisible ? "eye-off" : "eye"}
                              size={20}
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                    />
                    {errors.password && (
                      <Text className="mt-1 text-[11px] text-red-500">
                        {errors.password.message}
                      </Text>
                    )}
                  </View>

                  {/* Confirm Password */}
                  <View className="mx-4 mt-4">
                    <Controller
                      control={control}
                      name="confirmPassword"
                      render={({ field: { onChange, value } }) => (
                        <View className="relative">
                          <TextInput
                            className="rounded border border-gray-200 p-2.5 pr-10 font-bold text-black"
                            onChangeText={onChange}
                            placeholder="Confirm Password"
                            placeholderTextColor="gray"
                            secureTextEntry={!confirmPasswordVisible}
                            value={value}
                          />
                          <TouchableOpacity
                            className="absolute top-3 right-3"
                            onPress={() =>
                              setConfirmPasswordVisible(!confirmPasswordVisible)
                            }
                          >
                            <Feather
                              color="#666"
                              name={confirmPasswordVisible ? "eye-off" : "eye"}
                              size={20}
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                    />
                    {errors.confirmPassword && (
                      <Text className="mt-1 text-[11px] text-red-500">
                        {errors.confirmPassword.message}
                      </Text>
                    )}
                  </View>

                  {/* VIN PIN */}
                  <View className="mx-4 mt-4">
                    <Controller
                      control={control}
                      name="vinPin"
                      render={({ field: { onChange, value } }) => (
                        <View className="relative">
                          <TextInput
                            className="rounded border border-gray-200 p-2.5 pr-10 font-bold text-black"
                            keyboardType="number-pad"
                            maxLength={6}
                            onChangeText={onChange}
                            placeholder="Enter New PIN"
                            placeholderTextColor="gray"
                            secureTextEntry={!pinVisible}
                            value={value}
                          />
                          <TouchableOpacity
                            className="absolute top-3 right-3"
                            onPress={() => setPinVisible(!pinVisible)}
                          >
                            <Feather
                              color="#666"
                              name={pinVisible ? "eye-off" : "eye"}
                              size={20}
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                    />
                    {errors.vinPin && (
                      <Text className="mt-1 text-[11px] text-red-500">
                        {errors.vinPin.message}
                      </Text>
                    )}
                  </View>

                  {/* Confirm VIN PIN */}
                  <View className="mx-4 mt-4">
                    <Controller
                      control={control}
                      name="vinPinConfirm"
                      render={({ field: { onChange, value } }) => (
                        <View className="relative">
                          <TextInput
                            className="rounded border border-gray-200 p-2.5 pr-10 font-bold text-black"
                            keyboardType="number-pad"
                            maxLength={6}
                            onChangeText={onChange}
                            placeholder="Confirm PIN"
                            placeholderTextColor="gray"
                            secureTextEntry={!confirmPinVisible}
                            value={value}
                          />
                          <TouchableOpacity
                            className="absolute top-3 right-3"
                            onPress={() =>
                              setConfirmPinVisible(!confirmPinVisible)
                            }
                          >
                            <Feather
                              color="#666"
                              name={confirmPinVisible ? "eye-off" : "eye"}
                              size={20}
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                    />
                    {errors.vinPinConfirm && (
                      <Text className="mt-1 text-[11px] text-red-500">
                        {errors.vinPinConfirm.message}
                      </Text>
                    )}
                  </View>

                  <PrimaryButton
                    className="mx-4 mt-4 rounded-[10px]"
                    isLoading={buttonLoading}
                    onPress={handleSubmit(onSubmit)}
                    text="SIGN UP"
                  />
                </View>
              )}

              <View className="mb-5" />
            </View>
          </View>
        </ScrollView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}
