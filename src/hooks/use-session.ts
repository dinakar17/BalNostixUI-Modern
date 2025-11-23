import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";

const TEN_MINUTES_IN_MS = 10 * 60 * 1000;

/**
 * Hook to monitor session expiry
 * Triggers warning when token is within 10 minutes of expiration
 */
export function useSession() {
  const userInfo = useAuthStore((state) => state.userInfo);
  const updateIsSessionExpired = useDataTransferStore(
    (state) => state.updateIsSessionExpired
  );
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userInfo?.tokenExpiryTime) {
      return;
    }

    const targetTime = new Date(userInfo.tokenExpiryTime);

    if (Number.isNaN(targetTime.getTime())) {
      console.error("[useSession] Invalid token expiry time");
      return;
    }

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      const now = new Date();
      const diffInMs = targetTime.getTime() - now.getTime();
      const diffInMinutes = diffInMs / (60 * 1000);

      setTimeRemaining(diffInMs);

      // Session expired or within 10 minutes of expiration
      if (diffInMinutes <= 10) {
        console.log(
          "[useSession] Session expiring soon:",
          diffInMinutes.toFixed(2),
          "minutes"
        );
        updateIsSessionExpired(true);

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [userInfo?.tokenExpiryTime, updateIsSessionExpired]);

  return {
    timeRemaining,
    isExpiringSoon:
      timeRemaining !== null && timeRemaining <= TEN_MINUTES_IN_MS,
    isExpired: timeRemaining !== null && timeRemaining <= 0,
  };
}

/**
 * Hook to format remaining session time
 */
export function useSessionTimer() {
  const { timeRemaining } = useSession();

  const formatTime = (ms: number | null): string => {
    if (ms === null || ms <= 0) {
      return "00:00";
    }

    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  return {
    formattedTime: formatTime(timeRemaining),
    timeRemaining,
  };
}
