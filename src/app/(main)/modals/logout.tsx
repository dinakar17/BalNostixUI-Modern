import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Alert } from "react-native";

import { useAuthStore } from "@/store/auth-store";

export default function LogoutScreen() {
  const router = useRouter();
  const { handleLogout } = useAuthStore();

  // biome-ignore lint/correctness/useExhaustiveDependencies: Run on mount
  useEffect(() => {
    // Show alert for session expiry
    Alert.alert(
      "Session Expired",
      "You've been inactive for a while. Please login again.",
      [
        {
          text: "OK",
          onPress: () => {
            handleLogout();
            router.replace("/(auth)");
          },
        },
      ],
      { cancelable: false }
    );
  }, []);

  return null;
}
