import { Dimensions, Image, Pressable, Text, View } from "react-native";
import { cn } from "@/lib/utils";
import { ShadowBox } from "../ui/shadow-box";

const { width: screenWidth } = Dimensions.get("window");

export type TileItem = {
  id: string;
  name: string;
  image: any;
  function: () => void;
  isActive: boolean;
};

type TileProps = {
  gap: number;
  index: number;
  item: TileItem;
  height?: boolean;
  width?: boolean;
};

export function Tile({ gap, index, item, height, width }: TileProps) {
  const tileSize = (screenWidth - 3 * gap) / 2;
  const imageSize = width ? screenWidth / 8 : screenWidth / 6;
  const imageHeight = height ? screenWidth / 8 : screenWidth / 7;

  return (
    <Pressable
      disabled={!item.isActive}
      onPress={item.function}
      style={{
        marginLeft: gap,
        marginTop: index < 2 ? 0 : gap,
      }}
    >
      <ShadowBox
        className={cn(
          "items-center justify-center rounded-2xl",
          !item.isActive && "opacity-50"
        )}
        style={{
          height: tileSize,
          width: tileSize,
        }}
      >
        {/* Icon */}
        <View>
          <Image
            source={item.image}
            style={{
              resizeMode: "contain",
              height: imageHeight,
              width: imageSize,
              tintColor: item.isActive ? undefined : "#9ca3af",
            }}
          />
        </View>

        {/* Label */}
        <View className="mt-4 px-2">
          <Text
            className={cn(
              "text-center font-bold text-base",
              item.isActive ? "text-gray-900" : "text-gray-400"
            )}
          >
            {item.name}
          </Text>
        </View>
      </ShadowBox>
    </Pressable>
  );
}
