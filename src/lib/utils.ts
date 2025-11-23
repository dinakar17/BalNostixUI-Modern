import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Regex patterns for validation
const NRC_ERROR_REGEX = /.*S[0-9A-Fa-f]{2}#[0-9A-Fa-f]{2}.*/i;
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;
const DEALER_CODE_REGEX = /^[A-Z0-9]{6,10}$/i;

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Check if a message contains NRC error pattern (S##-##)
 */
export function checkIfNrcError(message: string): boolean {
  return NRC_ERROR_REGEX.test(message);
}

/**
 * Safely parse JSON string
 */
export function handleJsonParse<T = unknown>(string: string): T | string {
  try {
    const message = JSON.parse(string);
    return message as T;
  } catch {
    return "";
  }
}

/**
 * Delay execution by milliseconds
 */
export function delayByMilliseconds(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format date to readable string
 */
export function formatDate(
  date: Date | string,
  format: "short" | "long" = "short"
): string {
  const d = typeof date === "string" ? new Date(date) : date;

  if (format === "long") {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Validate VIN number (17 characters)
 */
export function isValidVin(vin: string): boolean {
  return VIN_REGEX.test(vin);
}

/**
 * Validate dealer code format
 */
export function isValidDealerCode(code: string): boolean {
  return DEALER_CODE_REGEX.test(code);
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) {
    return str;
  }
  return `${str.slice(0, length)}...`;
}
