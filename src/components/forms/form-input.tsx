import { Text, TextInput, type TextInputProps, View } from "react-native";
import { cn } from "@/lib/utils";

interface FormInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  required?: boolean;
}

export function FormInput({
  label,
  error,
  helperText,
  containerClassName,
  labelClassName,
  inputClassName,
  required = false,
  ...props
}: FormInputProps) {
  return (
    <View className={cn("mb-4", containerClassName)}>
      {/* Label */}
      {label && (
        <Text
          className={cn(
            "mb-2 font-semibold text-gray-700 text-sm",
            labelClassName
          )}
        >
          {label}
          {required && <Text className="text-red-500"> *</Text>}
        </Text>
      )}

      {/* Input */}
      <TextInput
        className={cn(
          "rounded-lg border px-4 py-3 text-base",
          error ? "border-red-500" : "border-gray-300",
          "focus:border-blue-500",
          props.editable === false && "bg-gray-100",
          inputClassName
        )}
        placeholderTextColor="#9ca3af"
        {...props}
      />

      {/* Error Message */}
      {error && <Text className="mt-1 text-red-500 text-xs">{error}</Text>}

      {/* Helper Text */}
      {helperText && !error && (
        <Text className="mt-1 text-gray-500 text-xs">{helperText}</Text>
      )}
    </View>
  );
}
