import Toast from "react-native-toast-message";

/**
 * Show error toast message
 */
export function toastError(text1 = "", text2 = "", visibilityTime = 6000) {
  Toast.show({
    type: "error",
    text1,
    text2,
    visibilityTime,
  });
}

/**
 * Show success toast message
 */
export function toastSuccess(text1 = "", text2 = "") {
  Toast.show({
    type: "success",
    text1,
    text2,
    visibilityTime: 8000,
  });
}

/**
 * Show info toast message
 */
export function toastInfo(text1 = "", text2 = "", visibilityTime = 8000) {
  Toast.show({
    type: "info",
    text1,
    text2,
    visibilityTime,
  });
}

/**
 * Hide all toast messages
 */
export function hideToast() {
  Toast.hide();
}
