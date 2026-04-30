import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, FONTS } from "../constants/theme";

export default function Badge({ children, color = COLORS.accent }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color + "40" }]}>
      <Text style={[styles.text, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 9,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: FONTS.bodyBold,
  },
});
