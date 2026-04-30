import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS, FONTS, BORDER_RADIUS } from "../constants/theme";

// Hank's contextual pro tip — shown inline during diagnosis chat
export default function SupplyTip({ tip, onDismiss }) {
  if (!tip) return null;

  const categoryColors = {
    brakes:     COLORS.red,
    fluids:     COLORS.blue,
    tools:      COLORS.accent,
    electrical: COLORS.purple,
    body:       COLORS.green,
  };

  const color = categoryColors[tip.category] || COLORS.accent;

  return (
    <View style={[styles.container, { borderColor: color + "40" }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>💡</Text>
        <Text style={[styles.label, { color }]}>Hank's Tip</Text>
        <TouchableOpacity onPress={onDismiss} style={styles.dismiss}>
          <Text style={styles.dismissText}>×</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.text}>{tip.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: 14,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  icon: { fontSize: 16, marginRight: 6 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    flex: 1,
  },
  dismiss: { padding: 4 },
  dismissText: { color: COLORS.textM, fontSize: 18, lineHeight: 18 },
  text: {
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 20,
    fontFamily: FONTS.body,
  },
});
