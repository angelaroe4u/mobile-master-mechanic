import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, StyleSheet, Animated,
  Image, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, BORDER_RADIUS } from "../constants/theme";
import { useColors } from "../context/ThemeContext";
import { buildHankSystem } from "../constants/hankPrompt";
import { callHank, resetHankMock } from "../services/api";
import { saveDiagnosis } from "../services/firestore";
import { awardPoints, POINTS } from "../services/gamification";
import { findMatchingVehicles, getVehicleHistoryContext, createVehicle } from "../services/garage";
import { useDiagnosis, EMPTY_SESSION } from "../context/DiagnosisContext";
import ConfidenceBar from "../components/ConfidenceBar";
import SupplyTip from "../components/SupplyTip";
import GlossaryModal from "../components/GlossaryModal";

// ─── HANK MOOD → IMAGE MAPPING ──────────────────────────────────────────────
const MOOD_IMAGES = {
  neutral:   require("../../public/images/hank-looking-at-user.jpg"),
  thinking:  require("../../public/images/hank-is-thinking-close-up.jpg"),
  concerned: require("../../public/images/Hank-delivers-bad-news-close-up.jpg"),
  confident: require("../../public/images/Hank-is-happy-close-up.jpg"),
  alarmed:   require("../../public/images/hank-wiping-furrowed-brow.jpg"),
};

const MOOD_LABEL = {
  neutral:   "Listening...",
  thinking:  "Thinking...",
  concerned: "Heads up...",
  confident: "Got it!",
  alarmed:   "Pay attention...",
};

