import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { cn } from "@/lib/utils";

type ButtonProps = {
  text?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  className?: string;
  inactive?: boolean;
  isLoading?: boolean;
  variant?: "primary" | "secondary" | "white" | "outline";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
};

export function Button({
  text = "",
  onPress = () => null,
  onLongPress = () => null,
  className = "",
  inactive = false,
  isLoading = false,
  variant = "primary",
  size = "md",
  disabled = false,
}: ButtonProps) {
  const isDisabled = inactive || isLoading || disabled;

  const sizeClasses = {
    sm: "h-10 px-4",
    md: "h-12 px-6",
    lg: "h-14 px-8",
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  // Primary Button with Gradient (Blue)
  if (variant === "primary") {
    return (
      <LinearGradient
        className={cn("overflow-hidden rounded-xl", className)}
        colors={isDisabled ? ["#7f7f70", "#575757"] : ["#009CDE", "#003087"]}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          className={cn("items-center justify-center", sizeClasses[size])}
          disabled={isDisabled}
          onLongPress={onLongPress}
          onPress={onPress}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text
              className={cn(
                "font-bold text-white tracking-wide",
                textSizeClasses[size]
              )}
            >
              {text}
            </Text>
          )}
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  // Secondary Button with Gradient (Orange)
  if (variant === "secondary") {
    return (
      <LinearGradient
        className={cn("overflow-hidden rounded-xl", className)}
        colors={isDisabled ? ["#7f7f70", "#575757"] : ["#FF6B35", "#FF4500"]}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          className={cn("items-center justify-center", sizeClasses[size])}
          disabled={isDisabled}
          onLongPress={onLongPress}
          onPress={onPress}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text
              className={cn(
                "font-bold text-white tracking-wide",
                textSizeClasses[size]
              )}
            >
              {text}
            </Text>
          )}
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  // White Button
  if (variant === "white") {
    return (
      <View
        className={cn(
          "overflow-hidden rounded-xl border border-gray-800 bg-white",
          className
        )}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          className={cn(
            "items-center justify-center",
            sizeClasses[size],
            isDisabled && "opacity-50"
          )}
          disabled={isDisabled}
          onLongPress={onLongPress}
          onPress={onPress}
        >
          {isLoading ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text
              className={cn(
                "font-bold text-gray-800 tracking-wide",
                textSizeClasses[size]
              )}
            >
              {text}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Outline Button
  if (variant === "outline") {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        className={cn(
          "items-center justify-center rounded-xl border-2 border-blue-600 bg-transparent",
          sizeClasses[size],
          isDisabled && "border-gray-400 opacity-50",
          className
        )}
        disabled={isDisabled}
        onLongPress={onLongPress}
        onPress={onPress}
      >
        {isLoading ? (
          <ActivityIndicator color="#1976d2" />
        ) : (
          <Text
            className={cn(
              "font-bold tracking-wide",
              textSizeClasses[size],
              isDisabled ? "text-gray-400" : "text-blue-600"
            )}
          >
            {text}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return null;
}

// Legacy component names for backward compatibility
export const PrimaryButton = (props: ButtonProps) => (
  <Button {...props} variant="primary" />
);

export const WhiteButton = (props: ButtonProps) => (
  <Button {...props} variant="white" />
);

export const SecondaryButton = (props: ButtonProps) => (
  <Button {...props} variant="secondary" />
);
