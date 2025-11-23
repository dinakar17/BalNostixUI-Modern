import { FontAwesome } from "@expo/vector-icons";
import { useEffect } from "react";
import { Dimensions, TouchableOpacity } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useDataTransferStore } from "@/store/data-transfer-store";

const { width } = Dimensions.get("window");

type PulsatingErrorIconProps = {
  isVisible: boolean;
  onError: () => void;
};

export function PulsatingErrorIcon({
  isVisible,
  onError,
}: PulsatingErrorIconProps) {
  const scale = useSharedValue(1);
  const updateIsSessionExpired = useDataTransferStore(
    (state) => state.updateIsSessionExpired
  );

  const callFunctionOnError = () => {
    onError();
    updateIsSessionExpired(false);
  };

  useEffect(() => {
    if (isVisible) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1000 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        false
      );
    } else {
      scale.value = 1;
    }
  }, [isVisible, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!isVisible) {
    return null;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      className="absolute bottom-5 z-50"
      onPress={callFunctionOnError}
      style={{ left: width - 70 }}
    >
      <Animated.View
        className="h-12 w-12 items-center justify-center rounded-full bg-red-500 shadow-xl"
        style={[animatedStyle, { elevation: 8 }]}
      >
        <FontAwesome color="white" name="exclamation-circle" size={24} />
      </Animated.View>
    </TouchableOpacity>
  );
}
