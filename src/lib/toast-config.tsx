import { Text, TouchableOpacity, View } from "react-native";
import Toast, { type BaseToastProps } from "react-native-toast-message";

/**
 * Toast configuration for react-native-toast-message
 */
export const toastConfig = {
  success: (props: BaseToastProps) => (
    <View className="w-full px-4">
      <TouchableOpacity
        className="w-full rounded-xl bg-green-500 px-4 py-4"
        onPress={() => Toast.hide()}
      >
        <Text className="font-bold text-sm text-white tracking-wide">
          {props.text1}
        </Text>
        {props.text2 && props.text2.length > 0 && (
          <Text className="mt-2 font-bold text-white text-xs tracking-wide">
            {props.text2}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  ),

  error: (props: BaseToastProps) => (
    <View className="w-full px-4">
      <TouchableOpacity
        className="w-full rounded-xl bg-red-500 px-4 py-4"
        onPress={() => Toast.hide()}
      >
        <Text className="font-bold text-sm text-white tracking-wide">
          {props.text1}
        </Text>
        {props.text2 && props.text2.length > 0 && (
          <Text className="mt-2 font-bold text-white text-xs tracking-wide">
            {props.text2}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  ),

  info: (props: BaseToastProps) => (
    <View className="w-full px-4">
      <TouchableOpacity
        className="w-full rounded-xl px-4 py-4"
        onPress={() => Toast.hide()}
        style={{ backgroundColor: "#f97316" }}
      >
        <Text className="font-bold text-sm text-white tracking-wide">
          {props.text1}
        </Text>
        {props.text2 && props.text2.length > 0 && (
          <Text className="mt-2 font-bold text-white text-xs tracking-wide">
            {props.text2}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  ),
};
