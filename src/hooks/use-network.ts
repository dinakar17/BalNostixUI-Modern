import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

/**
 * Hook to monitor network connectivity
 * Returns current connection status and type
 */
export function useNetwork() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
      setConnectionType(state.type);

      if (state.isConnected === false) {
        console.log("[useNetwork] Network disconnected");
      } else if (state.isConnected === true) {
        console.log("[useNetwork] Network connected:", state.type);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    isConnected,
    connectionType,
    isOnline: isConnected === true,
    isOffline: isConnected === false,
  };
}

/**
 * Hook to check if network is reachable (has internet access)
 */
export function useNetworkReachability() {
  const [isInternetReachable, setIsInternetReachable] = useState<
    boolean | null
  >(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsInternetReachable(state.isInternetReachable);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { isInternetReachable };
}
