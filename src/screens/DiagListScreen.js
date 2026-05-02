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

  // Reload diagnoses every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDiagnoses().then((data) => { if (active) setDiags(data); });
      return () => { active = false; };
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

  const renderItem = ({ item: d }) => {
    const vLabel = [d.vehicle?.year, d.vehicle?.make, d.vehicle?.model].filter(Boolean).join(" ") || "Unknown vehicle";
    const lastMsg = d.transcript?.filter((m) => m.role === "assistant").slice(-1)[0]?.content || "";

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("DiagChat", { diag: d })}
        style={styles.card}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.vehicleName}>{vLabel}</Text>
            <Text style={styles.date}>{fmtDate(d.startedAt)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(d)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.trashBtn}
            accessibilityLabel="Move to Trash"
          >
            <Text style={styles.trashIcon}>🗑️</Text>
          </TouchableOpacity>
          <View style={styles.badges}>
            <Badge color={d.confidence >= 95 ? COLORS.green : d.confidence >= 70 ? COLORS.accent : COLORS.blue}>
              {d.confidence || 0}%
            </Badge>
            {d.completed
              ? <Badge color={COLORS.green}>Done</Badge>
              : (d.transcript?.length > 0
                  ? <Badge color={COLORS.accent}>Diagnosis</Badge>
                  : <Badge color={COLORS.textM}>New</Badge>
                )}
          </View>
        </View>
        {lastMsg ? (
          <Text numberOfLines={2} style={styles.preview}>
            {lastMsg.slice(0, 120)}{lastMsg.length > 120 ? "..." : ""}
          </Text>
        ) : null}
        {d.diagnosis && (
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
    padding: 16,
    marginBottom: 10,
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
  trashBtn: { padding: 6, marginRight: 4 },
  trashIcon: { fontSize: 18 },
});
