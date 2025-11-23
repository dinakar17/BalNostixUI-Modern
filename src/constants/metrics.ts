import { Dimensions } from "react-native";

/**
 * Screen metrics
 * Screen width and height
 */
export const metrics = {
  width: Dimensions.get("screen").width,
  height: Dimensions.get("screen").height,
} as const;

/**
 * Spacing constants
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/**
 * Border radius constants
 */
export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;
