// ─── THEME CONTEXT ──────────────────────────────────────────────────────────
// Provides light/dark mode switching across the app.
// Screens use `useColors()` to get the active palette and `useThemeMode()` to toggle.

import React, { createContext, useContext, useState, useMemo } from "react";
import {
  DARK_COLORS, LIGHT_COLORS,
  DARK_GRADIENTS, LIGHT_GRADIENTS,
  FONTS,
} from "../constants/theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("dark"); // "dark" | "light"

  const value = useMemo(() => ({
    mode,
    setMode,
    isDark: mode === "dark",
    colors: mode === "dark" ? DARK_COLORS : LIGHT_COLORS,
    gradients: mode === "dark" ? DARK_GRADIENTS : LIGHT_GRADIENTS,
  }), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Returns { colors, gradients, isDark }
export const useColors = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback if used outside provider (shouldn't happen, but safe)
    return { colors: DARK_COLORS, gradients: DARK_GRADIENTS, isDark: true };
  }
  return { colors: ctx.colors, gradients: ctx.gradients, isDark: ctx.isDark };
};

// Returns { mode, setMode, isDark }
export const useThemeMode = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { mode: "dark", setMode: () => {}, isDark: true };
  return { mode: ctx.mode, setMode: ctx.setMode, isDark: ctx.isDark };
};
