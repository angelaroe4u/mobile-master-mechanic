// ─── SUBSCRIPTION SCREEN (Feature #11) ───────────────────────────────────────
// Freemium paywall with Day Pass and Monthly options
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, GRADIENTS, FONTS } from "../constants/theme";
import { getOfferings, purchasePackage, restorePurchases, presentPaywall } from "../services/subscriptions";
import Button from "../components/Button";
import HankAvatar from "../components/HankAvatar";

export default function SubscriptionScreen() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(null);

  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    const pkgs = await getOfferings();
    setPackages(pkgs);
  };

  const handlePurchase = async (pkg) => {
    setLoading(pkg.identifier);
    const result = await purchasePackage(pkg);
    setLoading(null);

    if (result.success) {
      // Auth state listener handles navigation
    } else if (result.cancelled) {
      // User cancelled — no action
    } else {
      Alert.alert("Purchase Error", result.error || "Something went wrong. Please try again.");
    }
  };

  const handleRestore = async () => {
    setLoading("restore");
    const restored = await restorePurchases();
    setLoading(null);
    if (!restored) {
      Alert.alert("No Purchases Found", "We couldn't find any previous purchases to restore.");
    }
  };

  const monthlyPkg = packages.find((p) => p.identifier?.includes("monthly"));
  const daypassPkg = packages.find((p) => p.identifier?.includes("daypass"));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require("../../public/images/apicon.jpg")}
            style={styles.icon}
            resizeMode="contain"
          />
          <Text style={styles.title}>MOBILE MASTER</Text>
          <Text style={styles.titleAccent}>MECHANIC</Text>
          <Text style={styles.subtitle}>Professional-grade AI diagnostics — in your pocket</Text>
        </View>

        {/* Hank intro */}
        <View style={styles.hankSection}>
          <HankAvatar mood="confident" size={48} />
          <Text style={styles.hankText}>
            "I've diagnosed thousands of vehicles. Let me help you figure out what's going on with yours."
          </Text>
        </View>

        {/* Plans */}
        <View style={styles.plans}>
          {/* Day Pass */}
          <View style={styles.planCard}>
            <Text style={styles.planLabel}>Day Pass</Text>
            <Text style={styles.planPrice}>
              {daypassPkg?.product?.priceString || "$4.99"}
            </Text>
            <Text style={styles.planDesc}>Full access for 24 hours</Text>
            <Button
              full
              onPress={() => daypassPkg && handlePurchase(daypassPkg)}
              loading={loading === daypassPkg?.identifier}
              disabled={!daypassPkg || !!loading}
            >
              Get Day Pass →
            </Button>
          </View>

          {/* Monthly */}
          <LinearGradient colors={["#1a2a1a", "#1a2235"]} style={styles.planCardFeatured}>
            <View style={styles.bestValue}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
            <Text style={styles.planLabel}>Monthly</Text>
            <Text style={styles.planPrice}>
              {monthlyPkg?.product?.priceString || "$19.99"}
              <Text style={styles.planPer}>/mo</Text>
            </Text>
            <Text style={styles.planDesc}>Unlimited diagnostics · All vehicles · Cancel anytime</Text>
            <Button
              full
              variant="green"
              onPress={() => monthlyPkg && handlePurchase(monthlyPkg)}
              loading={loading === monthlyPkg?.identifier}
              disabled={!monthlyPkg || !!loading}
            >
              Start Monthly →
            </Button>
          </LinearGradient>
        </View>

        {/* Restore + fine print */}
        <View style={styles.footer}>
          <Button
            variant="ghost"
            size="sm"
            onPress={handleRestore}
            loading={loading === "restore"}
          >
            Restore Purchases
          </Button>
          <Text style={styles.finePrint}>
            Diagnoses powered by Claude AI · Your first diagnosis is free{"\n"}
            No ads · No data sold · Cancel anytime
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: { alignItems: "center", marginBottom: 24 },
  icon: { width: 56, height: 56, marginBottom: 12 },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.text,
    fontFamily: FONTS.heading,
    letterSpacing: 3,
    lineHeight: 34,
  },
  titleAccent: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.accent,
    fontFamily: FONTS.heading,
    letterSpacing: 3,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textM,
    marginTop: 8,
    textAlign: "center",
    fontFamily: FONTS.body,
  },
  hankSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    gap: 12,
  },
  hankText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textM,
    fontStyle: "italic",
    lineHeight: 20,
    fontFamily: FONTS.body,
  },
  plans: { gap: 14, maxWidth: 360, alignSelf: "center", width: "100%" },
  planCard: {
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 20,
  },
  planCardFeatured: {
    borderWidth: 2,
    borderColor: COLORS.green + "50",
    borderRadius: 16,
    padding: 20,
    position: "relative",
  },
  bestValue: {
    position: "absolute",
    top: -10,
    right: 16,
    backgroundColor: COLORS.green,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 12,
  },
  bestValueText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.white,
    fontFamily: FONTS.bodyBold,
  },
  planLabel: {
    fontSize: 12,
    color: COLORS.textM,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
    fontFamily: FONTS.body,
  },
  planPrice: {
    fontSize: 34,
    fontWeight: "900",
    color: COLORS.text,
    fontFamily: FONTS.heading,
    letterSpacing: 1,
  },
  planPer: { fontSize: 14, color: COLORS.textM },
  planDesc: {
    fontSize: 11,
    color: COLORS.textM,
    marginBottom: 14,
    fontFamily: FONTS.body,
  },
  footer: {
    alignItems: "center",
    marginTop: 20,
    gap: 12,
  },
  finePrint: {
    fontSize: 10,
    color: COLORS.textD,
    textAlign: "center",
    lineHeight: 18,
    fontFamily: FONTS.body,
  },
});
