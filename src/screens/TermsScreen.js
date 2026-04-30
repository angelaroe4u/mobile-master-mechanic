// ─── TERMS ACCEPTANCE SCREEN (Feature #12) ───────────────────────────────────
import React, { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, LINKS, LEGAL, BORDER_RADIUS } from "../constants/theme";
import { TERMS_OF_SERVICE, PRIVACY_POLICY } from "../constants/legal";
import { acceptTerms, getCurrentUser } from "../services/firebase";
import Button from "../components/Button";

const LIABILITY_DISCLAIMER = `IMPORTANT SAFETY & LIABILITY DISCLAIMER

PLEASE READ THIS CAREFULLY BEFORE USING MOBILE MASTER MECHANIC.

Mobile Master Mechanic is an AI-powered informational tool only. It is NOT a substitute for a certified, professional mechanic.

By using this application, you acknowledge and agree to the following:

1. ALL RISK IS YOURS. Any repairs, maintenance, or modifications you perform on your vehicle based on information, suggestions, instructions, or work orders provided by this application are done entirely at your own risk. You are solely responsible for any damage to your vehicle, property, or injury to yourself or others.

2. NO PROFESSIONAL ADVICE. The AI-generated diagnoses, repair instructions, parts recommendations, and work orders are for informational and educational purposes only. They do not constitute professional automotive repair advice. The AI may produce inaccurate, incomplete, or incorrect information.

3. NOT A LICENSED REPAIR FACILITY. Angie's Auto Supplies Inc. is not a licensed automotive repair facility and does not provide professional automotive repair services through this application.

4. NO LIABILITY FOR DAMAGES. Angie's Auto Supplies Inc., its owners, officers, employees, agents, and affiliates shall NOT be held responsible or liable for:
   - Any damage to your vehicle (including engine, transmission, electrical, or body damage)
   - Any personal injury, bodily harm, or death
   - Any property damage
   - Any financial losses
   - Any consequential or indirect damages
   arising from your use of this application or any information, instructions, or recommendations provided by it.

5. SAFETY-CRITICAL SYSTEMS. Vehicle repair involves inherent risks including personal injury and property damage. This is especially true for safety-critical systems such as brakes, steering, suspension, airbags, fuel systems, and electrical systems. ALWAYS consult a qualified professional mechanic before working on these systems.

6. VERIFY EVERYTHING. Always double-check ALL suggested parts, specifications, torque values, fluid types, and procedures against your vehicle's official owner's manual and manufacturer service documentation before performing any work.

7. PROFESSIONAL INSPECTION. We strongly recommend having any repair work inspected by a certified professional mechanic, especially work involving safety-critical components.

YOU USE THIS APPLICATION AND ACT ON ITS INFORMATION ENTIRELY AT YOUR OWN RISK. ANGIE'S AUTO SUPPLIES INC. ACCEPTS NO RESPONSIBILITY FOR ANY OUTCOME RESULTING FROM YOUR USE OF THIS APP.`;

