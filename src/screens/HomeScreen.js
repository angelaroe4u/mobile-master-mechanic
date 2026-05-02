import React, { useMemo, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ImageBackground, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, GRADIENTS, FONTS, LINKS } from "../constants/theme";
import { useColors } from "../context/ThemeContext";
import { getDiagnoses } from "../services/firestore";
import { getVehicles, getDueReminders, dismissReminder } from "../services/garage";

// ─── TIME-BASED GREETING ────────────────────────────────────────────────────
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const HANK_LINES = [
  "Let's get to work!",
  "Ready to diagnose?",
  "What's giving you trouble today?",
  "I've got the tools. You've got the symptoms.",
  "Let's figure this out.",
  "Show me what we're working with.",
  "Every problem has an answer.",
];

const getRandomLine = () => HANK_LINES[Math.floor(Math.random() * HANK_LINES.length)];

// ─── COMPONENT ──────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation, route, user, userPoints = 0 }) {
  const { colors, gradients } = useColors();
  const [diags, setDiags] = useState([]);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [dueReminders, setDueReminders] = useState([]);

  // Reload diagnoses + garage count + reminders every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDiagnoses().then((data) => { if (active) setDiags(data); });
      getVehicles().then((data) => { if (active) setVehicleCount(data.length); });
      getDueReminders().then((data) => { if (active) setDueReminders(data); });
      return () => { active = false; };
    }, [])
  );

  const handleDismissReminder = async (vehicleId, reminderId) => {
    await dismissReminder(vehicleId, reminderId);
    const updated = await getDueReminders();
    setDueReminders(updated);
  };

  const openDiags = diags.filter((d) => !d.completed);
  const doneDiags = diags.filter((d) => d.completed);

  // Memoize so greeting + line don't re-randomize every render
  const greeting = useMemo(() => getGreeting(), []);
  const hankLine = useMemo(() => getRandomLine(), []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── Hero Header ─────────────────────────────── */}
        <ImageBackground
          source={require("../../public/images/homeheader(1).jpg")}
          style={styles.hero}
          imageStyle={styles.heroImage}
        >
          <LinearGradient
            colors={["rgba(10,14,26,0.7)", "rgba(10,14,26,0.97)"]}
            style={styles.heroOverlay}
          >
            <Text style={styles.heroSubtitle}>AI Vehicle Diagnostics</Text>
            <Text style={styles.heroTitle}>MOBILE</Text>
            <Text style={styles.heroTitleAccent}>MASTER MECHANIC</Text>

            {/* App icon — center hero logo */}
            <View style={styles.appIconRow}>
              <Image
                source={require("../../public/images/apicon.jpg")}
                style={styles.appIconImg}
                resizeMode="cover"
              />
            </View>

            {/* Hank — larger, below headline */}
            <View style={styles.hankBlock}>
              <Image
                source={require("../../public/images/Hank-is-happy-close-up.jpg")}
                style={styles.hankImage}
                resizeMode="cover"
              />
              <View style={styles.hankSpeech}>
                <Text style={styles.hankGreetName}>
                  {greeting}{user?.name ? `, ${user.name}` : ""}!
                </Text>
                <Text style={styles.hankGreetLine}>{hankLine}</Text>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>

        {/* ── Hank Maintenance Reminders ─────────────── */}
        {dueReminders.length > 0 && (
          <View style={styles.reminderBanner}>
            <View style={styles.reminderHeader}>
              <Image
                source={require("../../public/images/Hank-is-happy-close-up.jpg")}
                style={styles.reminderHank}
                resizeMode="cover"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.reminderTitle}>🔔 Hank's Reminders</Text>
                <Text style={styles.reminderSub}>Maintenance due on your vehicles</Text>
              </View>
            </View>
            {dueReminders.map((r) => {
              const vName = [r.vehicle?.year, r.vehicle?.make, r.vehicle?.model].filter(Boolean).join(" ");
              return (
                <View key={r.id} style={styles.reminderItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reminderLabel}>{r.label}</Text>
                    <Text style={styles.reminderVehicle}>{vName}{r.notes ? " — " + r.notes : ""}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDismissReminder(r.vehicle?.id, r.id)} style={styles.reminderDismiss}>
                    <Text style={styles.reminderDismissText}>✓</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.content}>

          {/* ── New Diagnosis CTA ─────────────────────── */}
          <TouchableOpacity
            onPress={() => navigation.navigate("DiagChat", { diag: null, newDiag: true })}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#1a1a2e", "#16213e"]}
              style={styles.newDiagCard}
            >
              <Image
                source={require("../../public/images/start-diag.jpg")}
                style={styles.newDiagIcon}
                resizeMode="contain"
              />
              <View style={styles.newDiagText}>
                <Text style={styles.newDiagTitle}>NEW DIAGNOSIS</Text>
                <Text style={styles.newDiagSub}> </Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Open Jobs ─────────────────────────────── */}
          <TouchableOpacity
            onPress={() => navigation.navigate("DiagList", { filter: "open" })}
            style={styles.menuCard}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: COLORS.blue + "22", borderWidth: 2, borderColor: "#f97316" }]}>
              <Image
                source={require("../../public/images/assigned_jobs.jpg")}
                style={styles.menuIconImg}
                resizeMode="cover"
              />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Open Jobs</Text>
              <Text style={styles.menuSub}>{openDiags.length} active</Text>
            </View>
            {openDiags.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{openDiags.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* ── Completed Jobs ────────────────────────── */}
          <TouchableOpacity
            onPress={() => navigation.navigate("DiagList", { filter: "done" })}
            style={styles.menuCard}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: COLORS.green + "22", borderWidth: 2, borderColor: "#f97316" }]}>
              <Image
                source={require("../../public/images/btn-start-inspection.jpg")}
                style={styles.menuIconImg}
                resizeMode="cover"
              />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Completed Jobs</Text>
              <Text style={styles.menuSub}>{doneDiags.length} finished</Text>
            </View>
          </TouchableOpacity>

          {/* ── Parts Tracker ─────────────────────────── */}
          <TouchableOpacity
            onPress={() => navigation.navigate("SuppliesHub")}
            style={[styles.menuCard, { borderColor: COLORS.accent + "40" }]}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: COLORS.accent + "22", borderWidth: 2, borderColor: "#f97316" }]}>
              <Image
                source={require("../../public/images/nav-find-parts.jpg")}
                style={styles.menuIconImg}
                resizeMode="cover"
              />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Parts Tracker</Text>
              <Text style={styles.menuSub}> </Text>
            </View>
            <Text style={[styles.arrow, { color: COLORS.accent }]}>→</Text>
          </TouchableOpacity>

          {/* ── My Garage ────────────────────────────── */}
          <TouchableOpacity
            onPress={() => navigation.navigate("Garage")}
            style={[styles.menuCard, { borderColor: COLORS.blue + "40" }]}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIcon, { backgroundColor: COLORS.blue + "22", borderWidth: 2, borderColor: "#f97316" }]}>
              <Image
                source={require("../../public/images/garagebutton.jpg")}
                style={styles.menuIconImg}
                resizeMode="cover"
              />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>My Garage</Text>
              <Text style={styles.menuSub}>{vehicleCount} {vehicleCount === 1 ? "vehicle" : "vehicles"}</Text>
            </View>
            <Text style={[styles.arrow, { color: COLORS.blue }]}>→</Text>
          </TouchableOpacity>

        </View>

        {/* ── Footer ─────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Powered by Angie's Auto Supplies</Text>
          <View style={styles.footerLinks}>
            <Text style={styles.footerLink}>Terms of Use</Text>
            <Text style={styles.footerDot}>·</Text>
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  // ── Hero
  hero: { width: "100%", minHeight: 300 },
  heroImage: { opacity: 0.35 },
  heroOverlay: {
    padding: 24,
    paddingTop: 40,
    alignItems: "center",
  },
  heroSubtitle: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 3,
    marginBottom: 6,
    fontFamily: FONTS.bodyBold,
  },
  heroTitle: {
    fontSize: 52,
    color: COLORS.text,
    fontFamily: FONTS.heading,   // Black Ops One — grunge/industrial
    letterSpacing: 4,
    lineHeight: 54,
  },
  heroTitleAccent: {
    fontSize: 34,
    color: COLORS.accent,
    fontFamily: FONTS.heading,
    letterSpacing: 3,
    lineHeight: 38,
    textAlign: "center",
  },
  // ── App icon (center hero element)
  appIconRow: { marginTop: 14, alignItems: "center" },
  appIconImg: {
    width: 82,
    height: 82,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: COLORS.blue + "90",
  },

  // ── Hank block
  hankBlock: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    gap: 14,
    backgroundColor: "rgba(10,14,26,0.6)",
    borderRadius: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    width: "100%",
  },
  hankImage: {
    width: 72,
    height: 72,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: COLORS.accent + "60",
  },
  hankSpeech: { flex: 1 },
  hankGreetName: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
    fontFamily: FONTS.bodyBold,
  },
  hankGreetLine: {
    fontSize: 12,
    color: COLORS.accent,
    marginTop: 3,
    fontFamily: FONTS.body,
  },

  // ── Content cards
  content: { padding: 20, gap: 12 },
  newDiagCard: {
    borderWidth: 2,
    borderColor: COLORS.accent + "50",
    borderRadius: 0,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  newDiagIcon: { width: 50, height: 50, borderRadius: 0, borderWidth: 2, borderColor: "#f97316" },
  newDiagText: { flex: 1 },
  newDiagTitle: {
    fontSize: 22,
    color: COLORS.accent,
    fontFamily: FONTS.heading,
    letterSpacing: 2,
  },
  newDiagSub: {
    fontSize: 12,
    color: COLORS.textM,
    marginTop: 2,
    fontFamily: FONTS.body,
  },
  arrow: { fontSize: 20, color: COLORS.accent },
  menuCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 0,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  menuIconImg: { width: 44, height: 44 },
  menuEmoji: { fontSize: 22 },
  menuInfo: { flex: 1 },
  menuTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    fontFamily: FONTS.bodyBold,
  },
  menuSub: { fontSize: 11, color: COLORS.textM, fontFamily: FONTS.body },
  countBadge: {
    backgroundColor: COLORS.blue,
    borderRadius: 0,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { color: COLORS.white, fontSize: 11, fontWeight: "800" },

  // ── Reminders
  reminderBanner: {
    backgroundColor: "#1a1a0e",
    borderWidth: 2,
    borderColor: COLORS.accent + "50",
    borderRadius: 0,
    marginHorizontal: 20,
    marginTop: 16,
    overflow: "hidden",
  },
  reminderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: COLORS.accent + "12",
  },
  reminderHank: {
    width: 36,
    height: 36,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: COLORS.accent + "40",
  },
  reminderTitle: { fontSize: 13, fontWeight: "800", color: COLORS.accent, fontFamily: FONTS.bodyBold },
  reminderSub: { fontSize: 10, color: COLORS.textM, fontFamily: FONTS.body },
  reminderItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  reminderLabel: { fontSize: 13, fontWeight: "700", color: COLORS.text, fontFamily: FONTS.bodyBold },
  reminderVehicle: { fontSize: 10, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 1 },
  reminderDismiss: {
    width: 30, height: 30, borderRadius: 0,
    backgroundColor: COLORS.green + "20", borderWidth: 1, borderColor: COLORS.green + "40",
    alignItems: "center", justifyContent: "center",
  },
  reminderDismissText: { fontSize: 14, fontWeight: "800", color: COLORS.green },

  // ── Footer
  footer: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 12,
  },
  footerText: { fontSize: 10, color: COLORS.textD, fontFamily: FONTS.body, marginBottom: 6 },
  footerLinks: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerLink: { fontSize: 10, color: COLORS.textM, fontFamily: FONTS.body, textDecorationLine: "underline" },
  footerDot: { fontSize: 10, color: COLORS.textD },
});
