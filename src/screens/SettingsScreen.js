// ─── SETTINGS SCREEN ─────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Linking, Image, Alert, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS, FONTS, LINKS, BORDER_RADIUS } from "../constants/theme";
import { useColors, useThemeMode } from "../context/ThemeContext";
import { signOut, getCurrentUser, deleteAccount } from "../services/firebase";
import { restorePurchases } from "../services/subscriptions";
import { getAllEarnedRewards, resetAllData as resetRewards } from "../services/rewards";
import { getUserStats, onPointsChange, resetAllData as resetGamification } from "../services/gamification";
import { resetAllData as resetGarage } from "../services/garage";
import { resetAllData as resetFirestore } from "../services/firestore";
import { getTrash, resetAllData as resetTrash } from "../services/trash";
import { getCurrentBuild, getLastUpdated } from "../services/buildInfo";
import { testStorage } from "../services/persist";
import RankBadge from "../components/RankBadge";

const SettingsRow = ({ icon, title, subtitle, onPress, danger }) => (
  <TouchableOpacity onPress={onPress} style={styles.row} activeOpacity={0.7}>
    <Text style={styles.rowIcon}>{icon}</Text>
    <View style={styles.rowInfo}>
      <Text style={[styles.rowTitle, danger && { color: COLORS.red }]}>{title}</Text>
      {subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
    </View>
    <Text style={styles.rowArrow}>→</Text>
  </TouchableOpacity>
);

export default function SettingsScreen({ navigation, userPoints = 0 }) {
  const user = getCurrentUser();
  const [livePoints, setLivePoints] = useState(userPoints);
  const [earnedRewards, setEarnedRewards] = useState(getAllEarnedRewards());
  const [trashCount, setTrashCount] = useState(0);
  const [buildInfo] = useState(getCurrentBuild());
  const [lastUpdated, setLastUpdated] = useState(null);
  const [rewardModal, setRewardModal] = useState(null);
  const { colors } = useColors();
  const { mode, setMode, isDark } = useThemeMode();

  // Load real points on focus
  useFocusEffect(
    useCallback(() => {
      getUserStats().then((stats) => setLivePoints(stats.points));
      setEarnedRewards(getAllEarnedRewards());
      getTrash().then((t) => setTrashCount(t.totalCount || 0));
      getLastUpdated().then((iso) => setLastUpdated(iso));
    }, [])
  );

  // Subscribe to live point changes
  useEffect(() => {
    const unsub = onPointsChange((stats) => {
      setLivePoints(stats.points);
      setEarnedRewards(getAllEarnedRewards());
    });
    return unsub;
  }, []);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  // ── Reset App: wipes all in-memory user data with two confirmations.
  const handleResetApp = () => {
    Alert.alert(
      "Reset App?",
      "This will permanently delete every vehicle in your garage, every saved diagnosis, all work orders, photos, points, and earned rewards.\n\nThis action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            // Second confirmation — final chance to back out.
            Alert.alert(
              "Are you absolutely sure?",
              "Last chance. You are about to ERASE EVERYTHING in your account. There is no recovery.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete Everything",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await Promise.all([
                        resetGarage(),
                        resetFirestore(),
                        resetGamification(),
                        resetRewards(),
                        resetTrash(),
                      ]);
                      // Refresh local UI state so the wipe shows immediately.
                      setLivePoints(0);
                      setEarnedRewards([]);
                      setTrashCount(0);
                      Alert.alert(
                        "App Reset",
                        "All your data has been deleted. The app is now in its starting state.",
                        [{ text: "OK" }]
                      );
                    } catch (e) {
                      Alert.alert(
                        "Reset Failed",
                        "Something went wrong while resetting. Email angela@carlotsupplies.com if this keeps happening.",
                        [{ text: "OK" }]
                      );
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  // ── Delete Account: 3 confirmations, then wipes data + signs out.
  const handleDeleteAccount = () => {
    // Prompt 1 — explain
    Alert.alert(
      "Delete Your Account?",
      "This will permanently delete your account and ALL associated data, including:\n\n• Every vehicle in your garage\n• All saved diagnoses and work orders\n• Photos, points, and earned rewards\n• Your subscription access (you must cancel billing separately in Google Play / Apple)\n\nThis cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            // Prompt 2 — escalate
            Alert.alert(
              "Are you sure?",
              "Once your account is deleted, we cannot recover it or any of its data. Are you certain you want to proceed?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "I Understand",
                  style: "destructive",
                  onPress: () => {
                    // Prompt 3 — final gate
                    Alert.alert(
                      "Final Confirmation",
                      "This is your LAST CHANCE to back out.\n\nTap 'Delete My Account Forever' to permanently erase your account.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete My Account Forever",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              // Wipe local data first so even a server failure leaves the device clean
                              await Promise.all([
                                resetGarage(),
                                resetFirestore(),
                                resetGamification(),
                                resetRewards(),
                                resetTrash(),
                              ]);
                              setLivePoints(0);
                              setEarnedRewards([]);
                              setTrashCount(0);

                              // Then call account deletion (DEV MODE: stub; PROD: server delete)
                              await deleteAccount();

                              // Finally sign out
                              await signOut();

                              Alert.alert(
                                "Account Deleted",
                                "Your account and all associated data have been permanently deleted. We're sorry to see you go.\n\nIf you cancelled an active subscription, remember to also cancel billing in Google Play (Android) or App Store (iOS) settings to stop future charges.",
                                [{ text: "OK" }]
                              );
                            } catch (e) {
                              Alert.alert(
                                "Deletion Failed",
                                "Something went wrong. Email angela@carlotsupplies.com and we'll process your deletion manually within 24 hours.",
                                [{ text: "OK" }]
                              );
                            }
                          },
                        },
                      ]
                    );
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };


  // ── Test Storage: verifies persist.js is actually working
  const handleTestStorage = async () => {
    const result = await testStorage();
    if (result.ok) {
      Alert.alert(
        "Storage Works! ✓",
        `Your app's data persistence is working correctly.\n\n${result.message}\n\nLocation:\n${result.location}`,
        [{ text: "OK" }]
      );
    } else {
      Alert.alert(
        "Storage Failed ✗",
        `Storage is NOT working. Your data won't persist.\n\nError:\n${result.error}\n\nPlease email this to angela@carlotsupplies.com.`,
        [{ text: "OK" }]
      );
    }
  };

  // Dynamic style overrides based on current theme
  const themed = {
    safe: { backgroundColor: colors.bg },
    section: { backgroundColor: colors.card, borderColor: colors.border },
    row: { borderBottomColor: colors.border },
    rowTitle: { color: colors.text },
    rowSub: { color: colors.textM },
    header: { backgroundColor: colors.surface, borderBottomColor: colors.border },
    headerTitle: { color: colors.text },
    sectionLabel: { color: colors.textM },
  };

  return (
    <SafeAreaView style={[styles.safe, themed.safe]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={[styles.header, themed.header]}>
          <Image source={require("../../public/images/nav-settings.jpg")} style={styles.headerIcon} resizeMode="cover" />
          <Text style={[styles.headerTitle, themed.headerTitle]}>SETTINGS</Text>
        </View>

        {/* Rank Card */}
        <View style={styles.section}>
          <RankBadge points={livePoints} />
        </View>

        {/* ── Earned Rewards ───────────────────────── */}
        {earnedRewards.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>🎁 Earned Rewards</Text>
            <View style={styles.section}>
              {earnedRewards.map((reward, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.rewardRow}
                  onPress={() => setRewardModal(reward)}
                  activeOpacity={0.75}
                >
                  <View style={styles.rewardLeft}>
                    <Text style={styles.rewardTitle}>{reward.title}</Text>
                    <Text style={styles.rewardMeta}>Lv.{reward.rank?.level} · {reward.rank?.title}</Text>
                  </View>
                  <View style={styles.rewardCodeBadge}>
                    <Text style={styles.rewardCode}>{reward.code}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.section}>
          <SettingsRow icon="👤" title={user?.email || "Not signed in"} subtitle="Your account" />
          <SettingsRow icon="💳" title="Manage Subscription" subtitle="Change plan or cancel" onPress={() => {}} />
          <SettingsRow icon="🔄" title="Restore Purchases" onPress={restorePurchases} />
        </View>

        {/* Appearance */}
        <Text style={[styles.sectionLabel, themed.sectionLabel]}>Appearance</Text>
        <View style={[styles.section, themed.section]}>
          <View style={[styles.row, themed.row]}>
            <Text style={styles.rowIcon}>🎨</Text>
            <View style={styles.rowInfo}>
              <Text style={[styles.rowTitle, themed.rowTitle]}>Interface Theme</Text>
              <Text style={[styles.rowSub, themed.rowSub]}>
                {isDark ? "Dark mode — easier on the eyes in the garage" : "Light mode — bright and clean"}
              </Text>
            </View>
          </View>
          <View style={styles.themeToggleRow}>
            <TouchableOpacity
              onPress={() => setMode("light")}
              style={[
                styles.themeBtn,
                !isDark && styles.themeBtnActive,
                !isDark && { borderColor: colors.accent },
              ]}
            >
              <Text style={styles.themeBtnIcon}>☀️</Text>
              <Text style={[
                styles.themeBtnLabel,
                !isDark && { color: colors.accent },
              ]}>Light</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMode("dark")}
              style={[
                styles.themeBtn,
                isDark && styles.themeBtnActive,
                isDark && { borderColor: colors.accent },
              ]}
            >
              <Text style={styles.themeBtnIcon}>🌙</Text>
              <Text style={[
                styles.themeBtnLabel,
                isDark && { color: colors.accent },
              ]}>Dark</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Angie's Branding */}
        <View style={styles.brandCard}>
          <Text style={styles.brandTitle}>Powered by</Text>
          <Text style={styles.brandName}>Angie's Auto Supplies</Text>
          <Text style={styles.brandSub}>Your trusted partner for professional-grade supplies</Text>
          <TouchableOpacity onPress={() => Linking.openURL(LINKS.carLotSupplies)} style={styles.brandBtn}>
            <Text style={styles.brandBtnText}>Visit carlotsupplies.com →</Text>
          </TouchableOpacity>
        </View>

        {/* Support */}
        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.section}>
          <SettingsRow
            icon="📧" title="Contact Us" subtitle={LINKS.supportEmail}
            onPress={() => Linking.openURL(`mailto:${LINKS.supportEmail}`)}
          />
        </View>

        {/* Legal */}
        <Text style={styles.sectionLabel}>Legal</Text>
        <View style={styles.section}>
          <SettingsRow icon="📄" title="Terms of Service" onPress={() => navigation.navigate("Legal", { page: "terms" })} />
          <SettingsRow icon="🔒" title="Privacy Policy" onPress={() => navigation.navigate("Legal", { page: "privacy" })} />
        </View>

        {/* Privacy controls — extend with Trash */}
        <Text style={styles.sectionLabel}>Help & Feedback</Text>
        <View style={styles.section}>
          <SettingsRow
            icon="🐛"
            title="Report a Bug"
            subtitle="Tell us what went wrong"
            onPress={() => Linking.openURL("mailto:angela@carlotsupplies.com?subject=Bug%20Report%20%E2%80%94%20Mobile%20Master%20Mechanic&body=Describe%20what%20happened%20and%20what%20you%20expected%3A%0A%0A%0A%0A%2D%2D%2D%0AApp%20version%3A%201.0.0%0ADevice%3A%20")}
          />
          <SettingsRow
            icon="💬"
            title="Send a Comment"
            subtitle="Share your thoughts"
            onPress={() => Linking.openURL("mailto:angela@carlotsupplies.com?subject=Comment%20%E2%80%94%20Mobile%20Master%20Mechanic")}
          />
          <SettingsRow
            icon="💡"
            title="Suggest a Feature"
            subtitle="Tell us what you'd like to see"
            onPress={() => Linking.openURL("mailto:angela@carlotsupplies.com?subject=Feature%20Suggestion%20%E2%80%94%20Mobile%20Master%20Mechanic")}
          />
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.section}>
          <SettingsRow icon="ℹ️" title="Mobile Master Mechanic" subtitle={`Version ${buildInfo.version} (Build ${buildInfo.build})`} />
          <SettingsRow icon="🕐" title="Last Updated" subtitle={lastUpdated ? new Date(lastUpdated).toLocaleString() : "Just installed"} />
          <SettingsRow icon="🏢" title="Angie's Auto Supplies Inc." subtitle={"4250 Salem Dallas Hwy NW\nSalem, OR 97304\n(503) 880-9564"} />
        </View>

        {/* Privacy controls */}
        <Text style={styles.sectionLabel}>Privacy & Data</Text>
        <View style={styles.section}>
          <SettingsRow
            icon="🗑️"
            title="Reset App / Delete All My Data"
            subtitle="Permanently erase your vehicles, diagnoses, points, and rewards"
            danger
            onPress={handleResetApp}
          />
          <SettingsRow
            icon="❌"
            title="Delete Account"
            subtitle="Permanently delete your account AND all data (3-step confirmation)"
            danger
            onPress={handleDeleteAccount}
          />
          <SettingsRow
            icon="🗑️"
            title={trashCount > 0 ? `Trash (${trashCount})` : "Trash"}
            subtitle="Restore deleted items within 14 days"
            onPress={() => navigation.navigate("Trash")}
          />
          <SettingsRow
            icon="🧪"
            title="Test Storage"
            subtitle="Verify your data is being saved correctly"
            onPress={handleTestStorage}
          />
        </View>

        {/* Sign Out */}
        <View style={[styles.section, { marginTop: 8 }]}>
          <SettingsRow icon="🚪" title="Sign Out" danger onPress={handleSignOut} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Powered by Angie's Auto Supplies</Text>
          <Text style={styles.footerLinks}>Terms of Use · Privacy Policy</Text>
        </View>
      </ScrollView>

      {/* ── Reward Detail Modal ───────────────────── */}
      <Modal visible={!!rewardModal} transparent animationType="fade" onRequestClose={() => setRewardModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRewardModal(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>🎁</Text>
            <Text style={styles.modalTitle}>{rewardModal?.title}</Text>
            <Text style={styles.modalDesc}>{rewardModal?.desc}</Text>
            <View style={styles.modalCodeBox}>
              <Text style={styles.modalCodeLabel}>YOUR CODE</Text>
              <Text style={styles.modalCode}>{rewardModal?.code}</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setRewardModal(null)}>
              <Text style={styles.modalCloseBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 100 },
  header: {
    flexDirection: "row", alignItems: "center", padding: 20, gap: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  headerIcon: { width: 36, height: 36, borderRadius: 8 },
  headerTitle: { fontSize: 24, fontWeight: "900", color: COLORS.text, fontFamily: FONTS.heading, letterSpacing: 3 },
  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textM, textTransform: "uppercase",
    letterSpacing: 1.5, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, fontFamily: FONTS.bodyBold,
  },
  section: {
    marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center", padding: 16, gap: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rowIcon: { fontSize: 20, width: 30, textAlign: "center" },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text, fontFamily: FONTS.bodyBold },
  rowSub: { fontSize: 11, color: COLORS.textM, marginTop: 1, fontFamily: FONTS.body },
  rowArrow: { fontSize: 14, color: COLORS.textD },

  // ── Rewards rows
  rewardRow: {
    flexDirection: "row", alignItems: "center", padding: 14,
    gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rewardLeft: { flex: 1 },
  rewardTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text, fontFamily: FONTS.bodyBold },
  rewardMeta: { fontSize: 10, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 2 },
  rewardCodeBadge: {
    backgroundColor: COLORS.accent + "20",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.accent + "40",
  },
  rewardCode: { fontSize: 10, fontWeight: "800", color: COLORS.accent, fontFamily: FONTS.bodyBold },

  // ── Theme toggle
  themeToggleRow: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
  },
  themeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  themeBtnActive: {
    backgroundColor: COLORS.accent + "15",
  },
  themeBtnIcon: { fontSize: 18 },
  themeBtnLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textM,
    fontFamily: FONTS.bodyBold,
  },

  // ── Brand card
  brandCard: {
    margin: 16, backgroundColor: COLORS.accent + "15", borderWidth: 1,
    borderColor: COLORS.accent + "30", borderRadius: BORDER_RADIUS.lg, padding: 20, alignItems: "center",
  },
  brandTitle: { fontSize: 10, color: COLORS.textM, fontFamily: FONTS.body, textTransform: "uppercase", letterSpacing: 1.5 },
  brandName: { fontSize: 20, fontWeight: "900", color: COLORS.accent, fontFamily: FONTS.heading, letterSpacing: 2, marginTop: 4 },
  brandSub: { fontSize: 11, color: COLORS.textM, marginTop: 6, textAlign: "center", fontFamily: FONTS.body },
  brandBtn: { marginTop: 12, backgroundColor: COLORS.accent + "22", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  brandBtnText: { fontSize: 12, color: COLORS.accent, fontWeight: "700", fontFamily: FONTS.bodyBold },

  // ── Footer
  footer: { alignItems: "center", padding: 24, gap: 4 },
  footerText: { fontSize: 10, color: COLORS.textD, fontFamily: FONTS.body },
  footerLinks: { fontSize: 10, color: COLORS.textM, fontFamily: FONTS.body },

  // ── Reward Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalCard: {
    backgroundColor: COLORS.surface, borderRadius: 20, padding: 28,
    width: "100%", alignItems: "center", borderWidth: 1, borderColor: COLORS.border,
  },
  modalEmoji: { fontSize: 44, marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text, fontFamily: FONTS.bodyBold, textAlign: "center" },
  modalDesc: { fontSize: 13, color: COLORS.textM, fontFamily: FONTS.body, textAlign: "center", lineHeight: 20, marginTop: 8 },
  modalCodeBox: {
    backgroundColor: COLORS.accent + "15", borderRadius: 12, padding: 16,
    marginTop: 20, alignItems: "center", width: "100%", borderWidth: 1, borderColor: COLORS.accent + "40",
  },
  modalCodeLabel: { fontSize: 9, color: COLORS.textM, fontFamily: FONTS.bodyBold, textTransform: "uppercase", letterSpacing: 2 },
  modalCode: { fontSize: 22, fontWeight: "900", color: COLORS.accent, fontFamily: FONTS.heading, letterSpacing: 3, marginTop: 4 },
  modalCloseBtn: { marginTop: 20, backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  modalCloseBtnText: { color: COLORS.bg, fontWeight: "800", fontSize: 14, fontFamily: FONTS.bodyBold },
});
