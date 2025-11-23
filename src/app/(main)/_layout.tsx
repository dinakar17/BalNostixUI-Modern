import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function MainLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "simple_push",
        }}
      >
        {/* Main entry point */}
        <Stack.Screen name="index" />

        {/* Device setup routes */}
        <Stack.Screen name="devices/select" />

        {/* VIN routes */}
        <Stack.Screen name="vin/scan-barcode" />
        <Stack.Screen name="vin/read" />

        {/* Controller routes */}
        <Stack.Screen name="controllers/index" />
        <Stack.Screen name="controllers/operations" />

        {/* Parameter routes */}
        <Stack.Screen name="parameters/read" />
        <Stack.Screen name="parameters/write" />

        {/* Diagnostic routes */}
        <Stack.Screen name="diagnostics/error-codes" />
        <Stack.Screen name="diagnostics/actuator" />
        <Stack.Screen name="diagnostics/ecu-dump" />

        {/* Flashing routes */}
        <Stack.Screen name="flashing/controller-flash" />
        <Stack.Screen name="flashing/write-bin" />
        <Stack.Screen name="flashing/flash-success" />

        {/* Select Data Transfer */}
        <Stack.Screen name="data-transfer-mode/select" />

        {/* Motor Type routes */}
        <Stack.Screen name="motor-type/write" />
        <Stack.Screen name="motor-type/manual-write" />
      </Stack>
    </>
  );
}
