import { Feather, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { backBtn, dongleOff } from "@/assets/images";
import { ChangePinModal } from "@/components/ChangePinModal";
import { ENV } from "@/config/env";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";

type CustomHeaderProps = {
  title?: string;
  rightButtonFunction?: () => void;
  leftButtonFunction?: () => void;
  renderRightButton?: boolean;
  renderLeftButton?: boolean;
  leftButtonType?: "back" | "menu" | "close" | null;
  rightButtonType?: "menu" | "info" | "settings" | null;
  onDisconnect?: () => void;
};

export function CustomHeader({
  title = "",
  rightButtonFunction = () => null,
  leftButtonFunction = () => null,
  renderRightButton = false,
  renderLeftButton = false,
  leftButtonType = null,
  rightButtonType = null,
  onDisconnect = () => null,
}: CustomHeaderProps) {
  const router = useRouter();
  const handleLogout = useAuthStore((state) => state.handleLogout);
  const isDeviceConnected = useDataTransferStore(
    (state) => state.isDeviceConnected
  );
  const vin = useDataTransferStore((state) => state.vin);
  const isDonglePhase3State = useDataTransferStore(
    (state) => state.isDonglePhase3State
  );

  const [showMenu, setShowMenu] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);

  const handleLogoutAction = () => {
    handleLogout();
    router.replace("/(auth)");
  };

  const handleChangeTransactionPin = () => {
    setShowMenu(false);
    setShowChangePinModal(true);
  };

  const getDate = () => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const date = today.getDate();
    const dateStr = `${date}/${month}/${year}`;
    const vinStr = vin ? ` ⋅ ${vin}` : "";
    return `${dateStr} ⋅ ${ENV.APP_VERSION}${vinStr}`;
  };

  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };

  const handleMenuAction = (action: () => void) => {
    setShowMenu(false);
    action();
  };

  const renderLeftButtonContent = () => {
    if (!renderLeftButton) {
      return null;
    }

    if (leftButtonType === "back") {
      return (
        <TouchableOpacity className="p-2" onPress={leftButtonFunction}>
          <Image className="h-6 w-6" resizeMode="contain" source={backBtn} />
        </TouchableOpacity>
      );
    }

    if (leftButtonType === "close") {
      return (
        <TouchableOpacity className="p-2" onPress={leftButtonFunction}>
          <Feather color="#333" name="x" size={24} />
        </TouchableOpacity>
      );
    }

    return null;
  };

  const renderRightButtonContent = () => {
    if (!renderRightButton) {
      return null;
    }

    if (rightButtonType === "menu") {
      return (
        <TouchableOpacity
          className="items-center justify-center bg-transparent p-2"
          onPress={toggleMenu}
        >
          <Feather color="#fff" name={showMenu ? "x" : "menu"} size={24} />
        </TouchableOpacity>
      );
    }

    if (rightButtonType === "settings") {
      return (
        <TouchableOpacity className="p-2" onPress={rightButtonFunction}>
          <Feather color="#fff" name="settings" size={24} />
        </TouchableOpacity>
      );
    }

    return null;
  };

  const MenuOverlay = () => {
    if (!showMenu) {
      return null;
    }

    const headerHeight =
      Platform.OS === "ios" ? 100 : (StatusBar.currentHeight || 0) + 60;

    return (
      <View className="absolute inset-0 z-50" style={{ top: headerHeight }}>
        {/* Backdrop */}
        <Pressable
          className="absolute inset-0"
          onPress={() => setShowMenu(false)}
        />

        {/* Menu Card */}
        <View className="absolute top-0 right-4 min-w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <View className="py-2">
            {/* Logout - only show when NOT connected */}
            {!isDeviceConnected && (
              <>
                <TouchableOpacity
                  className="flex-row items-center px-5 py-4 active:bg-gray-100"
                  onPress={() => handleMenuAction(handleLogoutAction)}
                >
                  <MaterialIcons color="#6366f1" name="logout" size={22} />
                  <Text className="ml-4 text-base text-gray-700">Logout</Text>
                </TouchableOpacity>
                <View className="mx-3 h-px bg-gray-200" />
              </>
            )}

            {/* Change Transaction PIN */}
            <TouchableOpacity
              className="flex-row items-center px-5 py-4 active:bg-gray-100"
              onPress={() => handleMenuAction(handleChangeTransactionPin)}
            >
              <MaterialIcons color="#10b981" name="lock-reset" size={22} />
              <Text className="ml-4 text-base text-gray-700">
                Change Transaction PIN
              </Text>
            </TouchableOpacity>

            {/* Disconnect - only show when connected AND Phase 3 */}
            {isDeviceConnected && isDonglePhase3State && (
              <>
                <View className="mx-3 h-px bg-gray-200" />
                <TouchableOpacity
                  className="flex-row items-center px-5 py-4 active:bg-gray-100"
                  onPress={() => handleMenuAction(onDisconnect)}
                >
                  <Image
                    className="h-5.5 w-5.5"
                    source={dongleOff}
                    style={{ tintColor: "#f59e0b" }}
                  />
                  <Text className="ml-4 text-base text-gray-700">
                    Disconnect
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <StatusBar backgroundColor="#003087" barStyle="light-content" />
      <LinearGradient
        className="relative"
        colors={["#009CDE", "#003087"]}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
      >
        <View
          className="flex-row items-center justify-between px-4"
          style={{
            paddingTop:
              Platform.OS === "ios" ? 50 : (StatusBar.currentHeight || 0) + 10,
            paddingBottom: 10,
          }}
        >
          {/* Left Button */}
          <View className="w-12">{renderLeftButtonContent()}</View>

          {/* Center Content */}
          <View className="flex-1 items-center">
            <Text
              className="text-center font-bold text-lg text-white uppercase tracking-wider"
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              className="mt-1 w-[270px] text-center font-bold text-[10px] text-white uppercase tracking-wider"
              numberOfLines={1}
            >
              {getDate()}
            </Text>
          </View>

          {/* Right Button */}
          <View className="w-12 items-end">{renderRightButtonContent()}</View>
        </View>
      </LinearGradient>

      <MenuOverlay />
      <ChangePinModal
        onClose={() => setShowChangePinModal(false)}
        visible={showChangePinModal}
      />
    </>
  );
}
