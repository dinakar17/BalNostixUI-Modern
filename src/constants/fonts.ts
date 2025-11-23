import { Platform } from "react-native";

/**
 * Font family constants
 * Custom fonts used throughout the app
 */
export const fonts = {
  blenderspro: "BlenderPro-Heavy",
  proximanova:
    Platform.OS === "ios" ? "proximanova-regular" : "proxima_nova_regular",
  proximanovaBold:
    Platform.OS === "ios" ? "proximanova-bold" : "proxima_nova_bold",
  helvetica: "helvetica",
  helveticaBold: "helvetica_bold",
} as const;

/**
 * Font weight constants for Tailwind
 */
export const fontWeights = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
  heavy: "font-black",
} as const;

/**
 * Font size constants for Tailwind
 */
export const fontSizes = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
} as const;
