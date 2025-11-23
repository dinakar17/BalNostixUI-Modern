import { Image } from "expo-image";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { FMSApi } from "@/api/fms";
import { warningSmall } from "@/assets/images/index";
import { PrimaryButton } from "@/components/ui/button";
import { fonts } from "@/constants/fonts";
import { toastError } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";

/**
 * Dongle Authentication Modal
 *
 * Flow:
 * 1. User connects dongle (Bluetooth or USB)
 * 2. Connection succeeds → ConfigReset event fires
 * 3. Check dongleStore.getSerialNo():
 *    - If NOT NULL: Dongle was authenticated before → Set flag and wait for SerialNo event
 *    - If NULL: First connection → Skip auth, connect directly
 * 4. This modal appears when isGettingDongleDeviceInfo === true
 * 5. Wait for SerialNo event from BluetoothModule
 * 6. When SerialNo arrives → Fetch dongle info from VNSM server
 * 7. If found → Validate status → Connect
 *    If not found → Show dealer code form → Create record → Connect
 *
 * This prevents re-authentication of previously connected dongles.
 */

export function DongleAuthModal() {
  const { userInfo, handleLogout } = useAuthStore();
  const {
    dongleSerialNo,
    isGettingDongleDeviceInfo,
    updateDevice,
    updateIsGettingDongleDeviceInfo,
    updateDongleSerialNo,
  } = useDataTransferStore();

  const [dongleInfoTitle, setDongleInfoTitle] = useState(
    "Fetching Dongle Info"
  );
  const [dongleInfoDescription, setDongleInfoDescription] = useState("");
  const [dealerCode, setDealerCode] = useState("");
  const [dealerCodeVisible, setDealerCodeVisible] = useState(false);

  const token = userInfo?.token;
  const tool_serial_number = userInfo?.serial_number;

  const createDongleOnServer = async () => {
    if (dealerCode.length === 0) {
      toastError("Please enter a valid dealer code");
      return;
    }

    try {
      setDealerCodeVisible(false);
      setDongleInfoTitle("Creating Dongle Record on server");
      setDongleInfoDescription("");

      console.log("[DongleAuth] Creating dongle record");

      const response = await FMSApi({
        method: "post",
        url: "/api/v4/ap/dongle",
        headers: { Authorization: `Bearer ${token}` },
        data: {},
        params: {
          dongle_mac_id: dongleSerialNo,
          dealer_code: dealerCode,
          status: "Active",
          tool_serial_no: tool_serial_number,
        },
        timeout: 30_000,
      });

      if (response.data.message === "Success") {
        setDongleInfoTitle("Dongle record created. Connecting with dongle");
        updateDevice();
      } else if (response.data.message === "Validation failed") {
        toastError(
          "Validation Failed",
          `${response.data.message}. Please contact the service person`
        );
      } else {
        console.log("[DongleAuth] serialNo:", dongleSerialNo);
        toastError("Couldn't fetch details. Please try again. (#2)");
      }

      setDealerCode("");
      updateIsGettingDongleDeviceInfo(false);
      updateDongleSerialNo(null);
    } catch (error: unknown) {
      updateIsGettingDongleDeviceInfo(false);
      updateDongleSerialNo(null);
      setDealerCodeVisible(false);

      if (error && typeof error === "object" && "response" in error) {
        const err = error as { response?: { status?: number } };
        if (err.response?.status === 401) {
          toastError(
            "Session Expired",
            "You've been inactive for a while. Please login again."
          );
          handleLogout();
          return;
        }
      }
      if (error && typeof error === "object" && "code" in error) {
        const err = error as { code?: string };
        if (err.code === "ECONNABORTED") {
          toastError("API timeout");
          return;
        }
      }
      if (error && typeof error === "object" && "message" in error) {
        const err = error as { message?: string };
        if (err.message === "Network Error") {
          toastError(
            "Server not reachable",
            "Please check internet connection and try again"
          );
          return;
        }
      }
    }
  };

  const getDongleInfoFromVNSM = async () => {
    if (dongleSerialNo === "" || dongleSerialNo === null) {
      updateDevice();
      console.log("[DongleAuth] dongleSerialNo is null");
      return;
    }

    try {
      console.log("[DongleAuth] Getting dongle info:", dongleSerialNo);

      const response = await FMSApi({
        method: "get",
        url: "/api/v4/ap/dongle/get",
        headers: { Authorization: `Bearer ${token}` },
        data: {},
        params: { dongle_mac_id: dongleSerialNo },
        timeout: 30_000,
      });

      console.log("[DongleAuth] Response:", response.data.message);

      if (response.data.message === "Not Found") {
        console.log("[DongleAuth] Dongle not found on server");
        setDongleInfoTitle("");
        setDealerCodeVisible(true);
        updateIsGettingDongleDeviceInfo(true);
      } else if (response.data.message === "Success") {
        const dongleStatus = response.data.data[0];

        if (dongleStatus.status === "Active") {
          console.log("[DongleAuth] Dongle status:", dongleStatus.status);
          setDongleInfoTitle(
            "Dongle status authenticated. Connecting with dongle!"
          );
          updateDevice();
        } else {
          toastError(
            `Dongle ${dongleStatus.status}`,
            "Please contact the service person."
          );
        }

        updateIsGettingDongleDeviceInfo(false);
        updateDongleSerialNo(null);
      } else {
        console.log("[DongleAuth] API failed:", response);
        toastError("Couldn't fetch details. Please try again. (#1)");
        updateIsGettingDongleDeviceInfo(false);
        updateDongleSerialNo(null);
      }
    } catch (error: unknown) {
      updateIsGettingDongleDeviceInfo(false);
      updateDongleSerialNo(null);
      setDealerCodeVisible(false);

      if (error && typeof error === "object" && "response" in error) {
        const err = error as { response?: { status?: number } };
        if (err.response?.status === 401) {
          toastError(
            "Session Expired",
            "You've been inactive for a while. Please login again."
          );
          handleLogout();
          return;
        }
      }
      if (error && typeof error === "object" && "code" in error) {
        const err = error as { code?: string };
        if (err.code === "ECONNABORTED") {
          toastError("API timeout");
          return;
        }
      }
      if (error && typeof error === "object" && "message" in error) {
        const err = error as { message?: string };
        if (err.message === "Network Error") {
          toastError(
            "Server not reachable",
            "Please check internet connection and try again"
          );
          return;
        }
      }
    }
  };

  /**
   * Establishing connection because the dongleSerialNo is null or empty
   * isGettingDongleDeviceInfo is set to true only on config reset
   * If dongle is working fine but unable to give HW serial number, allow connection
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: Run when dongle info state changes
  useEffect(() => {
    if (isGettingDongleDeviceInfo === true && dongleSerialNo !== null) {
      setDongleInfoTitle("Fetching Dongle Info");
      setDongleInfoDescription("");
      getDongleInfoFromVNSM();
    }
  }, [isGettingDongleDeviceInfo, dongleSerialNo]);

  return (
    <Modal animationType="fade" transparent visible={isGettingDongleDeviceInfo}>
      <Pressable className="flex-1 items-center justify-center bg-black/50">
        <Pressable
          className="w-[90%] rounded-lg bg-white p-4"
          onPress={(e) => e.stopPropagation()}
        >
          <View style={{ alignItems: "center" }}>
            <View style={{ alignItems: "center" }}>
              <Image
                contentFit="contain"
                source={warningSmall}
                style={styles.image}
              />

              {dealerCodeVisible ? (
                <View>
                  <Text className="my-4 text-center font-bold text-[22px]">
                    Create New Dongle Record
                  </Text>
                  <View className="mt-4 flex-row items-center">
                    <TextInput
                      onChangeText={(code) => setDealerCode(code)}
                      placeholder="Dealer Code"
                      placeholderTextColor="gray"
                      style={styles.textInput}
                      value={dealerCode}
                    />
                    <View className="-mr-[30px] mb-0.5 px-2.5">
                      <PrimaryButton
                        onPress={createDongleOnServer}
                        text="SUBMIT"
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <Text className="my-4 text-center font-bold text-[22px]">
                  {dongleInfoTitle}
                </Text>
              )}
            </View>

            <Text className="text-center text-[#5d5d5d] text-base">
              {dongleInfoDescription}
            </Text>

            {!dealerCodeVisible && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#003087" size="large" />
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 15,
  },
  image: {
    marginTop: 2,
    marginRight: 4,
    transform: [{ scale: 0.7 }],
  },
  textInput: {
    flex: 1,
    fontFamily: fonts.helveticaBold,
    color: "black",
    borderWidth: 1,
    padding: 10,
    marginRight: 5,
    borderRadius: 5,
    borderColor: "#E0E0E0",
    marginLeft: -30,
  },
});
