import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { ecuDump, edit_note } from "@/assets/images";
import { Tiles } from "@/components/tiles/tiles";
import { CustomHeader } from "@/components/ui/header";
import { useDataTransferStore } from "@/store/data-transfer-store";

export default function SpecialFunctionsScreen() {
  const router = useRouter();
  const { selectedEcu } = useDataTransferStore();

  useEffect(() => {
    if (!selectedEcu) {
      router.replace("/(main)/devices/select");
    }
  }, [selectedEcu, router]);

  const tilesData = [
    {
      id: "write-vin",
      name: "WRITE \nVIN",
      image: edit_note,
      function: () => router.push("/(main)/vin/write"),
      isActive: selectedEcu?.isVinWrite ?? false,
    },
    {
      id: "offline-analytic",
      name: "OFFLINE \nANALYTIC",
      image: ecuDump,
      function: () => router.push("/(main)/diagnostics/ecu-dump"),
      isActive: selectedEcu?.isEEDumpOperation ?? false,
    },
    {
      id: "write-bin",
      name: "WRITE \nBIN",
      image: edit_note,
      function: () => router.push("/(main)/flashing/write-bin"),
      isActive: selectedEcu?.isBinWrite ?? false,
    },
    {
      id: "write-motor-type",
      name: "WRITE \nMotor Type",
      image: edit_note,
      function: () => router.push("/(main)/motor-type/manual-write"),
      isActive: selectedEcu?.isWriteMotorType ?? false,
    },
  ];

  return (
    <View className="flex-1 bg-primaryBg">
      <CustomHeader
        leftButtonFunction={() => router.back()}
        leftButtonType="back"
        title="Special Function"
      />

      <View className="flex-1 px-5 pt-5">
        <Tiles data={tilesData} />
      </View>
    </View>
  );
}
