import useSWRMutation from "swr/mutation";
import { getWhoAmI } from "@/lib/who-am-i";
import { FMSApi } from "./fms";

// ============================================
// Type Definitions
// ============================================

type BaseResponse = {
  error: number;
  message: string;
};

interface LoginResponse extends BaseResponse {
  token?: string;
  token_expire_at?: string;
  dealer_code?: string;
}

interface OTPResponse extends BaseResponse {}

interface RegisterResponse extends BaseResponse {}

interface ChangePasswordResponse extends BaseResponse {}

type ForgotPasswordResponse = BaseResponse;

type ResetPinResponse = BaseResponse;

type VerifyAppVersionResponse = {
  error: number;
  message: string;
  response?: string;
};

type LoginParams = {
  serial_number: string;
  password: string;
};

type GetOTPParams = {
  serial_number: string;
  dealer_code: string;
};

type RegisterParams = {
  serial_number: string;
  dealer_code: string;
  otp: string;
  password: string;
  pin: string;
};

type ChangePasswordParams = {
  serial_number: string;
  dealer_code: string;
  old_password: string;
  new_password: string;
};

type ForgotPasswordParams = {
  serial_number: string;
  dealer_code: string;
  otp: string;
  new_password: string;
};

type VerifyAppVersionParams = {
  serial_number: string;
  appversion: string;
};

type ResetPinParams = {
  serial_number: string;
  otp: string;
  pin: string;
};

// ============================================
// Mutation Functions
// ============================================

async function loginMutation(
  url: string,
  { arg }: { arg: LoginParams }
): Promise<LoginResponse> {
  const token = await getWhoAmI();
  const response = await FMSApi.post(
    url,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        serial_number: arg.serial_number,
        password: arg.password,
      },
    }
  );
  return response.data;
}

async function getOTPMutation(
  url: string,
  { arg }: { arg: GetOTPParams }
): Promise<OTPResponse> {
  const token = await getWhoAmI();
  const response = await FMSApi.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      serial_number: arg.serial_number,
      dealer_code: arg.dealer_code,
    },
  });
  return response.data;
}

async function registerMutation(
  url: string,
  { arg }: { arg: RegisterParams }
): Promise<RegisterResponse> {
  const token = await getWhoAmI();
  const response = await FMSApi.post(
    url,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        serial_number: arg.serial_number,
        dealer_code: arg.dealer_code,
        otp: arg.otp,
        password: arg.password,
        pin: arg.pin,
      },
    }
  );
  return response.data;
}

async function changePasswordMutation(
  url: string,
  { arg }: { arg: ChangePasswordParams }
): Promise<ChangePasswordResponse> {
  const token = await getWhoAmI();
  const response = await FMSApi.post(
    url,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        serial_number: arg.serial_number,
        dealer_code: arg.dealer_code,
        old_password: arg.old_password,
        new_password: arg.new_password,
      },
    }
  );
  return response.data;
}

async function forgotPasswordMutation(
  url: string,
  { arg }: { arg: ForgotPasswordParams }
): Promise<ForgotPasswordResponse> {
  const token = await getWhoAmI();
  const response = await FMSApi.post(
    url,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        serial_number: arg.serial_number,
        dealer_code: arg.dealer_code,
        otp: arg.otp,
        new_password: arg.new_password,
      },
    }
  );
  return response.data;
}

async function verifyAppVersionMutation(
  url: string,
  { arg }: { arg: VerifyAppVersionParams }
): Promise<VerifyAppVersionResponse> {
  const token = await getWhoAmI();
  const response = await FMSApi.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      serial_number: arg.serial_number,
      appversion: arg.appversion,
    },
    timeout: 120_000,
  });
  return response.data;
}

async function resetPinMutation(
  url: string,
  { arg }: { arg: ResetPinParams }
): Promise<ResetPinResponse> {
  // Import dynamically to avoid circular dependency
  const { useAuthStore } = await import("@/store/auth-store");
  const { userInfo } = useAuthStore.getState();
  const token = userInfo?.token;

  if (!token) {
    throw new Error("No authentication token available");
  }

  const response = await FMSApi.post(
    url,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        serial_number: arg.serial_number,
        otp: arg.otp,
        pin: arg.pin,
      },
    }
  );
  return response.data;
}

