import { Dimensions } from "react-native";

// Base width and height for scaling
const guidelineBaseWidth = 430;
const guidelineBaseHeight = 890;

// Get device screen width and height
const { width, height } = Dimensions.get("window");

/**
 * Scale size based on screen width
 */
export const scale = (size: number): number =>
  (width / guidelineBaseWidth) * size;

/**
 * Scale size based on screen height
 */
export const verticalScale = (size: number): number =>
  (height / guidelineBaseHeight) * size;

/**
 * Moderate scale with custom factor
 * @param size - Base size
 * @param factor - Scaling factor (default: 0.8)
 */
export const moderateScale = (size: number, factor = 0.8): number =>
  size + (scale(size) - size) * factor;

/**
 * Responsive dimensions helper
 */
export const responsive = {
  width,
  height,
  scale,
  verticalScale,
  moderateScale,
} as const;
