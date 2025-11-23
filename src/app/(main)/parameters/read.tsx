import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  BackHandler,
  FlatList,
  NativeEventEmitter,
  NativeModules,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { scanAgain } from "@/assets/images";
import { CustomHeader } from "@/components/ui/header";
import { OverlayLoading } from "@/components/ui/overlay";
import { ShadowBox } from "@/components/ui/shadow-box";
import { toastError } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";
import { useDataTransferStore } from "@/store/data-transfer-store";
import type { DIDParameter } from "@/types/ecu";

const { BluetoothModule, USBModule } = NativeModules;

type ReadParameterResponse = {
  name: string;
  success?: boolean;
  data?: DIDParameter[];
  value?: string;
};

export default function ReadParametersScreen() {
  const params = useLocalSearchParams<{
    ecuIndex: string;
    groupName: string;
  }>();
  const { dataTransferMode } = useAuthStore();
  const { selectedEcu, isDonglePhase3State, updateDongleToDisconnected } =
    useDataTransferStore();

  const { groupName, ecuIndex } = params;

  const [loading, setLoading] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [isReadParameterRunning, setIsReadParameterRunning] = useState(true);
  const [list, setList] = useState<DIDParameter[]>([]);

  const eventEmitter = new NativeEventEmitter(
    dataTransferMode === "USB" ? USBModule : BluetoothModule
  );

  const getList = () => {
    try {
      setLoading(true);
      setIsReadParameterRunning(true);
      BluetoothModule.getReadParameters(
        Number.parseInt(ecuIndex || "0", 10),
        (groupName || "").replace(" ", "_")
      );
    } catch (error) {
      toastError("Failed to get read parameters");
      console.log(error);
    }
  };

  const onResponse = (response: ReadParameterResponse) => {
    try {
      if (
        response.name === "readparameters" &&
        response.success &&
        response.data
      ) {
        setLoading(false);
        setList([...response.data]);
      }
      if (response.name === "updateUI" && response.value) {
        try {
          const jsonData = JSON.parse(response.value);
          console.log(jsonData, response);
          if (jsonData.valueFor === "UpdateAll") {
            setIsReadParameterRunning(false);
          }
        } catch (err) {
          console.log("Error parsing updateUI:", err);
        }
      }
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  };

  const toggleAutoUpdate = (isAutoUpdate: boolean) => {
    BluetoothModule.setReadParamAutoRefresh(
      isAutoUpdate,
      Number.parseInt(ecuIndex || "0", 10)
    );
    setAutoUpdate(isAutoUpdate);
    if (isAutoUpdate && !isReadParameterRunning) {
      console.log("call read again done");
      getList();
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: Event listeners setup should only run once
  useEffect(() => {
    const nativeListener = eventEmitter.addListener(
      "readparameters",
      onResponse
    );
    const updateUiListener = eventEmitter.addListener("updateUI", onResponse);
    toggleAutoUpdate(false);
    return () => {
      toggleAutoUpdate(false);
      nativeListener.remove();
      updateUiListener.remove();
      BluetoothModule.stopReadParametersTimer();
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Run only once on mount
  useEffect(() => {
    getList();
  }, []);

  function handleBackButton() {
    if (loading) {
      return true;
    }
    return false;
  }

  useFocusEffect(
    // biome-ignore lint/correctness/useExhaustiveDependencies: Complex event handling from original implementation
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackButton
      );
      return () => subscription.remove();
    }, [loading])
  );

  const showAutoUpdate = () => {
    // If no data, don't show auto-update
    if (list.length === 0) {
      return false;
    }

    // Show auto-update based on ECU configuration
    return selectedEcu.readParamAutoRefreshShownInGroupName === groupName;
  };

  const ScanAgainButton = () => {
    const isDisabled = autoUpdate || isReadParameterRunning;
    return (
      <TouchableOpacity
        className={`h-12 items-center justify-center rounded-lg ${
          isDisabled ? "bg-gray-500" : "bg-blue-600"
        }`}
        disabled={isDisabled}
        onPress={() => {
          getList();
        }}
      >
        <View className="flex-row items-center justify-center">
          <Image
            contentFit="contain"
            source={scanAgain}
            style={{
              height: 35,
              width: 35,
              marginRight: 8,
              tintColor: "white",
            }}
          />
          <Text className="font-bold text-lg text-white">Scan Again</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <CustomHeader
        leftButtonType="back"
        renderLeftButton={true}
        renderRightButton={isDonglePhase3State}
        rightButtonFunction={updateDongleToDisconnected}
        rightButtonType="settings"
        title="READ PARAMETERS"
      />

      <View>
        <Text className="my-4 text-center font-bold text-xl">
          {selectedEcu.ecuName}
        </Text>
        {showAutoUpdate() && (
          <View className="absolute right-0 mt-1 flex-row items-center p-2">
            <Text className="font-bold">Auto-Update</Text>
            <Switch
              onValueChange={() => toggleAutoUpdate(!autoUpdate)}
              style={{ marginLeft: 10 }}
              thumbColor={autoUpdate ? "#ffffff" : "#f4f3f4"}
              trackColor={{ false: "#BAC7D5", true: "#0063B1" }}
              value={autoUpdate}
            />
          </View>
        )}
      </View>

      {list?.length !== 0 ? (
        <>
          <ScrollView showsVerticalScrollIndicator={false}>
            <FlatList
              data={list}
              keyExtractor={(item, index) => `${item.description}-${index}`}
              renderItem={({ item }) => (
                <View className="flex-row border-gray-400 border-b-[0.5px]">
                  <View className="flex-1 py-4">
                    <Text className="mx-4 mb-2 font-bold text-gray-400 text-lg">
                      {item.description}
                    </Text>
                    <Text className="mx-4 font-bold text-lg">{item.value}</Text>
                  </View>
                </View>
              )}
              scrollEnabled={false}
            />
            <View className="justify-end">
              <View className="mx-4 mt-4 mb-12" />
            </View>
          </ScrollView>
          <ShadowBox style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
            <ScanAgainButton />
          </ShadowBox>
        </>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Text className="font-bold text-lg">NO DATA FOUND</Text>
        </View>
      )}
      <OverlayLoading loading={loading} />
    </>
  );
}
