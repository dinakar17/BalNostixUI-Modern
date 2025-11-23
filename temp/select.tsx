const SelectDevicesScreen = () => <div>SelectDevicesScreen</div>;

export default SelectDevicesScreen;

// import Icon from "@expo/vector-icons/Feather";
// import { useFocusEffect } from "@react-navigation/native";
// import { router } from "expo-router";
// import { useCallback, useEffect, useState } from "react";
// import {
//   AppState,
//   BackHandler,
//   NativeEventEmitter,
//   NativeModules,
//   RefreshControl,
//   ScrollView,
//   Text,
//   TouchableOpacity,
//   View,
// } from "react-native";
// import { DongleAuthModal } from "@/components/DongleAuthModal";
// import { PrimaryButton } from "@/components/ui/button";
// import { CustomHeader } from "@/components/ui/header";
// import { OverlayLoading } from "@/components/ui/overlay";
// import { toastError, toastInfo, toastSuccess } from "@/lib/toast";
// import { handleJsonParse } from "@/lib/utils";
// import { useAuthStore } from "@/store/auth-store";
// import { dongleStore, useDataTransferStore } from "@/store/data-transfer-store";

// const { BluetoothModule } = NativeModules;
// const eventEmitter = new NativeEventEmitter(BluetoothModule);

// type BluetoothDevice = {
//   id: string;
//   name: string;
//   paired: boolean;
// };

// type DeviceDiscoverEvent = {
//   name: string;
//   id: string;
// };

// type BluetoothAdapterStatusEvent = {
//   name: string;
//   status: string;
// };

// type BluetoothDeviceStatusEvent = {
//   name: string;
//   status: string;
//   device?: {
//     id: string;
//     name: string;
//   };
// };

// function sleep(ms: number) {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

// let isFlashingUpdated = false;

// export default function SelectDeviceScreen() {
//   const [pairedDevices, setPairedDevices] = useState<BluetoothDevice[]>([]);
//   const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDevice[]>(
//     []
//   );
//   const [refreshing, setRefreshing] = useState(false);
//   const [overlayLoading, setOverlayLoading] = useState(false);
//   const [isScanning, setIsScanning] = useState(false);
//   const [showDiscoveredDevices, setShowDiscoveredDevices] = useState(false);
//   const [pairingInProgress, setPairingInProgress] = useState(false);

//   const { updateDataTransferSelectionState } = useAuthStore();
//   const {
//     connectToDevice,
//     updateIsGettingDongleDeviceInfo,
//     updateDongleSerialNo,
//   } = useDataTransferStore();

//   let dongleName = "";

//   const setDongleNameFunction = async (name: string) => {
//     dongleName = name;
//     console.log("[SelectDevice] Setting dongle name:", dongleName);
//     updateDongleSerialNo(dongleName);
//   };

//   // Get bonded devices using BluetoothModule
//   const getBondedDevices = useCallback(async () => {
//     try {
//       setOverlayLoading(true);
//       await sleep(600);

//       console.log("[SelectDevice] Getting bonded devices...");

//       const bonded: BluetoothDevice[] =
//         await BluetoothModule.getBondedDevices();

//       const devices = bonded.filter((device) =>
//         device.name.toLowerCase().includes("bal")
//       );

//       console.log("[SelectDevice] Found bonded devices:", devices.length);

//       setPairedDevices(devices);
//       setOverlayLoading(false);
//     } catch (error) {
//       console.error("[SelectDevice] Error getting bonded devices:", error);
//       setOverlayLoading(false);
//       toastError("Failed to get paired devices");
//     }
//   }, []);

//   // Scan for new devices using BluetoothModule
//   const scanForNewDevices = useCallback(async () => {
//     try {
//       setIsScanning(true);
//       setShowDiscoveredDevices(true);
//       setDiscoveredDevices([]);
//       setOverlayLoading(true);

//       console.log("[SelectDevice] Starting device scan...");

//       await BluetoothModule.getScanDevices();

//       setOverlayLoading(false);
//     } catch (error) {
//       console.error("[SelectDevice] Scan error:", error);
//       setOverlayLoading(false);
//       setIsScanning(false);
//       toastError("Failed to start scanning");
//       updateDongleSerialNo(null);
//       updateIsGettingDongleDeviceInfo(false);
//     }
//   }, [updateDongleSerialNo, updateIsGettingDongleDeviceInfo]);

