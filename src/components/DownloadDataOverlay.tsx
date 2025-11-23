import { ActivityIndicator, Image, Text, View } from "react-native";
import { Bar as ProgressBar } from "react-native-progress";
import { CustomHeader } from "@/components/ui/header";
import { ShadowBox } from "@/components/ui/shadow-box";
import { colors } from "@/constants/colors";

type DownloadDataOverlayProps = {
  totalFilesDownloaded?: number;
  totalFilesToDownload?: number;
  isSettingUp?: boolean;
  visible?: boolean;
};

const getIntValue = (value: unknown): number => {
  const intValue = Number.parseInt(String(value), 10);
  if (Number.isNaN(intValue)) {
    return 0;
  }
  return intValue;
};

const getPercentage = (done: number, total: number): number => {
  const doneInt = getIntValue(done);
  const totalInt = getIntValue(total);
  if (totalInt === 0) {
    return 0;
  }
  return Number.parseFloat(((doneInt / total) * 100).toFixed(2));
};

export default function DownloadDataOverlay({
  totalFilesDownloaded = 0,
  totalFilesToDownload = 0,
  isSettingUp = false,
  visible = true,
}: DownloadDataOverlayProps) {
  if (!visible) {
    return null;
  }

  const progress =
    getPercentage(totalFilesDownloaded, totalFilesToDownload) / 100;

  return (
    <View className="flex-1 bg-primaryBg">
      <CustomHeader
        leftButtonType="back"
        renderLeftButton
        title="DOWNLOAD DATA"
      />

      <View className="flex-1 px-8 py-16">
        <ShadowBox className="flex-1 items-center justify-center rounded-3xl">
          <View
            className="mb-6 h-32 w-32 items-center justify-center rounded-full border-2"
            style={{ borderColor: colors.primaryColor }}
          >
            <Image
              className="h-16 w-16"
              resizeMode="contain"
              source={require("@/assets/Images/images.file.png")}
            />
          </View>

          <Text className="mb-6 px-8 text-center font-primaryBold text-lg text-textSecondary leading-7">
            {isSettingUp
              ? "Setting up initial configuration..."
              : "Downloading Data, Please Wait ...."}
          </Text>

          {!isSettingUp && (
            <>
              <ProgressBar
                animated={false}
                borderColor="#f4f4f4"
                borderRadius={4}
                color={colors.primaryColor}
                height={8}
                progress={progress}
                unfilledColor="#f4f4f4"
                width={280}
              />
              <View className="mt-4">
                <Text className="font-primaryBold text-sm text-textSecondary">
                  Controllers: {totalFilesDownloaded}/{totalFilesToDownload}
                </Text>
              </View>
            </>
          )}

          {isSettingUp && (
            <>
              <ActivityIndicator
                className="my-2"
                color={colors.primaryColor}
                size="large"
              />
              <View className="mt-3 items-center px-8">
                <Text className="text-center font-primaryRegular text-sm text-textSecondary">
                  Please wait while we prepare everything
                </Text>
                <Text className="mt-3 text-center font-primaryBold text-base text-primary">
                  Please keep the vehicle on
                </Text>
              </View>
            </>
          )}
        </ShadowBox>
      </View>
    </View>
  );
}
