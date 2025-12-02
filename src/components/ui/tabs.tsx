import Entypo from "@expo/vector-icons/Entypo";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

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
  const scrollViewRef = useRef<ScrollView>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollPosition = contentOffset.x;
    const maxScroll = contentSize.width - layoutMeasurement.width;

    // Show left arrow if scrolled past the start
    setShowLeftArrow(scrollPosition > 5);

    // Show right arrow if not at the end
    setShowRightArrow(scrollPosition < maxScroll - 5);
  };

  const handleContentSizeChange = (width: number) => {
    setContentWidth(width);
    // Show right arrow initially if content is wider than container
    setShowRightArrow(width > scrollViewWidth);
  };

  const handleLayout = (event: {
    nativeEvent: { layout: { width: number } };
  }) => {
    const { width } = event.nativeEvent.layout;
    setScrollViewWidth(width);
    // Update right arrow visibility based on initial sizes
    setShowRightArrow(contentWidth > width);
  };

  const scrollToEnd = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const scrollToStart = () => {
    scrollViewRef.current?.scrollTo({ x: 0, animated: true });
  };

  return (
    <View className="relative px-3 py-2">
      {/* Left Arrow */}
      {showLeftArrow && (
        <Pressable
          className="absolute top-0 bottom-0 left-0 z-10 items-center justify-center bg-white/90 px-1"
          onPress={scrollToStart}
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 2, height: 0 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 3,
          }}
        >
          <Entypo color="#374151" name="chevron-left" size={18} />
        </Pressable>
      )}

      <ScrollView
        contentContainerStyle={{ gap: 12 }}
        horizontal
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
        onScroll={handleScroll}
        ref={scrollViewRef}
        scrollEventThrottle={16}
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

      {/* Right Arrow */}
      {showRightArrow && (
        <Pressable
          className="absolute top-0 right-0 bottom-0 z-10 items-center justify-center bg-white/90 px-1"
          onPress={scrollToEnd}
          style={{
            shadowColor: "#000",
            shadowOffset: { width: -2, height: 0 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 3,
          }}
        >
          <Entypo color="#374151" name="chevron-right" size={18} />
        </Pressable>
      )}
    </View>
  );
}