export default function TermsScreen() {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedLiability, setAcceptedLiability] = useState(false);
  const [liabilityScrolled, setLiabilityScrolled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const handleAccept = async () => {
    if (!acceptedTerms || !acceptedPrivacy || !acceptedLiability) return;
    setLoading(true);
    const user = getCurrentUser();
    if (user) {
      await acceptTerms(user.uid);
    }
    setLoading(false);
    // Auth state listener handles navigation
  };

  // Track scroll in the liability disclaimer box
  const handleLiabilityScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceToBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceToBottom < 30) {
      setLiabilityScrolled(true);
    }
  };

  const Checkbox = ({ checked, onPress, label, linkText, linkUrl, disabled }) => (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      style={[styles.checkRow, disabled && { opacity: 0.4 }]}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.checkLabel}>
        {label}{" "}
        {linkText && linkUrl ? (
          <Text style={styles.checkLink} onPress={() => Linking.openURL(linkUrl)}>
            {linkText}
          </Text>
        ) : null}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>WELCOME TO</Text>
        <Text style={styles.titleAccent}>MOBILE MASTER MECHANIC</Text>
        <Text style={styles.subtitle}>
          Before we get started, please review and accept our terms.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Terms & Agreements</Text>
          <Text style={styles.cardText}>
            Mobile Master Mechanic is owned and operated by {LEGAL.companyName}, a registered {LEGAL.stateOfIncorporation} corporation. The app provides AI-powered vehicle diagnostic guidance.
            Diagnoses are informational only and should not replace professional
            mechanical inspection. By using this app, you acknowledge that:
          </Text>
          <Text style={styles.cardText}>
            {"\u2022"} Diagnostic results are AI-generated suggestions, not professional advice{"\n"}
            {"\u2022"} You assume responsibility for any repairs you undertake{"\n"}
            {"\u2022"} {LEGAL.companyName} is not liable for repair outcomes{"\n"}
            {"\u2022"} Your data is collected and used as described in our Privacy Policy
          </Text>
        </View>

        {/* ════ LIABILITY DISCLAIMER — MUST SCROLL TO BOTTOM ═══════════════ */}
        <View style={styles.liabilityBox}>
          <View style={styles.liabilityHeader}>
            <Text style={styles.liabilityHeaderText}>⚠ SAFETY & LIABILITY DISCLAIMER</Text>
          </View>
          <ScrollView
            style={styles.liabilityScroll}
            nestedScrollEnabled
            onScroll={handleLiabilityScroll}
            scrollEventThrottle={200}
          >
            <Text style={styles.liabilityText}>{LIABILITY_DISCLAIMER}</Text>
            <View style={styles.liabilityEnd}>
              <Text style={styles.liabilityEndText}>— END OF DISCLAIMER —</Text>
            </View>
          </ScrollView>
          {!liabilityScrolled && (
            <View style={styles.liabilityPrompt}>
              <Text style={styles.liabilityPromptText}>↓ Scroll to bottom to acknowledge</Text>
            </View>
          )}
        </View>

        <Checkbox
          checked={acceptedLiability}
          onPress={() => setAcceptedLiability(!acceptedLiability)}
          disabled={!liabilityScrolled}
          label="I have read and understand that Angie's Auto Supplies Inc. is NOT responsible for any damage to my vehicle or injury to myself resulting from use of this app or its information."
        />

        {/* Expandable Terms */}
        <TouchableOpacity onPress={() => setShowTerms(!showTerms)} style={styles.expandBtn}>
          <Text style={styles.expandBtnText}>{showTerms ? "▲ Hide" : "▼ Read"} Full Terms of Service</Text>
        </TouchableOpacity>
        {showTerms && (
          <View style={styles.legalCard}>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 300 }}>
              <Text style={styles.legalText}>{TERMS_OF_SERVICE}</Text>
            </ScrollView>
          </View>
        )}

        {/* Expandable Privacy */}
        <TouchableOpacity onPress={() => setShowPrivacy(!showPrivacy)} style={styles.expandBtn}>
          <Text style={styles.expandBtnText}>{showPrivacy ? "▲ Hide" : "▼ Read"} Full Privacy Policy</Text>
        </TouchableOpacity>
        {showPrivacy && (
          <View style={styles.legalCard}>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 300 }}>
              <Text style={styles.legalText}>{PRIVACY_POLICY}</Text>
            </ScrollView>
          </View>
        )}

        <Checkbox
          checked={acceptedTerms}
          onPress={() => setAcceptedTerms(!acceptedTerms)}
          label="I agree to the"
          linkText="Terms of Use"
          linkUrl={LINKS.termsOfUse}
        />

        <Checkbox
          checked={acceptedPrivacy}
          onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}
          label="I have read and agree to the"
          linkText="Privacy Policy"
          linkUrl={LINKS.privacyPolicy}
        />

        <Button
          full
          onPress={handleAccept}
          disabled={!acceptedTerms || !acceptedPrivacy || !acceptedLiability}
          loading={loading}
          style={{ marginTop: 20 }}
        >
          Continue to Mobile Master Mechanic →
        </Button>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Powered by Angie's Auto Supplies</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 24, justifyContent: "center", flexGrow: 1 },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.text,
    fontFamily: FONTS.heading,
    letterSpacing: 3,
    textAlign: "center",
  },
  titleAccent: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.accent,
    fontFamily: FONTS.heading,
    letterSpacing: 3,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textM,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    fontFamily: FONTS.body,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 10,
    fontFamily: FONTS.bodyBold,
  },
  cardText: {
    fontSize: 12,
    color: COLORS.textM,
    lineHeight: 22,
    marginBottom: 8,
    fontFamily: FONTS.body,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  checkmark: { color: COLORS.white, fontSize: 14, fontWeight: "800" },
  checkLabel: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONTS.body,
  },
  checkLink: {
    color: COLORS.accent,
    textDecorationLine: "underline",
    fontWeight: "700",
  },
  // ── Liability disclaimer
  liabilityBox: {
    borderWidth: 2,
    borderColor: COLORS.red + "80",
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: 8,
    overflow: "hidden",
    backgroundColor: "#1a0e0e",
  },
  liabilityHeader: {
    backgroundColor: COLORS.red + "25",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  liabilityHeaderText: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.red,
    fontFamily: FONTS.bodyBold,
    letterSpacing: 1,
    textAlign: "center",
  },
  liabilityScroll: {
    maxHeight: 250,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  liabilityText: {
    fontSize: 11,
    color: COLORS.textM,
    lineHeight: 20,
    fontFamily: FONTS.body,
  },
  liabilityEnd: {
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 12,
  },
  liabilityEndText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.textD,
    fontFamily: FONTS.bodyBold,
    letterSpacing: 1.5,
  },
  liabilityPrompt: {
    backgroundColor: COLORS.red + "15",
    padding: 8,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.red + "30",
  },
  liabilityPromptText: {
    fontSize: 10,
    color: COLORS.red,
    fontWeight: "700",
    fontFamily: FONTS.bodyBold,
  },

  expandBtn: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  expandBtnText: {
    fontSize: 12,
    color: COLORS.blue,
    fontWeight: "700",
    fontFamily: FONTS.bodyBold,
  },
  legalCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    maxHeight: 300,
  },
  legalText: {
    fontSize: 10,
    color: COLORS.textM,
    lineHeight: 18,
    fontFamily: FONTS.body,
  },
  footer: { alignItems: "center", marginTop: 24 },
  footerText: { fontSize: 10, color: COLORS.textD, fontFamily: FONTS.body },
});
