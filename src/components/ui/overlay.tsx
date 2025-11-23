import { Image, type ImageSource } from "expo-image";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { infoIcon } from "@/assets/images";
import { cn } from "@/lib/utils";
import { PrimaryButton, WhiteButton } from "./button";

type OverlayViewProps = {
  visible?: boolean;
  topIcon?: ImageSource;
  title?: string;
  description?: string;
  secondDescription?: string;
  whiteButtonText?: string;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  whiteButtonOnPress?: () => void;
  primaryButtonOnPress?: () => void;
  secondaryButtonOnPress?: () => void;
  renderOnlyPrimaryButton?: boolean;
  renderOnlyWhiteButton?: boolean;
  renderOnlySecondaryButton?: boolean;
  primaryButtonLoading?: boolean;
  secondaryButtonLoading?: boolean;
  renderNoButton?: boolean;
  flexDirectionColumn?: boolean;
};

export function OverlayView({
  visible = true,
  topIcon = infoIcon,
  title = "",
  description = "",
  secondDescription = "",
  whiteButtonText = "",
  primaryButtonText = "",
  secondaryButtonText = "",
  whiteButtonOnPress = () => null,
  primaryButtonOnPress = () => null,
  secondaryButtonOnPress = () => null,
  renderOnlyPrimaryButton = false,
  renderOnlyWhiteButton = false,
  renderOnlySecondaryButton = false,
  primaryButtonLoading = false,
  secondaryButtonLoading = false,
  renderNoButton = false,
  flexDirectionColumn = false,
}: OverlayViewProps) {
  if (!visible) {
    return null;
  }

  const renderButtons = () => {
    if (renderNoButton) {
      return null;
    }

    if (renderOnlyPrimaryButton) {
      return (
        <View className="mt-6">
          <PrimaryButton
            className="w-full"
            isLoading={primaryButtonLoading}
            onPress={primaryButtonOnPress}
            text={primaryButtonText}
          />
        </View>
      );
    }

    if (renderOnlyWhiteButton) {
      return (
        <View className="mt-6">
          <WhiteButton
            className="w-full"
            onPress={whiteButtonOnPress}
            text={whiteButtonText}
          />
        </View>
      );
    }

    if (renderOnlySecondaryButton) {
      return (
        <View className="mt-6">
          <WhiteButton
            className="w-full"
            isLoading={secondaryButtonLoading}
            onPress={secondaryButtonOnPress}
            text={secondaryButtonText}
          />
        </View>
      );
    }

    // Default: Both buttons
    return (
      <View
        className={cn(
          "mt-6 gap-3",
          flexDirectionColumn ? "flex-col" : "flex-row"
        )}
      >
        <WhiteButton
          className="flex-1"
          onPress={whiteButtonOnPress}
          text={whiteButtonText}
        />
        <PrimaryButton
          className="flex-1"
          isLoading={primaryButtonLoading}
          onPress={primaryButtonOnPress}
          text={primaryButtonText}
        />
      </View>
    );
  };

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 p-6">
        <Pressable
          className="w-full max-w-md rounded-2xl bg-white p-6"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <View className="mb-4 items-center">
            <Image
              className="h-12 w-12"
              contentFit="contain"
              source={topIcon}
            />
          </View>

          {/* Title */}
          {title && (
            <Text className="mb-3 text-center font-bold text-gray-800 text-xl">
              {title}
            </Text>
          )}

          {/* Description */}
          {description && (
            <Text className="mb-2 text-center text-base text-gray-600">
              {description}
            </Text>
          )}

          {/* Second Description */}
          {secondDescription && (
            <Text className="text-center text-gray-500 text-sm">
              {secondDescription}
            </Text>
          )}

          {/* Buttons */}
          {renderButtons()}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type OverlayLoadingProps = {
  loading?: boolean;
  message?: string;
};

export function OverlayLoading({
  loading = true,
  message,
}: OverlayLoadingProps) {
  if (!loading) {
    return null;
  }

  return (
    <View className="absolute inset-0 z-50 items-center justify-center bg-black/50">
      <View className="min-w-[200px] items-center rounded-2xl bg-white p-6">
        <ActivityIndicator color="#009CDE" size="large" />
        {message && (
          <Text className="mt-4 text-center text-base text-gray-700">
            {message}
          </Text>
        )}
      </View>
    </View>
  );
}
