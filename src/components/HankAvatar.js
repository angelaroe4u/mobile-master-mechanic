import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { COLORS, GRADIENTS } from "../constants/theme";
import { LinearGradient } from "expo-linear-gradient";

// Hank mood → image mapping
const HANK_IMAGES = {
  neutral:   require("../../public/images/hank-looking-at-user.jpg"),
  thinking:  require("../../public/images/hank-is-thinking-close-up.jpg"),
  concerned: require("../../public/images/Hank-delivers-bad-news-close-up.jpg"),
  confident: require("../../public/images/Hank-is-happy-close-up.jpg"),
  alarmed:   require("../../public/images/hank-wiping-furrowed-brow.jpg"),
  default:   require("../../public/images/Hank-Headshot.jpg"),
};

export default function HankAvatar({ mood = "default", size = 40 }) {
  const imageSource = HANK_IMAGES[mood] || HANK_IMAGES.default;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={imageSource}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        resizeMode="cover"
      />
    </View>
  );
}

// Smaller chat bubble avatar
export function HankChatAvatar({ mood = "default" }) {
  return <HankAvatar mood={mood} size={32} />;
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  image: {},
});