//   // Handle device discovery event
//   const onDeviceDiscovered = useCallback((deviceData: DeviceDiscoverEvent) => {
//     const lowerCaseName = deviceData.name?.toLowerCase();
//     if (lowerCaseName && lowerCaseName.includes("bal")) {
//       console.log("[SelectDevice] Discovered device:", deviceData.name);
//       setDiscoveredDevices((prev) => {
//         // Avoid duplicates
//         if (prev.find((d) => d.id === deviceData.id)) {
//           return prev;
//         }
//         return [
//           ...prev,
//           {
//             id: deviceData.id,
//             name: deviceData.name,
//             paired: false,
//           },
//         ];
//       });
//     }
//   }, []);

//   // Handle Bluetooth adapter status
//   const handleBluetoothAdapterStatus = useCallback(
//     (statusData: BluetoothAdapterStatusEvent) => {
//       if (
//         statusData.name === "deviceDiscover" &&
//         statusData.status === "completed"
//       ) {
//         console.log("[SelectDevice] Scan completed");
//         setIsScanning(false);
//       }
//     },
//     []
//   );

//   // Handle Bluetooth device status (pairing)
//   const bluetoothDeviceStatus = useCallback(
//     (statusData: BluetoothDeviceStatusEvent) => {
//       if (statusData.name === "deviceParing") {
//         if (statusData.status === "success" && statusData.device) {
//           console.log(
//             "[SelectDevice] Device paired successfully:",
//             statusData.device.name
//           );
//           setDongleNameFunction(statusData.device.name);
//           connectToDevice(statusData.device.id, statusData.device.name);
//           setPairingInProgress(false);
//           toastSuccess(`${statusData.device.name} is now paired`);

//           // Refresh bonded devices and switch to paired tab
//           getBondedDevices();
//           setShowDiscoveredDevices(false);
//         } else {
//           console.error("[SelectDevice] Pairing failed");
//           toastError("Pairing Failed, Please try again later");
//           setPairingInProgress(false);
//           updateDongleSerialNo(null);
//           updateIsGettingDongleDeviceInfo(false);
//         }
//       }
//     },
//     [
//       connectToDevice,
//       getBondedDevices,
//       updateDongleSerialNo,
//       updateIsGettingDongleDeviceInfo,
//     ]
//   );

//   // Pair and connect to device
//   const pairDevice = async (address: string, name: string) => {
//     try {
//       console.log("[SelectDevice] Pairing device:", name, address);
//       const pairDeviceData = await BluetoothModule.createBond(address);

//       if (pairDeviceData) {
//         setPairingInProgress(true);
//         // Set a 20-second timeout for pairing
//         setTimeout(() => {
//           setPairingInProgress((prev) => {
//             if (prev) {
//               toastError("Connection Failed (#2)");
//               updateDongleSerialNo(null);
//               updateIsGettingDongleDeviceInfo(false);
//             }
//             return false;
//           });
//         }, 20_000);
//       } else {
//         toastError("Connection failed (#3)");
//         updateDongleSerialNo(null);
//         updateIsGettingDongleDeviceInfo(false);
//       }
//     } catch (error) {
//       console.error("[SelectDevice] Pairing error:", error);
//       toastError("Connection failed (#4)");
//       updateDongleSerialNo(null);
//       updateIsGettingDongleDeviceInfo(false);
//     }
//   };

//   // Navigate to device details
//   const navigateToDeviceDetails = (device: BluetoothDevice) => {
//     router.push({
//       pathname: "/devices/[id]",
//       params: {
//         id: device.id,
//         deviceName: device.name,
//         devicePaired: device.paired.toString(),
//       },
//     });
//   };

//   const reProgramFlashing = async () => {
//     try {
//       isFlashingUpdated = true;
//       let totalTime = 0;

//       while (isFlashingUpdated) {
//         await sleep(15);
//         if (totalTime > 5000) {
//           isFlashingUpdated = false;
//           toastError("Connection Failed - Please try again (#5)");
//           updateDongleSerialNo(null);
//           updateIsGettingDongleDeviceInfo(false);
//           setOverlayLoading(false);
//         } else {
//           totalTime += 10;
//         }
//       }
//     } catch (error) {
//       console.error("[SelectDevice] Flashing error:", error);
//     }
//   };

//   // Connect to vehicle
//   const connect = async (address: string, name: string) => {
//     try {
//       setOverlayLoading(true);
//       await setDongleNameFunction(name);
//       await sleep(2);

//       console.log("[SelectDevice] Connecting to vehicle...");

//       const connectSuccess = await connectToDevice(address, name);

