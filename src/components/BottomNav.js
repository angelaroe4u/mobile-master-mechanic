// ─── BOTTOM NAV ──────────────────────────────────────────────────────────────
// Custom persistent bottom tab bar that mirrors the look of the native
// MainTabs Tab.Navigator. Mounted at the bottom of every "deep" Stack screen
// (DiagChat, DiagResult, MyAccount, Garage, VehicleDetail, Trash, Legal,
// Subscribe, etc.) so the user always has one-tap access to Home / Jobs /
// Parts / Settings — not just from the four tab-screens.
//
// USAGE:
//   import BottomNav from "../components/BottomNav";
//   ...
//   <SafeAreaView style={{ flex: 1 }}>
//     <YourScreenContent />        {/* should be flex:1 (ScrollView, FlatList, etc.) */}
//     <BottomNav active="Home" />  {/* sits at the bottom as a flex sibling */}
//   </SafeAreaView>
//
// LAYOUT NOTE: BottomNav is NOT absolutely positioned. It takes its 80px
// at the bottom of its parent, and the sibling above it (ScrollView /
// FlatList / chat container) naturally gets the remaining space. No
// extra paddingBottom is needed on caller content.
//
// Each tap calls navigation.navigate("MainTabs", { screen: <name> }) which
// pops back to MainTabs and switches to the target tab. If the user is
// already inside a Tab.Navigator parent (e.g. the screen is a Tab.Screen
// itself), this component renders nothing — the native tab bar already
// handles it.

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import { useColors } from "../context/ThemeContext";

export const BOTTOM_NAV_HEIGHT = 80;

const TABS = [
  { key: "Home",        label: "Home",     icon: "🏠", target: "Home" },
  { key: "Jobs",        label: "Jobs",     icon: "🔧", target: "Jobs" },
  { key: "SuppliesHub", label: "Parts",    icon: "🔩", target: "SuppliesHub" },
  { key: "Settings",    label: "Settings", icon: "⚙️", target: "Settings" },
];

// Walk up the navigation parent chain to detect whether we're rendered
// inside a tab navigator. If so, the native tab bar is already showing
// and we should render nothing to avoid a duplicate.
const useIsInsideTabNavigator = () => {
  const navState = useNavigationState((s) => s);
  const nav = useNavigation();
  let cur = nav;
  // useNavigation walks the parent chain via getParent()
  while (cur) {
    const state = cur.getState?.();
    if (state?.type === "tab") return true;
    cur = cur.getParent?.();
  }
  // also check the direct passed-in state for safety
  if (navState?.type === "tab") return true;
  return false;
};

export default function BottomNav({ active }) {
  const navigation = useNavigation();
  const { colors } = useColors();
  const insideTab = useIsInsideTabNavigator();

  if (insideTab) return null;

  const go = (target) => {
    // Pop back to MainTabs and switch to the target tab. If MainTabs isn't
    // in the stack for some reason, fall back to navigate which will
    // create/push it.
    try {
      navigation.navigate("MainTabs", { screen: target });
    } catch (e) {
      // Last resort
      navigation.navigate(target);
    }
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      ]}
      pointerEvents="box-none"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const tint = isActive ? colors.accent : colors.textD;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => go(tab.target)}
            style={styles.tab}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={[
                styles.label,
                {
                  color: tint,
                  fontWeight: isActive ? "800" : "400",
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    // Sits as a flex sibling at the bottom of its parent (typically
    // SafeAreaView). Not position:absolute -> the screen's content
    // naturally gets the remaining space above the bar, so nothing is
    // hidden behind it. Works for ScrollView, FlatList, chat layouts, etc.
    height: BOTTOM_NAV_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 22 : 14,
    borderTopWidth: 1,
    // subtle shadow above the bar so it has visual lift over content
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
    paddingHorizontal: 4,
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
    textAlign: "center",
    includeFontPadding: false,
  },
});
