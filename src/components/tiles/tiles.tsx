import { View } from "react-native";
import { Tile, type TileItem } from "./tile";

type TilesProps = {
  gap?: number;
  data?: TileItem[];
  width?: boolean;
  height?: boolean;
};

export function Tiles({ gap = 0, data = [], width, height }: TilesProps) {
  return (
    <View className="flex-row flex-wrap">
      {data.map((item, index) => (
        <Tile
          gap={gap}
          height={height}
          index={index}
          item={item}
          key={item.id}
          width={width}
        />
      ))}
    </View>
  );
}
