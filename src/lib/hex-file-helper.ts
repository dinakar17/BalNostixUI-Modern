import { NativeEventEmitter, NativeModules } from "react-native";

const { BluetoothModule } = NativeModules;

type UpdateUIResponse = {
  name: string;
  value: string;
};

type ParsedUpdateUI = {
  posIndex: number;
  status: boolean;
  value: string;
  valueFor: string;
};

/**
 * Fetches the hex file name from Group A parameters by listening to updateUI events
 * Looks for parameters where 'valueFor' includes "hex" (case-insensitive)
 *
 * @param ecuIndex - The ECU index to query
 * @param timeoutMs - Maximum time to wait for the response (default: 10000ms)
 * @returns Promise resolving to the hex file name or null if not found
 */
export function getHexFileNameFromGroupA(
  ecuIndex: number,
  timeoutMs = 10_000
): Promise<string | null> {
  return new Promise((resolve) => {
    const eventEmitter = new NativeEventEmitter(BluetoothModule);
    let hexFileName: string | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let eventListener: { remove: () => void } | null = null;

    const cleanup = () => {
      if (eventListener) {
        eventListener.remove();
        eventListener = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const handleUpdateUI = (response: UpdateUIResponse) => {
      try {
        if (response.name !== "updateUI" || !response.value) {
          return;
        }

        const jsonData: ParsedUpdateUI = JSON.parse(response.value);

        // Check if valueFor includes "hex" (case-insensitive)
        const isHexParameter =
          jsonData.valueFor?.toLowerCase().includes("hex") && jsonData.value;

        if (isHexParameter) {
          hexFileName = jsonData.value;
          cleanup();
          resolve(hexFileName);
          return;
        }

        // If we get "UpdateAll", stop listening and return what we found
        if (jsonData.valueFor === "UpdateAll") {
          cleanup();
          resolve(hexFileName);
        }
      } catch (error) {
        console.log("[HexFileHelper] Error parsing updateUI:", error);
      }
    };

    eventListener = eventEmitter.addListener("updateUI", handleUpdateUI);

    // Set timeout to prevent indefinite waiting
    timeoutId = setTimeout(() => {
      cleanup();
      resolve(hexFileName);
    }, timeoutMs);

    // Trigger read parameters for Group A
    try {
      BluetoothModule.getReadParameters(ecuIndex, "GROUP_A");
    } catch (error) {
      console.log("[HexFileHelper] Error calling getReadParameters:", error);
      cleanup();
      resolve(null);
    }
  });
}
