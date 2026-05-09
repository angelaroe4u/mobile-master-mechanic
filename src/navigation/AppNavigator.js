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
import TrashScreen from "../screens/TrashScreen";
import MyAccountScreen from "../screens/MyAccountScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabIcon = ({ label, focused, color }) => (
  <View style={{ alignItems: "center", justifyContent: "center", minWidth: 64 }}>
    <Text style={{ fontSize: 22 }}>
      {label === "Home" ? "🏠" : label === "Jobs" ? "🔧" : label === "Parts" ? "🔩" : "⚙️"}
    </Text>
    <Text
      numberOfLines={1}
      allowFontScaling={false}
      style={{
        fontSize: 10,
        color,
        fontWeight: focused ? "800" : "400",
        marginTop: 2,
        textAlign: "center",
        includeFontPadding: false,
      }}
    >
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
          // 2x the previous height — easier to tap on tall phones
          height: 140,
          paddingBottom: 20,
          paddingTop: 12,
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
        ) : (
          // Subscription is no longer an app-level gate. Users can use the
          // whole app without subscribing; DiagChatScreen does its own paywall
          // check on mount. SubscriptionScreen is kept registered so it can
          // still be navigated to manually.
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="DiagChat" component={DiagChatScreen} />
            <Stack.Screen name="DiagResult" component={DiagResultScreen} />
            <Stack.Screen name="DiagList" component={DiagListScreen} />
            <Stack.Screen name="Garage" component={GarageScreen} />
            <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} />
            <Stack.Screen name="Legal" component={LegalScreen} />
            <Stack.Screen name="Trash" component={TrashScreen} />
            <Stack.Screen name="MyAccount" component={MyAccountScreen} />
            <Stack.Screen name="Subscribe" component={SubscriptionScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
