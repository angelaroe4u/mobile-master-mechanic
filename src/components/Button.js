import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, GRADIENTS, FONTS, BORDER_RADIUS } from "../constants/theme";

const VARIANT_CONFIG = {
  accent:  { gradient: GRADIENTS.accent, textColor: COLORS.white },
  blue:    { gradient: GRADIENTS.blue,   textColor: COLORS.white },
  green:   { gradient: GRADIENTS.green,  textColor: COLORS.white },
  danger:  { gradient: GRADIENTS.danger, textColor: COLORS.white },
  ghost:   { gradient: null, textColor: COLORS.textM },
};

export default function Button({
  children,
  onPress,
  variant = "accent",
  size = "md",
  full = false,
  disabled = false,
  loading = false,
  icon,
  style,
}) {
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.accent;
  const isSmall = size === "sm";

  const inner = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={config.textColor} />
      ) : (
        <>
          {icon && <Text style={{ marginRight: 6 }}>{icon}</Text>}
          <Text style={[
            styles.text,
            { color: config.textColor, fontSize: isSmall ? 12 : 14 },
          ]}>
            {children}
          </Text>
        </>
      )}
    </>
  );

  const containerStyle = [
    styles.base,
    isSmall ? styles.small : styles.medium,
    full && styles.full,
    disabled && styles.disabled,
    style,
  ];

  if (config.gradient) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
        style={[full && styles.full, style]}
      >
        <LinearGradient
          colors={config.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.base,
            isSmall ? styles.small : styles.medium,
            full && styles.full,
            disabled && styles.disabled,
          ]}
        >
          {inner}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // Ghost variant — no gradient
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        ...containerStyle,
        styles.ghost,
      ]}
    >
      {inner}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BORDER_RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  small: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  medium: {
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  full: {
    width: "100%",
  },
  disabled: {
    opacity: 0.45,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  text: {
    fontFamily: FONTS.bodyBold,
    fontWeight: "700",
    textAlign: "center",
  },
});
