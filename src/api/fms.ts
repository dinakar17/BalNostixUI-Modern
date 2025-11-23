import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { ENV } from "@/config/env";

// Get base URL from environment config
export const BASEURL = ENV.FMS_URL;
export const FLAVOR_NAME = ENV.FLAVOR_NAME;

console.log(`FMS API Base URL: ${BASEURL}`);
console.log(`FMS API Flavor Name: ${FLAVOR_NAME}`);

interface FMSApiConfig extends AxiosRequestConfig {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  data?: unknown;
  params?: Record<string, unknown>;
  timeout?: number;
}

// Extended config type for request timing
interface AxiosConfigWithTiming extends AxiosRequestConfig {
  requestStartTime?: number;
}

/**
 * FMS API Client
 * Axios instance configured for FMS backend
 */
export const FMSApi: AxiosInstance = axios.create({
  baseURL: BASEURL,
  timeout: 60_000,
  headers: {
    Accept: "application/json",
  },
});

// Request interceptor for logging
FMSApi.interceptors.request.use(
  (config) => {
    if (ENV.ENABLE_LOGS) {
      console.log(`[FMS API] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    if (ENV.ENABLE_LOGS) {
      console.error("[FMS API] Request error:", error);
    }
    return Promise.reject(error);
  }
);

// Response interceptor for logging and error handling
FMSApi.interceptors.response.use(
  (response) => {
    if (ENV.ENABLE_LOGS) {
      const config = response.config as AxiosConfigWithTiming;
      const duration = Date.now() - (config.requestStartTime ?? Date.now());
      if (duration > 5000) {
        console.warn(
          `[FMS API] Slow response (${duration}ms): ${response.config.url}`
        );
      }
    }
    return response;
  },
  (error) => {
    if (ENV.ENABLE_LOGS) {
      if (error.response?.status === 401) {
        console.error("[FMS API] Unauthorized - logging out");
        // TODO: Use RootNavigation to logout
      }

      const config = error.config as AxiosConfigWithTiming | undefined;
      const duration = Date.now() - (config?.requestStartTime ?? Date.now());
      console.error(`[FMS API] Error (${duration}ms):`, {
        url: error.config?.url,
        status: error.response?.status,
        message: error.message,
      });
    }

    return Promise.reject(error);
  }
);

// Add timestamp to requests for performance monitoring
FMSApi.interceptors.request.use((config) => {
  const configWithTiming = config as AxiosConfigWithTiming;
  configWithTiming.requestStartTime = Date.now();
  return config;
});

/**
 * Legacy FMS API function for backward compatibility
 * @deprecated Use FMSApi axios instance directly
 */
export default async function fmsApiLegacy({
  method = "get",
  url = "",
  headers = {},
  data = {},
  params = {},
  validateStatus = (status: number) => status >= 200 && status < 300,
  timeout = 60_000,
}: FMSApiConfig): Promise<AxiosResponse> {
  const config: AxiosRequestConfig = {
    method,
    url,
    headers: { Accept: "application/json", ...headers },
    data: method === "get" ? undefined : data,
    params,
    validateStatus,
    timeout,
  };

  return await FMSApi(config);
}
