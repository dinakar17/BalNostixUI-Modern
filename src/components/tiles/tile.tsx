import { Dimensions, Image, Pressable, Text, View } from "react-native";
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
  overlayText?: boolean; // New prop for text overlay on image
};

export function Tile({
  gap,
  index,
  item,
  height,
  width,
  overlayText = false,
}: TileProps) {
  const tileSize = (screenWidth - 3 * gap) / 2;
  const imageWidth = width ? screenWidth / 8 : screenWidth / 6;
  const imageHeight = height ? screenWidth / 8 : screenWidth / 7;

  // Inactive state - separate render
  if (!item.isActive) {
    return (
      <Pressable
        disabled
        onPress={item.function}
        style={{
          marginLeft: gap,
          marginTop: index < 2 ? 0 : gap,
        }}
      >
        <ShadowBox
          style={{
            borderRadius: 20,
            height: tileSize,
            width: tileSize,
            justifyContent: "center",
            alignItems: "center",
            opacity: 0.5,
          }}
        >
          {overlayText ? (
            // Overlay text mode - text on top of image
            <View
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Image
                source={item.image}
                style={{
                  position: "absolute",
                  resizeMode: "cover",
                  height: "100%",
                  width: "100%",
                  borderRadius: 20,
                  tintColor: "gray",
                }}
              />
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 16,
                  fontWeight: "bold",
                  color: "white",
                  zIndex: 1,
                  textShadowColor: "rgba(0, 0, 0, 0.75)",
                  textShadowOffset: { width: 1, height: 1 },
                  textShadowRadius: 3,
                  paddingHorizontal: 10,
                }}
              >
                {item.name}
              </Text>
            </View>
          ) : (
            // Standard mode - text below image
            <>
              <View>
                <Image
                  source={item.image}
                  style={{
                    resizeMode: "contain",
                    height: imageHeight,
                    width: imageWidth,
                    justifyContent: "center",
                    alignItems: "center",
                    tintColor: "gray",
                  }}
                />
              </View>
              <View style={{ marginTop: 16, padding: 5 }}>
                <Text
                  style={{
                    textAlign: "center",
                    fontSize: 16,
                    fontWeight: "bold",
                    color: "black",
                  }}
                >
                  {item.name}
                </Text>
              </View>
            </>
          )}
        </ShadowBox>
      </Pressable>
    );
  }

  // Active state
  return (
    <Pressable
      onPress={item.function}
      style={{
        marginLeft: gap,
        marginTop: index < 2 ? 0 : gap,
      }}
    >
      <ShadowBox
        style={{
          borderRadius: 20,
          height: tileSize,
          width: tileSize,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {overlayText ? (
          // Overlay text mode - text on top of image
          <View
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              justifyContent: "center",
              alignItems: "center",
              padding: 10,
            }}
          >
            <Image
              source={item.image}
              style={{
                position: "absolute",
                resizeMode: "cover",
                height: "100%",
                width: "100%",
                borderRadius: 20,
              }}
            />
            <Text
              style={{
                textAlign: "center",
                fontSize: 20,
                fontWeight: "bold",
                color: "black",
                zIndex: 1,
                paddingHorizontal: 10,
              }}
            >
              {item.name}
            </Text>
          </View>
        ) : (
          // Standard mode - text below image
          <View style={{ alignItems: "center" }}>
            <View>
              <Image
                source={item.image}
                style={{
                  resizeMode: "contain",
                  height: imageHeight,
                  width: imageWidth,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              />
            </View>
            <View style={{ marginTop: 16, padding: 6 }}>
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 16,
                  fontWeight: "bold",
                  color: "black",
                }}
              >
                {item.name}
              </Text>
            </View>
          </View>
        )}
      </ShadowBox>
    </Pressable>
  );
}
