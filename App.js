// ─── MOBILE MASTER MECHANIC — App Entry Point ───────────────────────────────
// Powered by Angie's Auto Supplies
import React, { useState, useEffect } from "react";
import { StatusBar, ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  BebasNeue_400Regular,
} from "@expo-google-fonts/bebas-neue";
import {
  BlackOpsOne_400Regular,
} from "@expo-google-fonts/black-ops-one";
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_700Bold,
} from "@expo-google-fonts/ibm-plex-mono";

import AppNavigator from "./src/navigation/AppNavigator";
import { DiagnosisProvider } from "./src/context/DiagnosisContext";
import { ThemeProvider, useColors } from "./src/context/ThemeContext";
import { COLORS } from "./src/constants/theme";
import { purgeExpired } from "./src/services/trash";
import { recordBuildIfNew } from "./src/services/buildInfo";
import { backfillGarageVehicles } from "./src/services/firestore";

export default function App() {
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    BlackOpsOne_400Regular,
    IBMPlexMono_400Regular,
    IBMPlexMono_700Bold,
  });

  const [user, setUser] = useState(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // DEV MODE — bypass Firebase auth with mock user
    setUser({ uid: "dev-user-001", name: "Angela", email: "angelaroe4u@gmail.com" });
    setHasSubscription(true);
    setHasAcceptedTerms(true);
    setLoading(false);

    // Auto-purge trash items older than 14 days
    purgeExpired().catch((e) => console.warn("[trash] purge failed:", e.message));
    recordBuildIfNew().catch((e) => console.warn("[buildInfo] recordBuildIfNew failed:", e.message));
    backfillGarageVehicles().catch((e) => console.warn("[firestore] backfillGarageVehicles failed:", e.message));
  }, []);

  if (!fontsLoaded || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <DiagnosisProvider>
        <SafeAreaProvider>
          <ThemedApp
            isAuthenticated={!!user}
            hasSubscription={hasSubscription}
            hasAcceptedTerms={hasAcceptedTerms}
          />
        </SafeAreaProvider>
      </DiagnosisProvider>
    </ThemeProvider>
  );
}

// Inner component that can use the theme context
function ThemedApp({ isAuthenticated, hasSubscription, hasAcceptedTerms }) {
  const { colors, isDark } = useColors();
  return (
    <>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.bg}
      />
      <AppNavigator
        isAuthenticated={isAuthenticated}
        hasSubscription={hasSubscription}
        hasAcceptedTerms={hasAcceptedTerms}
      />
    </>
  );
}