//       if (connectSuccess) {
//         console.log("[SelectDevice] Vehicle connection successful");
//         reProgramFlashing();
//       } else {
//         isFlashingUpdated = false;
//         toastError("Vehicle Connection Failed - Please try again (#6)");
//         updateDongleSerialNo(null);
//         updateIsGettingDongleDeviceInfo(false);
//         setOverlayLoading(false);
//       }
//     } catch (error) {
//       console.error("[SelectDevice] Vehicle connection error:", error);
//       toastError("Vehicle Connection Failed - Please try again (#7)");
//       updateDongleSerialNo(null);
//       updateIsGettingDongleDeviceInfo(false);
//       setOverlayLoading(false);
//     }
//   };

//   const onRefresh = useCallback(async () => {
//     setRefreshing(true);
//     if (showDiscoveredDevices) {
//       await scanForNewDevices();
//     } else {
//       await getBondedDevices();
//     }
//     await sleep(1000);
//     setRefreshing(false);
//   }, [showDiscoveredDevices, scanForNewDevices, getBondedDevices]);

//   // Handle updateUI event for config reset
//   // biome-ignore lint/suspicious/noExplicitAny: Event data
//   const onResponse = (response: any) => {
//     if (response.name === "updateUI") {
//       const jsonData = handleJsonParse(response.value);
//       if (jsonData?.value === "ConfigReset") {
//         if (dongleStore.getSerialNo() !== null) {
//           updateIsGettingDongleDeviceInfo(true);
//         }
//         isFlashingUpdated = false;
//         setOverlayLoading(false);
//       }
//     }
//   };

//   const handleAppState = (nextAppState: string) => {
//     console.log("[SelectDevice] App state:", nextAppState);
//     if (nextAppState === "active" && !showDiscoveredDevices) {
//       getBondedDevices();
//     }
//   };

//   const handleBackButton = useCallback(() => {
//     if (isScanning) {
//       BluetoothModule.stopDiscovery();
//       setIsScanning(false);
//     }
//     updateDataTransferSelectionState();
//     return true;
//   }, [isScanning, updateDataTransferSelectionState]);

//   const navigateToAddDevice = async () => {
//     await scanForNewDevices();
//   };

//   // biome-ignore lint/correctness/useExhaustiveDependencies : Initial setup
//   useEffect(() => {
//     console.log("[SelectDevice] Initializing...");
//     getBondedDevices();

//     const appStateListener = AppState.addEventListener(
//       "change",
//       handleAppState
//     );
//     const updateUiListener = eventEmitter.addListener("updateUI", onResponse);
//     const deviceDiscoverListener = eventEmitter.addListener(
//       "deviceDiscover",
//       onDeviceDiscovered
//     );
//     const bluetoothAdapterStatusListener = eventEmitter.addListener(
//       "bluetoothAdapterStatus",
//       handleBluetoothAdapterStatus
//     );
//     const bluetoothDeviceStatusListener = eventEmitter.addListener(
//       "bluetoothDeviceStatus",
//       bluetoothDeviceStatus
//     );

//     return () => {
//       console.log("[SelectDevice] Cleanup");
//       appStateListener.remove();
//       updateUiListener.remove();
//       deviceDiscoverListener.remove();
//       bluetoothAdapterStatusListener.remove();
//       bluetoothDeviceStatusListener.remove();
//       if (isScanning) {
//         BluetoothModule.stopDiscovery();
//       }
//     };
//   }, []);

//   useFocusEffect(
//     useCallback(() => {
//       const subscription = BackHandler.addEventListener(
//         "hardwareBackPress",
//         handleBackButton
//       );
//       return () => subscription.remove();
//     }, [handleBackButton])
//   );

//   const displayedDevices = showDiscoveredDevices
//     ? discoveredDevices
//     : pairedDevices;

//   return (
//     <View className="flex-1 bg-gray-50">
//       <CustomHeader
//         leftButtonFunction={handleBackButton}
//         leftButtonType="back"
//         renderLeftButton
//         renderRightButton
//         rightButtonType="menu"
//         title="SELECT DEVICE"
//       />

