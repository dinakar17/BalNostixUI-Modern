import { Feather } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { z } from "zod";
import { useGetOTP, useResetPin } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";

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

type ChangePinModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function ChangePinModal({ visible, onClose }: ChangePinModalProps) {
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
    reset,
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
      onClose();
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
        reset();
        setTimer(0);
        setOtpSent(false);
        setPinVisible(false);
        setConfirmPinVisible(false);
        onClose();
      }
    } catch (error: unknown) {
      handleErrorResponse(error);
    }
  };

  const handleClose = () => {
    reset();
    setTimer(0);
    setOtpSent(false);
    setPinVisible(false);
    setConfirmPinVisible(false);
    onClose();
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
    <Modal animationType="fade" transparent visible={visible}>
      <Pressable
        className="flex-1 items-center justify-center bg-black/50"
        onPress={handleClose}
      >
        <Pressable
          className="w-[90%] max-w-md rounded-lg bg-white"
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between border-gray-200 border-b p-4">
              <Text className="font-bold text-gray-900 text-lg">
                Change Transaction PIN
              </Text>
              <TouchableOpacity onPress={handleClose}>
                <Feather color="#666" name="x" size={24} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View className="p-4">
              <Text className="mb-4 text-center text-gray-600 text-sm">
                Change your transaction PIN to secure your transactions
              </Text>

              {/* Dealer Code */}
              <View className="mb-4">
                <Text className="mb-2 font-bold text-gray-700 text-sm">
                  Dealer Code
                </Text>
                <Controller
                  control={control}
                  name="dealerCode"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="rounded border border-gray-300 p-3 font-bold text-black"
                      onChangeText={(text) => {
                        onChange(text);
                        setOtpSent(false);
                      }}
                      placeholder="Enter dealer code"
                      placeholderTextColor="gray"
                      value={value}
                    />
                  )}
                />
                {errors.dealerCode && (
                  <Text className="mt-1 text-red-500 text-xs">
                    {errors.dealerCode.message}
                  </Text>
                )}
              </View>

              {/* OTP with Send Button */}
              <View className="mb-4">
                <Text className="mb-2 font-bold text-gray-700 text-sm">
                  OTP
                </Text>
                <View className="flex-row items-start space-x-2">
                  <View className="flex-1">
                    <Controller
                      control={control}
                      name="otp"
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          className="rounded border border-gray-300 p-3 font-bold text-black"
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
                    {errors.otp && (
                      <Text className="mt-1 text-red-500 text-xs">
                        {errors.otp.message}
                      </Text>
                    )}
                  </View>
                  <Button
                    disabled={timer > 0}
                    inactive={timer > 0}
                    onPress={handleGetOTP}
                    size="sm"
                    text={getOTPButtonText()}
                    variant="primary"
                  />
                </View>
              </View>

              {/* New PIN */}
              <View className="mb-4">
                <Text className="mb-2 font-bold text-gray-700 text-sm">
                  New PIN
                </Text>
                <View className="relative">
                  <Controller
                    control={control}
                    name="pin"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className="rounded border border-gray-300 p-3 pr-12 font-bold text-black"
                        keyboardType="number-pad"
                        maxLength={6}
                        onChangeText={onChange}
                        placeholder="Enter 6-digit PIN"
                        placeholderTextColor="gray"
                        secureTextEntry={!pinVisible}
                        value={value}
                      />
                    )}
                  />
                  <TouchableOpacity
                    className="absolute top-3.5 right-3"
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
                  <Text className="mt-1 text-red-500 text-xs">
                    {errors.pin.message}
                  </Text>
                )}
              </View>

              {/* Confirm New PIN */}
              <View className="mb-6">
                <Text className="mb-2 font-bold text-gray-700 text-sm">
                  Confirm New PIN
                </Text>
                <View className="relative">
                  <Controller
                    control={control}
                    name="confirmPin"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className="rounded border border-gray-300 p-3 pr-12 font-bold text-black"
                        keyboardType="number-pad"
                        maxLength={6}
                        onChangeText={onChange}
                        placeholder="Re-enter PIN"
                        placeholderTextColor="gray"
                        secureTextEntry={!confirmPinVisible}
                        value={value}
                      />
                    )}
                  />
                  <TouchableOpacity
                    className="absolute top-3.5 right-3"
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
                  <Text className="mt-1 text-red-500 text-xs">
                    {errors.confirmPin.message}
                  </Text>
                )}
              </View>

              {/* Action Buttons */}
              <View className="flex-row space-x-3">
                <View className="flex-1">
                  <Button
                    onPress={handleClose}
                    size="lg"
                    text="CANCEL"
                    variant="secondary"
                  />
                </View>
                <View className="flex-1">
                  <Button
                    disabled={isMutating}
                    isLoading={isMutating}
                    onPress={handleSubmit(onSubmit)}
                    size="lg"
                    text="CHANGE PIN"
                    variant="primary"
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
