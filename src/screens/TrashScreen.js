// ─── TRASH SCREEN ────────────────────────────────────────────────────────────
// Displays soft-deleted items with their remaining grace period.
// Users can restore individual items or empty everything.
// Items auto-purge after 14 days (handled in trash.js, called on app boot).

import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS, FONTS, BORDER_RADIUS } from "../constants/theme";
import { useColors } from "../context/ThemeContext";
import {
  getTrash, restoreFromTrash, emptyTrash, TYPES, RETENTION_DAYS_CONST,
} from "../services/trash";
import { restoreDiagnosis } from "../services/firestore";
import { restoreVehicle } from "../services/garage";

export default function TrashScreen({ navigation }) {
  const { colors } = useColors();
  const [trash, setTrash] = useState({ diagnoses: [], vehicles: [], totalCount: 0 });

  const refresh = useCallback(async () => {
    const t = await getTrash();
    setTrash(t);
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleRestore = (type, item) => {
    Alert.alert(
      "Restore Item?",
      `${labelFor(type, item)} will be restored to your ${type === TYPES.DIAGNOSIS ? "Open Jobs" : "Garage"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          onPress: async () => {
            const restored = await restoreFromTrash(type, item.id);
            if (restored) {
              if (type === TYPES.DIAGNOSIS) await restoreDiagnosis(restored);
              if (type === TYPES.VEHICLE) await restoreVehicle(restored);
            }
            refresh();
          },
        },
      ]
    );
  };

  const handleEmpty = () => {
    if (trash.totalCount === 0) return;
    Alert.alert(
      "Empty Trash?",
      `This will permanently delete all ${trash.totalCount} item(s) in Trash. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Empty Trash",
          style: "destructive",
          onPress: async () => {
            await emptyTrash();
            refresh();
          },
        },
      ]
    );
  };

  const allItems = [
    ...trash.diagnoses.map((d) => ({ ...d, _type: TYPES.DIAGNOSIS })),
    ...trash.vehicles.map((v) => ({ ...v, _type: TYPES.VEHICLE })),
  ].sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.backIcon, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>TRASH</Text>
        {trash.totalCount > 0 ? (
          <TouchableOpacity onPress={handleEmpty} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Empty</Text>
          </TouchableOpacity>
        ) : <View style={styles.emptyBtn} />}
      </View>

      <View style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.bannerText, { color: colors.textM }]}>
          Items in Trash are permanently deleted after {RETENTION_DAYS_CONST} days.
        </Text>
      </View>

      {allItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🗑️</Text>
          <Text style={[styles.emptyText, { color: colors.textM }]}>Trash is empty.</Text>
        </View>
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={(item) => `${item._type}_${item.id}`}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardLabel, { color: colors.textM }]}>
                  {item._type === TYPES.DIAGNOSIS ? "DIAGNOSIS" : "VEHICLE"}
                </Text>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {labelFor(item._type, item)}
                </Text>
                <Text style={[styles.cardMeta, { color: colors.textM }]}>
                  Deleted {fmtDate(item.deletedAt)} · {item.daysRemaining} day{item.daysRemaining === 1 ? "" : "s"} left
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleRestore(item._type, item)}
                style={styles.restoreBtn}
              >
                <Text style={styles.restoreBtnText}>Restore</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const labelFor = (type, item) => {
  if (type === TYPES.DIAGNOSIS) {
    const v = [item.vehicle?.year, item.vehicle?.make, item.vehicle?.model].filter(Boolean).join(" ");
    return v || item.title || "Diagnosis";
  }
  if (type === TYPES.VEHICLE) {
    return [item.year, item.make, item.model].filter(Boolean).join(" ") || item.nickname || "Vehicle";
  }
  return "Item";
};

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, gap: 8,
  },
  backBtn: { width: 36, alignItems: "flex-start" },
  backIcon: { fontSize: 26, fontWeight: "600" },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "900", letterSpacing: 2, textAlign: "center", fontFamily: FONTS.heading },
  emptyBtn: { paddingHorizontal: 12, paddingVertical: 6, minWidth: 60, alignItems: "flex-end" },
  emptyBtnText: { color: COLORS.red, fontSize: 14, fontWeight: "700", fontFamily: FONTS.bodyBold },

  banner: { margin: 16, padding: 12, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
  bannerText: { fontSize: 12, lineHeight: 18, fontFamily: FONTS.body },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 14, fontFamily: FONTS.body },

  card: {
    flexDirection: "row", alignItems: "center", padding: 14, marginBottom: 10,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1, gap: 12,
  },
  cardLabel: { fontSize: 9, letterSpacing: 1.5, fontFamily: FONTS.bodyBold, marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: "700", fontFamily: FONTS.bodyBold },
  cardMeta: { fontSize: 11, fontFamily: FONTS.body, marginTop: 4 },
  restoreBtn: {
    backgroundColor: COLORS.accent + "22", borderWidth: 1, borderColor: COLORS.accent,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: BORDER_RADIUS.sm,
  },
  restoreBtnText: { color: COLORS.accent, fontWeight: "800", fontSize: 12, fontFamily: FONTS.bodyBold },
});
