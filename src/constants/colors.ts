/**
 * Color palette
 * Primary brand colors and semantic colors
 */
export const colors = {
  primaryColor: "#006AD0",
  warningOrange: "#FF9C23",
  successGreen: "#48C426",
  dangerRed: "#C92A1C",
  white: "#ffffff",
  darkGrey: "#A0A0A0",
  lightGrey: "#E6E6E6",
  lightWhite: "#f7f7f7",
  borderColor: "gray",
  lightText: "#5d5d5d",
} as const;

/**
 * Tailwind color mapping
 * Map custom colors to Tailwind classes
 */
export const tailwindColors = {
  primary: "bg-[#006AD0]",
  warning: "bg-[#FF9C23]",
  success: "bg-[#48C426]",
  danger: "bg-[#C92A1C]",
  darkGrey: "bg-[#A0A0A0]",
  lightGrey: "bg-[#E6E6E6]",
} as const;
