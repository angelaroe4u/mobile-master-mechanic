// ─── APP NAVIGATION ──────────────────────────────────────────────────────────
import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text } from "react-native";
import { FONTS } from "../constants/theme";
import { useColors } from "../context/ThemeContext";

// Screens
import HomeScreen from "../screens/HomeScreen";
import DiagChatScreen from "../screens/DiagChatScreen";
import DiagResultScreen from "../screens/DiagResultScreen";
import DiagListScreen from "../screens/DiagListScreen";
import SubscriptionScreen from "../screens/SubscriptionScreen";
import SettingsScreen from "../screens/SettingsScreen";
import SuppliesHubScreen from "../screens/SuppliesHubScreen";
import AuthScreen from "../screens/AuthScreen";
import TermsScreen from "../screens/TermsScreen";
import GarageScreen from "../screens/GarageScreen";
import VehicleDetailScreen from "../screens/VehicleDetailScreen";
import LegalScreen from "../screens/LegalScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabIcon = ({ label, focused, color }) => (
  <View style={{ alignItems: "center" }}>
    <Text style={{ fontSize: 22 }}>
      {label === "Home" ? "🏠" : label === "Jobs" ? "🔧" : label === "Parts" ? "🔩" : "⚙️"}
    </Text>
    <Text style={{ fontSize: 9, color, fontWeight: focused ? "800" : "400", marginTop: 2 }}>
      {label}
    </Text>
  </View>
);

function MainTabs({ route }) {
  const { user, diags, userPoints } = route.params || {};
  const { colors } = useColors();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textD,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        initialParams={{ user, diags, userPoints }}
        options={{
          tabBarIcon: ({ focused, color }) => <TabIcon label="Home" focused={focused} color={color} />,
          tabBarLabel: () => null,
        }}
      />
      <Tab.Screen
        name="Jobs"
        component={DiagListScreen}
        initialParams={{ filter: "open" }}
        options={{
          tabBarIcon: ({ focused, color }) => <TabIcon label="Jobs" focused={focused} color={color} />,
          tabBarLabel: () => null,
        }}
      />
      <Tab.Screen
        name="SuppliesHub"
        component={SuppliesHubScreen}
        options={{
          tabBarIcon: ({ focused, color }) => <TabIcon label="Parts" focused={focused} color={color} />,
          tabBarLabel: () => null,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused, color }) => <TabIcon label="Settings" focused={focused} color={color} />,
          tabBarLabel: () => null,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator({ isAuthenticated, hasSubscription, hasAcceptedTerms }) {
  const { colors, isDark } = useColors();

  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        dark: isDark,
        colors: {
          ...DefaultTheme.colors,
          primary: colors.accent,
          background: colors.bg,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.accent,
        },
        fonts: {
          ...DefaultTheme.fonts,
          regular: { fontFamily: "IBMPlexMono_400Regular", fontWeight: "400" },
          medium:  { fontFamily: "IBMPlexMono_700Bold",    fontWeight: "700" },
          bold:    { fontFamily: "IBMPlexMono_700Bold",    fontWeight: "700" },
          heavy:   { fontFamily: "BlackOpsOne_400Regular", fontWeight: "400" },
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : !hasAcceptedTerms ? (
          <Stack.Screen name="Terms" component={TermsScreen} />
        ) : !hasSubscription ? (
          <Stack.Screen name="Subscribe" component={SubscriptionScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="DiagChat" component={DiagChatScreen} />
            <Stack.Screen name="DiagResult" component={DiagResultScreen} />
            <Stack.Screen name="DiagList" component={DiagListScreen} />
            <Stack.Screen name="Garage" component={GarageScreen} />
            <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} />
            <Stack.Screen name="Legal" component={LegalScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
