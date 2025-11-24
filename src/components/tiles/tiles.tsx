import { View } from "react-native";
import { Tile, type TileItem } from "./tile";

type TilesProps = {
  gap?: number;
  data?: TileItem[];
  width?: boolean;
  height?: boolean;
  overlayText?: boolean; // New prop for text overlay on image
};

export function Tiles({
  gap = 0,
  data = [],
  width,
  height,
  overlayText = false,
}: TilesProps) {
  return (
    <View className="flex-row flex-wrap">
      {data.map((item, index) => (
        <Tile
          gap={gap}
          height={height}
          index={index}
          item={item}
          key={item.id}
          overlayText={overlayText}
          width={width}
        />
      ))}
    </View>
  );
}