export default function DiagChatScreen({ navigation, route }) {
  const { colors } = useColors();
  const { activeSession, setActiveSession, startNewSession } = useDiagnosis();

  // route.params?.diag = loading a previously saved diagnosis from DiagList
  // route.params?.newDiag = user explicitly tapped "New Diagnosis"
  const savedDiag = route.params?.diag;
  const forceNew  = route.params?.newDiag;

  // Initialize local diag state:
  //  1. Saved diag from DiagList → load it (read-only replay, no context sync)
  //  2. forceNew → discard any active session, start fresh
  //  3. Active session in context → resume it
  //  4. Nothing → start fresh
  const [diag, setDiag] = useState(() => {
    if (savedDiag) {
      // Ensure all required array/object fields exist (old mock data may lack them)
      return {
        ...EMPTY_SESSION(),
        ...savedDiag,
        transcript: savedDiag.transcript || [],
        apiMessages: savedDiag.apiMessages || [],
        tools: savedDiag.tools || [],
        keyTerms: savedDiag.keyTerms || [],
      };
    }
    if (forceNew || !activeSession) return EMPTY_SESSION();
    return activeSession;
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentMood, setCurrentMood] = useState("neutral");
  const [supplyTip, setSupplyTip] = useState(null);
  const [glossaryTerm, setGlossaryTerm] = useState(null);
  const [glossaryDef, setGlossaryDef] = useState(null);
  const [showGlossary, setShowGlossary] = useState(false);
  const [forceAccepted, setForceAccepted] = useState(false);  // user hit "Accept as Is"

  // ── Vehicle matching state ───────────────────────────────────────────
  const [garageMatches, setGarageMatches] = useState([]);       // matches found
  const [linkedVehicleId, setLinkedVehicleId] = useState(       // already linked?
    route.params?.vehicleId || null
  );
  const [vehicleMatchChecked, setVehicleMatchChecked] = useState(false);
  const [vehicleHistoryCtx, setVehicleHistoryCtx] = useState("");

  const flatListRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hankScaleAnim = useRef(new Animated.Value(1)).current;

  // Reset mock index for new sessions
  useEffect(() => {
    if (!savedDiag && (forceNew || !activeSession)) {
      resetHankMock();
    }
  }, []);

  // Sync local diag state → context (only for live sessions, not saved replays)
  useEffect(() => {
    if (!savedDiag) {
      setActiveSession(diag);
    }
  }, [diag, savedDiag]);

  // ── Vehicle matching: when Hank identifies a vehicle, check the garage ──
  useEffect(() => {
    if (vehicleMatchChecked || linkedVehicleId || !diag.vehicle?.make) return;

    const matches = findMatchingVehicles(diag.vehicle);
    if (matches.length > 0) {
      setGarageMatches(matches);
      // Inject a system-style message from Hank asking about the match
      const match = matches[0];
      const lastRepair = match.serviceRecords?.[0];
      const repairDate = lastRepair
        ? new Date(lastRepair.completedAt || lastRepair.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : null;
      const matchLabel = [match.year, match.make, match.model, match.trim].filter(Boolean).join(" ");

      const matchMsg = {
        role: "assistant",
        content: repairDate
          ? `Hold on — is this the same **${matchLabel}** from the repair on **${repairDate}**? If so, I've got that history and it'll help me narrow things down faster. Just say "yes" or "no".`
          : `I see a **${matchLabel}** in your garage already. Is this the same vehicle? Say "yes" or "no".`,
      };
      setDiag((d) => ({
        ...d,
        transcript: [...d.transcript, matchMsg],
      }));
      setVehicleMatchChecked(true);
    } else {
      setVehicleMatchChecked(true);
    }
  }, [diag.vehicle?.make, diag.vehicle?.model, vehicleMatchChecked, linkedVehicleId]);

  // ── Load vehicle history context when linked ──
  useEffect(() => {
    if (!linkedVehicleId) return;
    getVehicleHistoryContext(linkedVehicleId).then((ctx) => {
      if (ctx) setVehicleHistoryCtx(ctx);
    });
  }, [linkedVehicleId]);

  // Pulse animation while Hank is thinking
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.2, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [loading]);

  // Bounce Hank image on mood change
  const animateMoodChange = useCallback(() => {
    Animated.sequence([
      Animated.timing(hankScaleAnim, { toValue: 1.06, duration: 150, useNativeDriver: true }),
      Animated.timing(hankScaleAnim, { toValue: 1.0,  duration: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  useEffect(scrollToBottom, [diag.transcript, loading]);

  // Parse [[term]] markers for glossary links AND **bold** markdown
  const parseTerms = (text) => {
    const parts = [];
    // Match [[term]] or **bold**
    const regex = /\[\[([^\]]+)\]\]|\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
      if (match[1]) {
        parts.push({ type: "term", value: match[1] });
      } else if (match[2]) {
        parts.push({ type: "bold", value: match[2] });
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) });
    return parts;
  };

  const handleTermPress = (term, brief) => {
    setGlossaryTerm(term);
    setGlossaryDef(brief || `Hank is looking up "${term}"...`);
    setShowGlossary(true);
  };

  // ── "Accept as Is" — user force-accepts the diagnosis early ──
  const handleAcceptAsIs = async () => {
    const isEarly = diag.confidence < 95;
    setForceAccepted(true);

    // Ask Hank to wrap up immediately
    const forceMsg = isEarly
      ? "The user has accepted this diagnosis as-is. Please finalize your best diagnosis and generate the work order now with what you have. Note: this was force-accepted early at " + diag.confidence + "% confidence."
      : "Please finalize your diagnosis and generate the work order.";

    await send(forceMsg);
  };

  const send = async (text) => {
    if (!text.trim() || loading) return;
    setInput("");

    // ── Intercept yes/no for vehicle matching ───────────────────
    if (garageMatches.length > 0 && !linkedVehicleId) {
      const answer = text.trim().toLowerCase();
      const isYes = /^(yes|yeah|yep|yup|y|correct|that's it|thats it|same one|sure)/.test(answer);
      const isNo  = /^(no|nah|nope|n|different|new)/.test(answer);

      const userMsg = { role: "user", content: text.trim() };
      setDiag((d) => ({ ...d, transcript: [...d.transcript, userMsg] }));

      if (isYes) {
        const match = garageMatches[0];
        setLinkedVehicleId(match.id);
        setGarageMatches([]);
        const ctx = await getVehicleHistoryContext(match.id);
        if (ctx) setVehicleHistoryCtx(ctx);
        const confirmMsg = {
          role: "assistant",
          content: `Perfect — I've linked this to your **${[match.year, match.make, match.model].filter(Boolean).join(" ")}** in the garage. I can see the repair history, so let's pick up where we left off. What's going on with it this time?`,
        };
        setDiag((d) => ({ ...d, transcript: [...d.transcript, confirmMsg] }));
        return;
      } else if (isNo) {
        setGarageMatches([]);
        const declineMsg = {
          role: "assistant",
          content: "Got it — this is a different vehicle. No problem, let's keep going with the diagnosis. What's happening with this one?",
        };
        setDiag((d) => ({ ...d, transcript: [...d.transcript, declineMsg] }));
        return;
      }
      // If neither yes nor no, fall through to normal send
    }

    setLoading(true);

    const userMsg = { role: "user", content: text.trim() };
    const newTranscript = [...diag.transcript, userMsg];
    const newApi = [...diag.apiMessages, userMsg];
    setDiag((d) => ({ ...d, transcript: newTranscript }));

    try {
      const system = buildHankSystem(diag.vehicle, diag.transcript, diag.tools, vehicleHistoryCtx);
      const parsed = await callHank(newApi, system);

      const assistantMsg = { role: "assistant", content: parsed.message || "Let me think about that..." };

      const updatedVehicle = parsed.vehicleUpdate && typeof parsed.vehicleUpdate === "object"
        ? { ...(diag.vehicle || {}), ...Object.fromEntries(Object.entries(parsed.vehicleUpdate).filter(([, v]) => v)) }
        : diag.vehicle;

      const updatedTools = parsed.toolsIdentified || diag.tools;
      const newMood = parsed.mood || "neutral";
      setCurrentMood(newMood);
      animateMoodChange();

      if (parsed.supplyTip) setSupplyTip(parsed.supplyTip);

      // Use real confidence from Hank — but ignore 0 when we already have
      // a real value (0 comes from error/fallback responses, not real drops)
      const rawConf = parsed.confidence;
      const safeConf = (rawConf && rawConf > 0) ? rawConf : diag.confidence;

      const updated = {
        ...diag,
        transcript: [...newTranscript, assistantMsg],
        apiMessages: [...newApi, assistantMsg],
        vehicle: updatedVehicle,
        tools: updatedTools,
        confidence: safeConf,
        done: parsed.done || false,
        diagnosis: parsed.done && parsed.diagnosis ? parsed.diagnosis : diag.diagnosis,
        keyTerms: [...(diag.keyTerms || []), ...(parsed.keyTerms || [])],
        linkedVehicleId: linkedVehicleId || diag.linkedVehicleId || null,
        forceAccepted: forceAccepted || diag.forceAccepted || false,
      };

      setDiag(updated);
      saveDiagnosis(updated);

      if (parsed.done && parsed.diagnosis) {
        await awardPoints(POINTS.diagnosisCompleted);
        // Don't auto-navigate — let the user read Hank's final response
        // The "View Work Order" button will appear in the chat footer
      }
    } catch (e) {
      const errMsg = { role: "assistant", content: "Connection issue — please try again." };
      setDiag((d) => ({ ...d, transcript: [...newTranscript, errMsg] }));
    }

    setLoading(false);
  };

  // Whether the chat should use green styling (95%+ confidence)
  const isGreenMode = diag.confidence >= 95 && !diag.done;

  const renderMessage = ({ item: m }) => {
    const isUser = m.role === "user";
    const parts = !isUser ? parseTerms(m.content) : [{ type: "text", value: m.content }];

    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAssistant]}>
        <View style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          isGreenMode && !isUser && styles.bubbleAssistantGreen,
          isGreenMode && isUser && styles.bubbleUserGreen,
        ]}>
          {!isUser && <Text style={[styles.hankLabel, isGreenMode && { color: COLORS.green }]}>HANK</Text>}
          <Text style={styles.msgText} selectable={true} selectionColor={COLORS.green}>
            {parts.map((p, i) =>
              p.type === "term" ? (
                <Text
                  key={i}
                  style={styles.termLink}
                  onPress={() => {
                    const def = diag.keyTerms?.find((t) => t.term === p.value);
                    handleTermPress(p.value, def?.brief);
                  }}
                >
                  {p.value}
                </Text>
              ) : p.type === "bold" ? (
                <Text key={i} style={{ fontWeight: "800", color: COLORS.text }}>{p.value}</Text>
              ) : (
                <Text key={i}>{p.value}</Text>
              )
            )}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>

      {/* ── Hank Full-Width Header ──────────────────── */}
      <View style={styles.hankHeader}>
        <Animated.Image
          source={MOOD_IMAGES[currentMood] || MOOD_IMAGES.neutral}
          style={[styles.hankHeaderImage, { transform: [{ scale: hankScaleAnim }] }]}
          resizeMode="cover"
        />
        <View style={styles.hankHeaderOverlay}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.hankHeaderInfo}>
            <Text style={styles.hankMoodLabel}>{loading ? "Thinking..." : MOOD_LABEL[currentMood]}</Text>
            <Text style={styles.vehicleLabel}>
              {diag.vehicle
                ? [diag.vehicle.year, diag.vehicle.make, diag.vehicle.model].filter(Boolean).join(" ")
                : "New Diagnosis"}
            </Text>
          </View>
        </View>

        {/* ── Accept as Is: small orange caution button, top-left of Hank image (80-94%) ── */}
        {diag.confidence >= 80 && diag.confidence < 95 && !diag.done && !forceAccepted && (
          <TouchableOpacity
            onPress={handleAcceptAsIs}
            disabled={loading}
            style={[styles.acceptOverlayBtn, loading && { opacity: 0.4 }]}
            activeOpacity={0.7}
          >
            <Text style={styles.acceptOverlayIcon}>⚠</Text>
            <Text style={styles.acceptOverlayLabel}>Accept</Text>
          </TouchableOpacity>
        )}
        <View style={styles.confidenceRow}>
          <ConfidenceBar pct={diag.confidence} />
        </View>
      </View>

      {/* ── Messages + Input — keyboard-aware ───────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          style={{ flex: 1 }}
          data={diag.transcript}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔧</Text>
              <Text style={styles.emptyTitle}>Hank is Ready</Text>
              <Text style={styles.emptySub}>
                Tell Hank your vehicle and what's going on — year, make, model, and what you're seeing or hearing. He'll take it from there.
              </Text>
            </View>
          }
          ListFooterComponent={
            <>
              {loading && (
                <View style={[styles.msgRow, styles.msgRowAssistant]}>
                  <View style={[styles.bubble, styles.bubbleAssistant]}>
                    <View style={styles.dots}>
                      {[0, 1, 2].map((i) => (
                        <Animated.View key={i} style={[styles.dot, { opacity: pulseAnim }]} />
                      ))}
                    </View>
                  </View>
                </View>
              )}
              {supplyTip && (
                <SupplyTip tip={supplyTip} onDismiss={() => setSupplyTip(null)} />
              )}

              {/* ── 95%+ green banner: Hank is wrapping up ── */}
              {diag.confidence >= 95 && !diag.done && !forceAccepted && (
                <View style={styles.greenBanner}>
                  <Text style={styles.greenBannerText}>✓ 95%+ — Hank is finalizing the diagnosis...</Text>
                  <Text style={styles.greenBannerSub}>He's checking for related issues. Sit tight or accept now.</Text>
                </View>
              )}

              {/* ── Diagnosis complete → View Work Order ── */}
              {diag.done && diag.diagnosis ? (
                <View>
                  <TouchableOpacity
                    onPress={() => navigation.navigate("DiagResult", { diag })}
                    style={styles.viewWorkOrderCta}
                  >
                    <Text style={styles.viewWorkOrderTitle}>✓ DIAGNOSIS COMPLETE</Text>
                    <Text style={styles.viewWorkOrderSub}>View Work Order →</Text>
                  </TouchableOpacity>
                  <Text style={styles.safetyBlurb}>
                    ⚠ Verify all suggested info against your vehicle's manual before use. AI guidance is not professional advice.
                  </Text>
                </View>
              ) : null}

              {/* ── "Accept Diagnosis" button at 95%+ (green, in footer) ── */}
              {diag.confidence >= 95 && !diag.done && !forceAccepted && (
                <TouchableOpacity
                  onPress={handleAcceptAsIs}
                  disabled={loading}
                  style={[styles.acceptAsIsCta, styles.acceptAsIsCtaGreen, loading && { opacity: 0.5 }]}
                >
                  <Text style={[styles.acceptAsIsTitle, { color: COLORS.green }]}>
                    Accept Diagnosis
                  </Text>
                  <Text style={styles.acceptAsIsSub}>
                    Generate work order with current findings
                  </Text>
                </TouchableOpacity>
              )}
            </>
          }
        />

        {/* ── Input bar — pinned above keyboard ─────── */}
        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Describe the symptom..."
            placeholderTextColor={COLORS.textD}
            multiline
            maxLength={1000}
            style={styles.textInput}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => send(input)}
          />
          <TouchableOpacity
            onPress={() => send(input)}
            disabled={!input.trim() || loading}
            style={[
              styles.sendBtn,
              { backgroundColor: input.trim() && !loading ? COLORS.accent : COLORS.border },
            ]}
          >
            <Text style={styles.sendIcon}>→</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Bottom Dashboard ────────────────────────── */}
      <View style={styles.bottomDash}>
        <TouchableOpacity style={styles.dashBtn} onPress={() => navigation.navigate("MainTabs")}>
          <Text style={styles.dashIcon}>⌂</Text>
          <Text style={styles.dashLabel}>HOME</Text>
        </TouchableOpacity>

        <View style={styles.dashCenter}>
          <Text style={styles.dashCenterLabel}>MASTER TECH</Text>
          <View style={styles.dashCenterDots}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.dashDot,
                  { backgroundColor: i === 0 ? COLORS.blue : "#2a3d5a" },
                ]}
              />
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.dashBtn}
          onPress={() => {
            startNewSession();
            navigation.replace("DiagChat", { newDiag: true });
          }}
        >
          <Text style={styles.dashIcon}>＋</Text>
          <Text style={styles.dashLabel}>NEW</Text>
        </TouchableOpacity>
      </View>

      {/* Glossary Modal */}
      <GlossaryModal
        visible={showGlossary}
        term={glossaryTerm}
        definition={glossaryDef}
        onClose={() => setShowGlossary(false)}
        onSpecifyVehicle={(term, vehicle) => {
          setShowGlossary(false);
          send(`Explain "${term}" specifically for a ${vehicle}`);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  // ── Hank Header
  hankHeader: {
    width: "100%",
    height: 200,
    position: "relative",
    overflow: "hidden",
  },
  hankHeaderImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  hankHeaderOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: "rgba(10,14,26,0.55)",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,14,26,0.6)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backBtnText: { fontSize: 20, color: COLORS.accent },
  hankHeaderInfo: { flex: 1 },
  hankMoodLabel: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontFamily: FONTS.bodyBold,
  },
  vehicleLabel: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
    fontFamily: FONTS.heading,
    marginTop: 2,
  },
  confidenceRow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },

  // ── Messages
  messageList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: "row", marginBottom: 10 },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowAssistant: { justifyContent: "flex-start" },
  bubble: { maxWidth: "85%", padding: 12, borderWidth: 1 },
  bubbleUser: {
    backgroundColor: COLORS.blue + "30",
    borderColor: COLORS.blue + "40",
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  hankLabel: {
    fontSize: 9,
    color: COLORS.accent,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
    fontFamily: FONTS.bodyBold,
  },
  msgText: { fontSize: 13, color: COLORS.text, lineHeight: 21, fontFamily: FONTS.body },
  termLink: { color: COLORS.accent, textDecorationLine: "underline", fontWeight: "700" },
  dots: { flexDirection: "row", gap: 5, alignItems: "center", paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },

  // ── Empty state
  empty: { alignItems: "center", padding: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: {
    fontSize: 16, fontWeight: "800", color: COLORS.text,
    fontFamily: FONTS.bodyBold, marginBottom: 6,
  },
  emptySub: {
    fontSize: 12, color: COLORS.textM, lineHeight: 20,
    textAlign: "center", fontFamily: FONTS.body,
  },

  // ── Accept overlay button (top-left of Hank image, 80-94%)
  acceptOverlayBtn: {
    position: "absolute",
    top: 50,
    right: 16,
    backgroundColor: "rgba(245,158,11,0.9)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  acceptOverlayIcon: {
    fontSize: 14,
  },
  acceptOverlayLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#1a1a0e",
    fontFamily: FONTS.bodyBold,
    letterSpacing: 0.5,
  },

  // ── Finalize CTA
  finalizeCta: {
    backgroundColor: "#1a2a1a",
    borderWidth: 2,
    borderColor: COLORS.green + "50",
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: "center",
  },
  finalizeTitle: { fontSize: 13, fontWeight: "800", color: COLORS.green, fontFamily: FONTS.bodyBold },
  finalizeSub: { fontSize: 11, color: COLORS.textM, marginTop: 3, fontFamily: FONTS.body },
  // ── Green mode bubble overrides (95%+ confidence)
  bubbleAssistantGreen: {
    backgroundColor: COLORS.green + "15",
    borderColor: COLORS.green + "40",
  },
  bubbleUserGreen: {
    backgroundColor: COLORS.green + "20",
    borderColor: COLORS.green + "30",
  },

  // ── Green banner (95%+ still working)
  greenBanner: {
    backgroundColor: COLORS.green + "12",
    borderWidth: 1,
    borderColor: COLORS.green + "40",
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    alignItems: "center",
  },
  greenBannerText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.green,
    fontFamily: FONTS.bodyBold,
  },
  greenBannerSub: {
    fontSize: 10,
    color: COLORS.textM,
    fontFamily: FONTS.body,
    marginTop: 3,
    textAlign: "center",
  },

  // ── Accept as Is CTA
  acceptAsIsCta: {
    backgroundColor: "#1a1a2e",
    borderWidth: 2,
    borderColor: COLORS.accent + "50",
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: "center",
  },
  acceptAsIsCtaGreen: {
    borderColor: COLORS.green + "50",
    backgroundColor: "#0e1a0e",
  },
  acceptAsIsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.accent,
    fontFamily: FONTS.bodyBold,
  },
  acceptAsIsSub: {
    fontSize: 10,
    color: COLORS.textM,
    fontFamily: FONTS.body,
    marginTop: 3,
    textAlign: "center",
  },

  safetyBlurb: {
    fontSize: 9,
    color: COLORS.textD,
    textAlign: "center",
    fontFamily: FONTS.body,
    paddingHorizontal: 24,
    paddingVertical: 6,
    lineHeight: 14,
  },
  viewWorkOrderCta: {
    backgroundColor: "#1a2a1a",
    borderWidth: 2,
    borderColor: COLORS.green,
    borderRadius: 14,
    padding: 18,
    marginHorizontal: 16,
    marginVertical: 12,
    alignItems: "center",
  },
  viewWorkOrderTitle: { fontSize: 11, fontWeight: "800", color: COLORS.green, fontFamily: FONTS.bodyBold, letterSpacing: 1.5 },
  viewWorkOrderSub: { fontSize: 16, fontWeight: "900", color: COLORS.accent, marginTop: 6, fontFamily: FONTS.heading, letterSpacing: 2 },

  // ── Input bar
  inputBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 13,
    fontFamily: FONTS.body,
    maxHeight: 100,
    lineHeight: 20,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: { fontSize: 18, color: COLORS.white, fontWeight: "800" },

  // ── Bottom Dashboard — silver/blue toolbar pinned at screen bottom
  bottomDash: {
    height: 54,
    backgroundColor: "#0d1829",
    borderTopWidth: 2,
    borderTopColor: COLORS.blue,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  dashBtn: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dashIcon: {
    fontSize: 20,
    color: "#7a9ac8",
    lineHeight: 22,
  },
  dashLabel: {
    fontSize: 7,
    color: "#4a6a94",
    fontFamily: FONTS.bodyBold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  dashCenter: {
    flex: 1,
    alignItems: "center",
    gap: 5,
  },
  dashCenterLabel: {
    fontSize: 9,
    color: "#3b5a80",
    fontFamily: FONTS.bodyBold,
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  dashCenterDots: {
    flexDirection: "row",
    gap: 5,
  },
  dashDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