//       {/* Tabs */}
//       <View className="px-4 pt-3 pb-2">
//         <View className="flex-row">
//           <TouchableOpacity
//             className={`mr-2 flex-1 rounded-lg py-2 ${showDiscoveredDevices ? "bg-gray-200" : "bg-[#006AD0]"}`}
//             onPress={() => {
//               setShowDiscoveredDevices(false);
//               if (pairedDevices.length === 0) {
//                 getBondedDevices();
//               }
//             }}
//           >
//             <Text
//               className={`text-center font-semibold ${showDiscoveredDevices ? "text-gray-700" : "text-white"}`}
//             >
//               Paired ({pairedDevices.length})
//             </Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             className={`flex-1 rounded-lg py-2 ${showDiscoveredDevices ? "bg-[#006AD0]" : "bg-gray-200"}`}
//             disabled={isScanning}
//             onPress={() => {
//               setShowDiscoveredDevices(true);
//               if (!isScanning) {
//                 scanForNewDevices();
//               }
//             }}
//           >
//             <Text
//               className={`text-center font-semibold ${showDiscoveredDevices ? "text-white" : "text-gray-700"}`}
//             >
//               {isScanning
//                 ? "Scanning..."
//                 : `Discover (${discoveredDevices.length})`}
//             </Text>
//           </TouchableOpacity>
//         </View>
//       </View>

//       <ScrollView
//         className="flex-1"
//         refreshControl={
//           <RefreshControl onRefresh={onRefresh} refreshing={refreshing} />
//         }
//       >
//         {isScanning && (
//           <View className="items-center py-8">
//             <Icon color="#006AD0" name="bluetooth" size={48} />
//             <Text className="mt-4 font-semibold text-[#006AD0] text-base">
//               Scanning for devices...
//             </Text>
//             <Text className="mt-2 text-gray-500 text-sm">
//               Signal strength updates in real-time
//             </Text>
//           </View>
//         )}

//         {displayedDevices.length === 0 && !isScanning ? (
//           <View className="items-center justify-center px-8 pt-24">
//             <TouchableOpacity
//               className="mb-16 h-32 w-32 items-center justify-center rounded-full bg-[#006AD0]"
//               onPress={navigateToAddDevice}
//             >
//               <Icon color="#ffffff" name="plus" size={60} />
//             </TouchableOpacity>

//             <Text className="mb-4 font-bold text-gray-800 text-lg">
//               {showDiscoveredDevices ? "NO NEW DEVICES" : "NO PAIRED DEVICES"}
//             </Text>

//             <Text className="text-center text-base text-gray-600 leading-6">
//               {showDiscoveredDevices
//                 ? "Tap + to scan for nearby BAL devices"
//                 : "No paired devices. Switch to 'Discover' to find devices."}
//             </Text>
//           </View>
//         ) : (
//           <View className="px-4 pt-4">
//             {displayedDevices.map((item) => (
//               <View className="bg-white" key={item.id}>
//                 <TouchableOpacity
//                   className="p-4 active:opacity-70"
//                   onPress={() =>
//                     item.paired
//                       ? connect(item.id, item.name)
//                       : pairDevice(item.id, item.name)
//                   }
//                 >
//                   <View className="flex-row items-start justify-between">
//                     <View className="flex-1 flex-row items-start">
//                       <Icon
//                         color="#000000"
//                         name="bluetooth"
//                         size={28}
//                         style={{ marginRight: 12, marginTop: 2 }}
//                       />

//                       <View className="flex-1 pr-3">
//                         <Text className="mb-1 font-bold text-gray-900 text-lg">
//                           {item.name}
//                         </Text>
//                         <Text className="mb-2 text-gray-500 text-xs">
//                           {item.id}
//                         </Text>

//                         {!item.paired && (
//                           <Text className="font-semibold text-orange-600 text-xs">
//                             TAP TO PAIR
//                           </Text>
//                         )}
//                       </View>
//                     </View>

//                     <View className="items-center">
//                       {!item.paired && (
//                         <View className="rounded-full bg-orange-100 px-2 py-1">
//                           <Text className="font-bold text-orange-600 text-xs">
//                             NEW
//                           </Text>
//                         </View>
//                       )}
//                       {item.paired && (
//                         <TouchableOpacity
//                           onPress={(e) => {
//                             e.stopPropagation();
//                             navigateToDeviceDetails(item);
//                           }}
//                         >
//                           <Icon color="#006AD0" name="info" size={24} />
//                         </TouchableOpacity>
//                       )}
//                     </View>
//                   </View>
//                 </TouchableOpacity>
//               </View>
//             ))}
//           </View>
//         )}
//       </ScrollView>

//       <View className="px-6 pt-2 pb-6">
//         <PrimaryButton
//           disabled={isScanning}
//           onPress={navigateToAddDevice}
//           text={isScanning ? "SCANNING..." : "SCAN FOR NEW DEVICES"}
//         />
//       </View>

//       <OverlayLoading loading={overlayLoading} />
//       <DongleAuthModal />
//     </View>
//   );
// }
