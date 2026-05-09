// ─── MY ACCOUNT SCREEN ───────────────────────────────────────────────────────
// Centralized place for the user to see their subscription status, buy a
// subscription / day pass, manage their existing subscription, restore
// purchases, and view their bonus credits.
//
// Reachable from HomeScreen → "My Account" button.

import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav, { BOTTOM_NAV_HEIGHT } from "../components/BottomNav";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, FONTS } from "../constants/theme";
import { useColors } from "../context/ThemeContext";
import {
  checkSubscriptionAccess,
  presentPaywall,
  presentCustomerCenter,
  restorePurchases,
  productLabel,
} from "../services/subscriptions";
import {
  getUsageState,
  hasActiveBonusWindow,
} from "../services/hankUsage";
import { getCurrentUser } from "../services/firebase";

export default function MyAccountScreen({ navigation }) {
  const { colors } = useColors();
  const user = getCurrentUser();

  const [loading, setLoading]   = useState(true);
  const [working, setWorking]   = useState(false); // for subscribe / restore actions
  const [sub, setSub]           = useState(null);
  const [usage, setUsage]       = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        checkSubscriptionAccess(),
        getUsageState(),
      ]);
      setSub(s);
      setUsage(u);
    } catch (e) {
      console.warn("[MyAccount] refresh failed:", e?.message ?? e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const handleSubscribe = async () => {
    setWorking(true);
    try {
      const result = await presentPaywall();
      if (result === "PURCHASED" || result === "RESTORED") {
        await refresh();
      }
    } catch (e) {
      Alert.alert("Purchase issue", e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setWorking(false);
    }
  };

  const handleManage = async () => {
    setWorking(true);
    try {
      await presentCustomerCenter();
      await refresh();
    } catch (e) {
      Alert.alert("Couldn't open subscription manager", e?.message ?? "Try again from the Play Store directly.");
    } finally {
      setWorking(false);
    }
  };

  const handleRestore = async () => {
    setWorking(true);
    try {
      const ok = await restorePurchases();
      if (ok) {
        Alert.alert("Restored", "Your previous purchases have been restored.");
      } else {
        Alert.alert("Nothing to restore", "We didn't find any active purchases on this Google account.");
      }
      await refresh();
    } catch (e) {
      Alert.alert("Restore failed", e?.message ?? "Try again in a moment.");
    } finally {
      setWorking(false);
    }
  };

  const isPaid    = !!sub?.isActive;
  const bonusActive = hasActiveBonusWindow();
  const totalAccess = isPaid || bonusActive || (usage?.bonusChats ?? 0) > 0 || (usage?.bonusPasses ?? 0) > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>

      {/* ── Header ──────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MY ACCOUNT</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Account info ─────────────────────────── */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowIcon}>👤</Text>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{user?.name || "User"}</Text>
              <Text style={styles.rowSub}>{user?.email || "Not signed in"}</Text>
            </View>
          </View>
        </View>

        {/* ── Subscription status hero card ────────── */}
        <Text style={styles.sectionLabel}>Subscription</Text>
        {loading ? (
          <View style={[styles.section, { padding: 24, alignItems: "center" }]}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        ) : (
          <View style={styles.section}>
            <LinearGradient
              colors={isPaid ? ["#0e1a0e", "#1a2a1a"] : ["#1a1a2e", "#16213e"]}
              style={styles.statusCard}
            >
              <Text style={[
                styles.statusBadge,
                { color: isPaid ? COLORS.green : COLORS.accent },
              ]}>
                {isPaid ? "● ACTIVE" : "○ FREE"}
              </Text>
              <Text style={styles.statusTitle}>
                {isPaid ? "Mobile Master Mechanic Pro" : "Free Account"}
              </Text>
              {isPaid && productLabel(sub?.type) ? (
                <Text style={styles.statusPlan}>{productLabel(sub?.type)}</Text>
              ) : null}
              {isPaid && sub?.expiresAt ? (
                <Text style={styles.statusMeta}>
                  {sub.willRenew ? "Renews" : "Expires"} {new Date(sub.expiresAt).toLocaleDateString()}
                </Text>
              ) : (
                <Text style={styles.statusMeta}>
                  Subscribe for unlimited Hank diagnoses, work orders, and more.
                </Text>
              )}
            </LinearGradient>
          </View>
        )}

        {/* ── Bonus credits ──────────────────────────── */}
        {usage && (usage.bonusChats > 0 || usage.bonusPasses > 0 || bonusActive) && (
          <>
            <Text style={styles.sectionLabel}>Bonus Credits</Text>
            <View style={styles.section}>
              {usage.bonusChats > 0 && (
                <View style={styles.row}>
                  <Text style={styles.rowIcon}>💬</Text>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{usage.bonusChats} Bonus Diagnos{usage.bonusChats === 1 ? "is" : "es"}</Text>
                    <Text style={styles.rowSub}>Earned from rank rewards. Used automatically.</Text>
                  </View>
                </View>
              )}
              {usage.bonusPasses > 0 && (
                <View style={styles.row}>
                  <Text style={styles.rowIcon}>🎟️</Text>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{usage.bonusPasses} Bonus 24-Hour Pass{usage.bonusPasses === 1 ? "" : "es"}</Text>
                    <Text style={styles.rowSub}>Tap to activate one when you need Hank for a stretch.</Text>
                  </View>
                </View>
              )}
              {bonusActive && (
                <View style={styles.row}>
                  <Text style={styles.rowIcon}>⏱️</Text>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>Bonus Pro access</Text>
                    <Text style={styles.rowSub}>
                      Active until {new Date(usage.bonusUntilIso).toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {/* ── Actions ────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Manage</Text>
        <View style={styles.section}>
          {isPaid ? (
            <>
              <TouchableOpacity onPress={handleManage} disabled={working} style={[styles.row, working && { opacity: 0.5 }]} activeOpacity={0.7}>
                <Text style={styles.rowIcon}>💳</Text>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Manage Subscription</Text>
                  <Text style={styles.rowSub}>Change plan, update payment, or cancel</Text>
                </View>
                <Text style={styles.rowArrow}>→</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={handleSubscribe} disabled={working} style={[styles.row, styles.rowPrimary, working && { opacity: 0.5 }]} activeOpacity={0.7}>
                <Text style={styles.rowIcon}>⭐</Text>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowTitle, { color: COLORS.accent }]}>Subscribe / Buy a Day Pass</Text>
                  <Text style={styles.rowSub}>See all plans — 24-hour, weekly, monthly, annual</Text>
                </View>
                <Text style={[styles.rowArrow, { color: COLORS.accent }]}>→</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={handleRestore} disabled={working} style={[styles.row, working && { opacity: 0.5 }]} activeOpacity={0.7}>
            <Text style={styles.rowIcon}>🔄</Text>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Restore Purchases</Text>
              <Text style={styles.rowSub}>Re-link a subscription you bought earlier on this Google account</Text>
            </View>
            <Text style={styles.rowArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* ── Free user education ────────────────────── */}
        {!totalAccess && (
          <View style={[styles.section, styles.eduCard]}>
            <Text style={styles.eduTitle}>What's free vs. Pro?</Text>
            <Text style={styles.eduLine}>
              <Text style={styles.eduBold}>Free:</Text> Garage, jobs, parts tracker, work order viewing, 1 free Hank diagnosis.
            </Text>
            <Text style={styles.eduLine}>
              <Text style={styles.eduBold}>Pro:</Text> Unlimited Hank diagnoses + work orders.
            </Text>
          </View>
        )}

        {/* ── Footer link to full settings ───────────── */}
        <TouchableOpacity
          onPress={() => navigation.navigate("MainTabs", { screen: "Settings" })}
          style={styles.footerLink}
        >
          <Text style={styles.footerLinkText}>Open full Settings →</Text>
        </TouchableOpacity>

        {working && (
          <View style={styles.workingOverlay} pointerEvents="none">
            <ActivityIndicator color={COLORS.accent} />
          </View>
        )}
      </ScrollView>
<BottomNav active="Settings" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 60 },

  header: {
    flexDirection: "row", alignItems: "center", padding: 20, gap: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(10,14,26,0.6)",
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  backBtnText: { fontSize: 20, color: COLORS.accent },
  headerTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text, fontFamily: FONTS.heading, letterSpacing: 3 },

  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textM, textTransform: "uppercase",
    letterSpacing: 1.5, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, fontFamily: FONTS.bodyBold,
  },
  section: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },

  // ── Subscription status card
  statusCard: {
    padding: 20,
    gap: 6,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    fontFamily: FONTS.bodyBold,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
    fontFamily: FONTS.bodyBold,
  },
  statusPlan: {
    fontSize: 13,
    color: COLORS.accent,
    fontFamily: FONTS.bodyBold,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statusMeta: {
    fontSize: 12,
    color: COLORS.textM,
    fontFamily: FONTS.body,
    marginTop: 2,
  },

  // ── Rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowPrimary: {
    backgroundColor: "#1a1a2e",
  },
  rowIcon: { fontSize: 22, width: 28, textAlign: "center" },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text, fontFamily: FONTS.bodyBold },
  rowSub:   { fontSize: 11, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 2 },
  rowArrow: { fontSize: 18, color: COLORS.textM },

  // ── Education card
  eduCard: {
    padding: 16,
    backgroundColor: COLORS.card,
    marginTop: 16,
  },
  eduTitle: {
    fontSize: 13, fontWeight: "800", color: COLORS.text, fontFamily: FONTS.bodyBold,
    marginBottom: 8,
  },
  eduLine: {
    fontSize: 12, color: COLORS.textM, fontFamily: FONTS.body, marginBottom: 4, lineHeight: 18,
  },
  eduBold: { color: COLORS.accent, fontWeight: "800", fontFamily: FONTS.bodyBold },

  // ── Footer
  footerLink: { padding: 20, alignItems: "center" },
  footerLinkText: { fontSize: 12, color: