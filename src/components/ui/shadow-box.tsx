import type React from "react";
import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

interface ShadowBoxProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export function ShadowBox({ children, className, ...props }: ShadowBoxProps) {
  return (
    <View
      className={cn(
        "rounded-lg bg-white shadow-lg",
        // Android elevation
        "elevation-3",
        // iOS shadow
        "shadow-gray-400",
        className
      )}
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      }}
      {...props}
    >
      {children}
    </View>
  );
}
