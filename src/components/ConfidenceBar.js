import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, GRADIENTS, FONTS } from "../constants/theme";

export default function ConfidenceBar({ pct = 0 }) {
  const barColor = pct >= 95 ? GRADIENTS.green : pct >= 70 ? GRADIENTS.accent : GRADIENTS.blue;
  const labelColor = pct >= 95 ? COLORS.green : pct >= 70 ? COLORS.accent : COLORS.textM;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Diagnostic Confidence</Text>
        <Text style={[styles.pct, { color: labelColor }]}>{pct}%</Text>
      </View>
      <View style={styles.track}>
        <LinearGradient
          colors={barColor}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${Math.min(pct, 100)}%` }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  label: {
    fontSize: 10,
    color: COLORS.textM,
    fontFamily: FONTS.body,
  },
  pct: {
    fontSize: 10,
    fontWeight: "800",
    fontFamily: FONTS.bodyBold,
  },
  track: {
    height: 5,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
});
