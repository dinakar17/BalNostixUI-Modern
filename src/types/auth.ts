/**
 * Auth types
 */
export type UserInfo = {
  token: string;
  serial_number: string;
  dealer_code: string;
  tokenExpiryTime: Date;
};

export type LoginCredentials = {
  dealerCode: string;
  password: string;
};

export type RegisterData = {
  dealerCode: string;
  password: string;
  confirmPassword: string;
  otp: string;
  vinPin: string;
};

export type ChangePasswordData = {
  dealerCode?: string;
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type ForgotPasswordData = {
  dealerCode: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
};