// ============================================
// Custom Hooks
// ============================================

/**
 * Hook for user login with mobile number and password
 * @returns SWR mutation hook with trigger function and state
 * @example
 * const { trigger, isMutating, error } = useLogin();
 * const result = await trigger({ serial_number: "1234567890", password: "Pass@123" });
 */
export function useLogin() {
  return useSWRMutation<LoginResponse, Error, string, LoginParams>(
    "/api/v4/login",
    loginMutation
  );
}

/**
 * Hook for getting OTP for registration or password reset
 * @returns SWR mutation hook with trigger function and state
 * @example
 * const { trigger, isMutating, error } = useGetOTP();
 * const result = await trigger({ serial_number: "1234567890", dealer_code: "DEALER01" });
 */
export function useGetOTP() {
  return useSWRMutation<OTPResponse, Error, string, GetOTPParams>(
    "/api/v4/login-get-otp",
    getOTPMutation
  );
}

/**
 * Hook for user registration
 * @returns SWR mutation hook with trigger function and state
 * @example
 * const { trigger, isMutating, error } = useRegister();
 * const result = await trigger({
 *   serial_number: "1234567890",
 *   dealer_code: "DEALER01",
 *   otp: "1234",
 *   password: "Pass@123",
 *   pin: "123456"
 * });
 */
export function useRegister() {
  return useSWRMutation<RegisterResponse, Error, string, RegisterParams>(
    "/api/v4/register",
    registerMutation
  );
}

/**
 * Hook for changing password
 * @returns SWR mutation hook with trigger function and state
 * @example
 * const { trigger, isMutating, error } = useChangePassword();
 * const result = await trigger({
 *   serial_number: "1234567890",
 *   dealer_code: "DEALER01",
 *   old_password: "OldPass@123",
 *   new_password: "NewPass@123"
 * });
 */
export function useChangePassword() {
  return useSWRMutation<
    ChangePasswordResponse,
    Error,
    string,
    ChangePasswordParams
  >("/api/v4/change-password", changePasswordMutation);
}

/**
 * Hook for forgot password (reset with OTP)
 * @returns SWR mutation hook with trigger function and state
 * @example
 * const { trigger, isMutating, error } = useForgotPassword();
 * const result = await trigger({
 *   serial_number: "1234567890",
 *   dealer_code: "DEALER01",
 *   otp: "1234",
 *   new_password: "NewPass@123"
 * });
 */
export function useForgotPassword() {
  return useSWRMutation<
    ForgotPasswordResponse,
    Error,
    string,
    ForgotPasswordParams
  >("/api/v4/forgot-password", forgotPasswordMutation);
}

/**
 * Hook for verifying app version
 * @returns SWR mutation hook with trigger function and state
 * @example
 * const { trigger, isMutating, error } = useVerifyAppVersion();
 * const result = await trigger({ serial_number: "1234567890", appversion: "1.0.0" });
 */
export function useVerifyAppVersion() {
  return useSWRMutation<
    VerifyAppVersionResponse,
    Error,
    string,
    VerifyAppVersionParams
  >("/api/v2/verify", verifyAppVersionMutation);
}

/**
 * Hook for resetting transaction PIN
 * @returns SWR mutation hook with trigger function and state
 * @example
 * const { trigger, isMutating, error } = useResetPin();
 * const result = await trigger({ serial_number: "1234567890", otp: "1234", pin: "123456" });
 */
export function useResetPin() {
  return useSWRMutation<ResetPinResponse, Error, string, ResetPinParams>(
    "/api/v4/pin/reset",
    resetPinMutation
  );
}

// ============================================
// Export Types for External Use
// ============================================

export type {
  LoginResponse,
  OTPResponse,
  RegisterResponse,
  ChangePasswordResponse,
  ForgotPasswordResponse,
  ResetPinResponse,
  VerifyAppVersionResponse,
  LoginParams,
  GetOTPParams,
  RegisterParams,
  ChangePasswordParams,
  ForgotPasswordParams,
  ResetPinParams,
  VerifyAppVersionParams,
};
