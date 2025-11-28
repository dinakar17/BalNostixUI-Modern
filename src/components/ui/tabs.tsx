import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

type Tab = {
  id: string;
  label: string;
};

type TabsProps = {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children?: ReactNode;
};

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <View className="px-3 py-2">
      <ScrollView
        contentContainerStyle={{ gap: 12 }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              className={`min-w-[100px] items-center justify-center rounded-lg px-2 py-1 ${
                isActive ? "bg-blue-600" : "border border-gray-300 bg-white"
              }`}
              key={tab.id}
              onPress={() => onTabChange(tab.id)}
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isActive ? 0.15 : 0,
                shadowRadius: 3,
                elevation: isActive ? 3 : 0,
              }}
            >
              <Text
                className={`font-bold text-sm ${
                  isActive ? "text-white" : "text-gray-700"
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
