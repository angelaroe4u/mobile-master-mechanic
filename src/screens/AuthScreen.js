// ─── AUTH SCREEN ─────────────────────────────────────────────────────────────
// Email/password sign up + sign in
import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, Image, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, BORDER_RADIUS } from "../constants/theme";
import { signUpWithEmail, signInWithEmail, createUserProfile } from "../services/firebase";
import Button from "../components/Button";

export default function AuthScreen() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Info", "Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const user = await signUpWithEmail(email, password);
        await createUserProfile(user.uid, { email, name: name.trim() || null });
      } else {
        await signInWithEmail(email, password);
      }
      // Auth state listener in App.js will handle navigation
    } catch (error) {
      const messages = {
        "auth/email-already-in-use": "This email is already registered. Try signing in.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Incorrect password.",
      };
      Alert.alert("Error", messages[error.code] || error.message);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Logo */}
          <View style={styles.logoSection}>
            <Image
              source={require("../../public/images/apicon.jpg")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>MOBILE MASTER</Text>
            <Text style={styles.titleAccent}>MECHANIC</Text>
            <Text style={styles.subtitle}>Professional AI Vehicle Diagnostics</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {mode === "signup" && (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={COLORS.textD}
                style={styles.input}
                autoCapitalize="words"
              />
            )}
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={COLORS.textD}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={COLORS.textD}
              style={styles.input}
              secureTextEntry
            />

            <Button
              full
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
            >
              {mode === "signup" ? "Create Account" : "Sign In"}
            </Button>

            <Button
              full
              variant="ghost"
              onPress={() => setMode(mode === "signup" ? "signin" : "signup")}
              style={{ marginTop: 8 }}
            >
              {mode === "signup" ? "Already have an account? Sign In" : "New here? Create Account"}
            </Button>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Powered by Angie's Auto Supplies</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: { width: 80, height: 80, marginBottom: 16 },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: COLORS.text,
    fontFamily: FONTS.heading,
    letterSpacing: 3,
    lineHeight: 38,
  },
  titleAccent: {
    fontSize: 36,
    fontWeight: "900",
    color: COLORS.accent,
    fontFamily: FONTS.heading,
    letterSpacing: 3,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textM,
    marginTop: 8,
    fontFamily: FONTS.body,
  },
  form: {
    gap: 12,
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    color: COLORS.text,
    fontSize: 14,
    fontFamily: FONTS.body,
  },
  footer: {
    alignItems: "center",
    marginTop: 40,
  },
  footerText: {
    fontSize: 10,
    color: COLORS.textD,
    fontFamily: FONTS.body,
  },
});
