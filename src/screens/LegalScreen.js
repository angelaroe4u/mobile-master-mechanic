// ─── LEGAL SCREEN ────────────────────────────────────────────────────────────
// Displays Terms of Service or Privacy Policy in a scrollable view.
import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav, { BOTTOM_NAV_HEIGHT } from "../components/BottomNav";
import { COLORS, FONTS, LEGAL } from "../constants/theme";
import { TERMS_OF_SERVICE, PRIVACY_POLICY } from "../constants/legal";

export default function LegalScreen({ navigation, route }) {
  const page = route.params?.page || "terms"; // "terms" or "privacy"
  const content = page === "privacy" ? PRIVACY_POLICY : TERMS_OF_SERVICE;
  const title = page === "privacy" ? "Privacy Policy" : "Terms of Service";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Company badge */}
        <View style={styles.badge}>
          <Text style={styles.badgeApp}>{LEGAL.appName}</Text>
          <Text style={styles.badgeCompany}>Owned & operated by {LEGAL.companyName}</Text>
          <Text style={styles.badgeAddress}>{LEGAL.address}</Text>
        </View>

        {/* Content */}
        <Text style={styles.content}>{content}</Text>

        {/* Contact footer */}
        <View style={styles.contactBox}>
          <Text style={styles.contactTitle}>Questions?</Text>
          <Text style={styles.contactLine}>{LEGAL.companyName}</Text>
          <Text style={styles.contactLine}>{LEGAL.address}</Text>
          <Text style={styles.contactLine}>Phone: {LEGAL.phone}</Text>
          <Text style={styles.contactLine}>Email: {LEGAL.email}</Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
<BottomNav active="Settings" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { fontSize: 22, color: COLORS.accent },
  headerTitle: {
    fontSize: 14, fontWeight: "800", color: COLORS.text, fontFamily: FONTS.bodyBold,
  },
  scroll: { padding: 20 },
  badge: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.accent + "30",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    alignItems: "center",
  },
  badgeApp: {
    fontSize: 16, fontWeight: "900", color: COLORS.accent,
    fontFamily: FONTS.heading, letterSpacing: 2,
  },
  badgeCompany: {
    fontSize: 11, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 4,
  },
  badgeAddress: {
    fontSize: 10, color: COLORS.textD, fontFamily: FONTS.body, marginTop: 2,
  },
  content: {
    fontSize: 12, color: COLORS.textM, lineHeight: 22, fontFamily: FONTS.body,
  },
  contactBox: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
  },
  contactTitle: {
    fontSize: 13, fontWeight: "800", color: COLORS.text,
    fontFamily: FONTS.bodyBold, marginBottom: 8,
  },
  contactLine: {
    fontSize: 12, color: COLORS.textM, fontFamily: FONTS.body, lineHeight: 20,
  },
});
