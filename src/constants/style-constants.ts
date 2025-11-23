/**
 * Style constants
 * Common style values used throughout the app
 */
export const styleConstants = {
  margin: 8,
  padding: 16,
  borderRadius: 8,
  shadowOpacity: 0.1,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
} as const;

/**
 * Animation durations (in ms)
 */
export const animationDurations = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

/**
 * Z-index levels
 */
export const zIndex = {
  base: 0,
  dropdown: 1000,
  overlay: 2000,
  modal: 3000,
  toast: 4000,
  tooltip: 5000,
} as const;
