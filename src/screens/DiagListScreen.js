// ─── DIAGNOSIS LIST SCREEN ───────────────────────────────────────────────────
import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS, FONTS } from "../constants/theme";
import { useColors } from "../context/ThemeContext";
import { getDiagnoses, deleteDiagnosis } from "../services/firestore";
import Badge from "../components/Badge";

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

export default function DiagListScreen({ navigation, route }) {
  const { colors } = useColors();
  const [diags, setDiags] = useState([]);
  const filter = route.params?.filter || "all";
  const title = filter === "open" ? "Open Jobs" : filter === "done" ? "Completed Jobs" : "All Jobs";
  const emptyMsg = filter === "open" ? "No open diagnoses. Start a new one!" : filter === "done" ? "No completed jobs yet." : "No diagnoses yet.";

  // Reload diagnoses every time this screen comes into focus,
  // and poll while any job is generating so the badge clears automatically.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let pollTimer = null;

      const load = async () => {
        const data = await getDiagnoses();
        if (!active) return;
        setDiags(data);

        // If anything is still generating, poll every 3 seconds
        const hasGenerating = data.some((d) => d.generating);
        if (hasGenerating && !pollTimer) {
          pollTimer = setInterval(async () => {
            const fresh = await getDiagnoses();
            if (active) setDiags(fresh);
            if (!fresh.some((d) => d.generating)) {
              clearInterval(pollTimer);
              pollTimer = null;
            }
          }, 3000);
        }
      };

      load();
      return () => {
        active = false;
        if (pollTimer) clearInterval(pollTimer);
      };
    }, [])
  );

  const handleDelete = (d) => {
    const vLabel = [d.vehicle?.year, d.vehicle?.make, d.vehicle?.model].filter(Boolean).join(" ") || "this diagnosis";
    Alert.alert(
      "Move to Trash?",
      `${vLabel} will be moved to Trash and permanently deleted in 14 days. You can restore it from Settings → Trash before then.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Move to Trash",
          style: "destructive",
          onPress: async () => {
            await deleteDiagnosis(d.id);
            const data = await getDiagnoses();
            setDiags(data);
          },
        },
      ]
    );
  };

  const filtered = filter === "open"
    ? diags.filter((d) => !d.completed)
    : filter === "done"
      ? diags.filter((d) => d.completed)
      : diags;

  const handleGeneratingTap = (d) => {
    const vLabel = [d.vehicle?.year, d.vehicle?.make, d.vehicle?.model].filter(Boolean).join(" ") || "your vehicle";
    Alert.alert(
      "Work Order Generating",
      `Hank is still building the full work order for ${vLabel}. This usually takes 30–60 seconds. You can check back in a moment, or open the chat to watch progress.`,
      [
        { text: "OK", style: "cancel" },
        { text: "Open Chat", onPress: () => navigation.navigate("DiagChat", { diag: d }) },
      ]
    );
  };

  const renderItem = ({ item: d }) => {
    const vLabel = [d.vehicle?.year, d.vehicle?.make, d.vehicle?.model].filter(Boolean).join(" ") || "Unknown vehicle";
    const lastMsg = d.transcript?.filter((m) => m.role === "assistant").slice(-1)[0]?.content || "";
    const isGenerating = d.generating === true;

    // NOTE: card and trash button are SIBLINGS (not nested) so the trash
    // tap doesn't get swallowed by the card's onPress on Android. The trash
    // button is absolutely positioned over the top-right corner of the card.
    // Tapping a job card -> go to the vehicle's main screen (where the user
    // can see all maintenance, fluids, parts, and the linked work orders).
    // For brand-new diagnoses that haven't been linked to a garage vehicle
    // yet (no make+model captured, or no real content), fall back to the
    // chat so the user can finish entering vehicle info. While Hank is
    // still generating, keep the gentle "still working" alert.
    const handleCardTap = () => {
      if (isGenerating) return handleGeneratingTap(d);
      if (d.linkedVehicleId) {
        return navigation.navigate("VehicleDetail", { vehicleId: d.linkedVehicleId });
      }
      return navigation.navigate("DiagChat", { diag: d });
    };

    return (
      <View style={[styles.card, isGenerating && styles.cardGenerating]}>
        <TouchableOpacity
          onPress={handleCardTap}
          style={styles.cardPressArea}
          activeOpacity={0.8}
        >
          <View style={styles.cardTop}>
            <View style={{ flex: 1, paddingRight: 44 /* leave room for absolute trash button */ }}>
              <Text style={styles.vehicleName}>{vLabel}</Text>
              <Text style={styles.date}>{fmtDate(d.startedAt)}</Text>
            </View>
            <View style={styles.badges}>
              <Badge color={d.confidence >= 95 ? COLORS.green : d.confidence >= 70 ? COLORS.accent : COLORS.blue}>
                {d.confidence || 0}%
              </Badge>
              {isGenerating
                ? <Badge color={COLORS.accent}>Generating...</Badge>
                : d.completed
                  ? <Badge color={COLORS.green}>Done</Badge>
                  : (d.transcript?.length > 0
                      ? <Badge color={COLORS.accent}>Diagnosis</Badge>
                      : <Badge color={COLORS.textM}>New</Badge>
                    )}
            </View>
          </View>
          {isGenerating ? (
            <Text style={styles.generatingText}>
              Hank is building the work order with parts and steps...
            </Text>
          ) : lastMsg ? (
            <Text numberOfLines={2} style={styles.preview}>
              {lastMsg.slice(0, 120)}{lastMsg.length > 120 ? "..." : ""}
            </Text>
          ) : null}
          {d.diagnosis && !isGenerating && (
            <View style={styles.diagBadges}>
              <Badge color={d.diagnosis.severity === "critical" ? COLORS.red : d.diagnosis.severity === "high" ? COLORS.accent : COLORS.green}>
                {d.diagnosis.severity?.toUpperCase()} SEVERITY
              </Badge>
              <Badge color={COLORS.blue}>
                ${d.diagnosis.workOrders?.reduce((s, wo) => s + (wo.estimatedTotalCost || 0), 0) || 0} est.
              </Badge>
            </View>
          )}
        </TouchableOpacity>

        {/* Sibling, NOT nested — touches don't bubble to the card */}
        <TouchableOpacity
          onPress={() => handleDelete(d)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.trashBtnAbsolute}
          accessibilityLabel="Move to Trash"
          accessibilityRole="button"
        >
          <Text style={styles.trashIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 28 }} />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>{emptyMsg}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: { fontSize: 22, color: COLORS.accent },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
    fontFamily: FONTS.heading,
    letterSpacing: 2,
    flex: 1,
  },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    marginBottom: 10,
    position: "relative",
    overflow: "hidden",
  },
  cardPressArea: {
    padding: 16,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  vehicleName: { fontSize: 15, fontWeight: "800", color: COLORS.text, fontFamily: FONTS.bodyBold },
  date: { fontSize: 10, color: COLORS.textM, marginTop: 2, fontFamily: FONTS.body },
  badges: { flexDirection: "column", alignItems: "flex-end", gap: 4 },
  preview: {
    fontSize: 11,
    color: COLORS.textM,
    marginTop: 8,
    lineHeight: 18,
    fontFamily: FONTS.body,
  },
  diagBadges: {
    marginTop: 8,
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  empty: {
    alignItems: "center",
    padding: 60,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: COLORS.textM, fontFamily: FONTS.body },
  trashBtnAbsolute: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.15)",
    zIndex: 10,
    elevation: 4,
  },
  trashIcon: { fontSize: 18 },
  cardGenerating: {
    borderColor: COLORS.accent + "80",
    borderWidth: 2,
    borderStyle: "dashed",
  },
  generatingText: {
    fontSize: 12,
    color: COLORS.accent,
    marginTop: 8,
    fontStyle: "italic",
    fontFamily: FONTS.body,
  },
});
