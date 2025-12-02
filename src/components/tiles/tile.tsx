import Entypo from "@expo/vector-icons/Entypo";
import { Dimensions, Image, Pressable, Text, View } from "react-native";
import { ShadowBox } from "../ui/shadow-box";

const { width: screenWidth } = Dimensions.get("window");

export type TileItem = {
  id: string;
  name: string;
  image: any;
  function: () => void;
  isActive?: boolean;
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
        disabled={!overlayText}
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
            opacity: overlayText ? 1 : 0.5,
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
          borderWidth: overlayText ? 3 : 0,
          borderColor: overlayText ? "#22c55e" : "transparent",
        }}
      >
        {overlayText && (
          /* Green arrow indicator - only for overlay mode */
          <View
            style={{
              position: "absolute",
              top: 0,
              right: 2,
              zIndex: 10,
            }}
          >
            <Entypo color="#22c55e" name="arrow-bold-up" size={24} />
          </View>
        )}
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
