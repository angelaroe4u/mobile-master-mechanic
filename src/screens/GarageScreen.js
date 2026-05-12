// ─── MY GARAGE SCREEN ────────────────────────────────────────────────────────
// Lists all vehicles with service history counts. Tap to view vehicle detail.
import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Image, Alert, TextInput, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav, { BOTTOM_NAV_HEIGHT } from "../components/BottomNav";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS, FONTS, BORDER_RADIUS } from "../constants/theme";
import { useColors } from "../context/ThemeContext";
import { getVehicles, createVehicle, deleteVehicle } from "../services/garage";

const fmtDate = (iso) => {
  if (!iso) return "No service yet";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function GarageScreen({ navigation }) {
  const { colors } = useColors();
  const [vehicles, setVehicles] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [formYear, setFormYear] = useState("");
  const [formMake, setFormMake] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formMileage, setFormMileage] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getVehicles().then((data) => { if (active) setVehicles(data); });
      return () => { active = false; };
    }, [])
  );

  const handleAddVehicle = async () => {
    if (!formYear.trim() || !formMake.trim() || !formModel.trim()) {
      Alert.alert("Missing Info", "Please enter at least the year, make, and model.");
      return;
    }
    await createVehicle({
      year: formYear.trim(),
      make: formMake.trim(),
      model: formModel.trim(),
      mileage: formMileage.trim(),
    });
    setShowAdd(false);
    setFormYear(""); setFormMake(""); setFormModel(""); setFormMileage("");
    const data = await getVehicles();
    setVehicles(data);
  };

  const handleDelete = (v) => {
    const vLabel = [v.year, v.make, v.model].filter(Boolean).join(" ") || "this vehicle";
    Alert.alert(
      "Move to Trash?",
      `${vLabel} will be moved to Trash and permanently deleted in 14 days. You can restore it from Settings → Trash before then.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Move to Trash",
          style: "destructive",
          onPress: async () => {
            await deleteVehicle(v.id);
            const data = await getVehicles();
            setVehicles(data);
          },
        },
      ]
    );
  };

  const renderVehicle = ({ item: v }) => {
    const vLabel = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
    const serviceCount = v.serviceRecords?.length || 0;
    const lastService = v.serviceRecords?.[0]?.completedAt || v.serviceRecords?.[0]?.createdAt;
    const photoCount = v.photos?.length || 0;
    const noteCount = v.notes?.length || 0;

    // NOTE: card and trash button are SIBLINGS (not nested) so the trash tap
    // doesn't get swallowed by the card's onPress on Android. The trash button
    // is absolutely positioned over the top-right corner of the card.
    return (
      <View style={styles.vehicleCardWrap}>
        <TouchableOpacity
          style={styles.vehicleCard}
          onPress={() => navigation.navigate("VehicleDetail", { vehicleId: v.id })}
          activeOpacity={0.75}
        >
          <View style={styles.vehicleTop}>
            <View style={{ flex: 1, paddingRight: 44 /* leave room for absolute trash button */ }}>
              <Text style={styles.vehicleName}>{vLabel}</Text>
              {v.nickname ? <Text style={styles.vehicleNickname}>"{v.nickname}"</Text> : null}
              {v.mileage ? (
                <Text style={styles.vehicleMileage}>
                  {parseInt(v.mileage).toLocaleString()} miles
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.vehicleBottom}>
            <Text style={styles.lastServiceLabel}>
              Last service: {fmtDate(lastService)}
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.statBadge}>
                <Text style={styles.statNum}>{serviceCount}</Text>
                <Text style={styles.statLabel}>{serviceCount === 1 ? "repair" : "repairs"}</Text>
              </View>
              {photoCount > 0 && <Text style={styles.metaTag}>📷 {photoCount}</Text>}
              {noteCount > 0 && <Text style={styles.metaTag}>📝 {noteCount}</Text>}
            </View>
          </View>
        </TouchableOpacity>

        {/* Sibling, NOT nested — touches don't bubble to the card */}
        <TouchableOpacity
          onPress={() => handleDelete(v)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.trashBtnAbsolute}
          accessibilityLabel="Move vehicle to Trash"
          accessibilityRole="button"
        >
          <Text style={styles.trashIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MY GARAGE</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtn}>＋</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id}
        renderItem={renderVehicle}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🚗</Text>
            <Text style={styles.emptyTitle}>No Vehicles Yet</Text>
            <Text style={styles.emptySub}>
              Vehicles are added automatically when you complete a diagnosis, or you can add one manually.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAdd(true)}>
              <Text style={styles.emptyBtnText}>Add a Vehicle →</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* ── Add Vehicle Modal ─────────────────────── */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add a Vehicle</Text>

            <Text style={styles.fieldLabel}>Year</Text>
            <TextInput style={styles.fieldInput} value={formYear} onChangeText={setFormYear}
              placeholder="e.g. 2019" placeholderTextColor={COLORS.textD} keyboardType="number-pad" />

            <Text style={styles.fieldLabel}>Make</Text>
            <TextInput style={styles.fieldInput} value={formMake} onChangeText={setFormMake}
              placeholder="e.g. Toyota" placeholderTextColor={COLORS.textD} autoCapitalize="words" />

            <Text style={styles.fieldLabel}>Model</Text>
            <TextInput style={styles.fieldInput} value={formModel} onChangeText={setFormModel}
              placeholder="e.g. Camry" placeholderTextColor={COLORS.textD} autoCapitalize="words" />

            <Text style={styles.fieldLabel}>Mileage (optional)</Text>
            <TextInput style={styles.fieldInput} value={formMileage} onChangeText={setFormMileage}
              placeholder="e.g. 87000" placeholderTextColor={COLORS.textD} keyboardType="number-pad" />

            <TouchableOpacity style={styles.saveBtn} onPress={handleAddVehicle}>
              <Text style={styles.saveBtnText}>Add to Garage</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
<BottomNav active="Home" />
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
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { fontSize: 22, color: COLORS.accent },
  headerTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text, fontFamily: FONTS.heading, letterSpacing: 3 },
  addBtn: { fontSize: 24, color: COLORS.accent, fontWeight: "800" },

  list: { padding: 16, paddingBottom: 100 },

  // ── Vehicle card
  vehicleCardWrap: {
    position: "relative",
    marginBottom: 12,
  },
  vehicleCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
  },
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
  vehicleTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  vehicleName: { fontSize: 17, fontWeight: "900", color: COLORS.text, fontFamily: FONTS.heading, letterSpacing: 1 },
  vehicleNickname: { fontSize: 11, color: COLORS.accent, fontFamily: FONTS.body, marginTop: 2 },
  vehicleMileage: { fontSize: 11, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 2 },
  vehicleStats: { flexDirection: "row", gap: 8 },
  statBadge: {
    backgroundColor: COLORS.blue + "20",
    borderWidth: 1,
    borderColor: COLORS.blue + "40",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  statNum: { fontSize: 16, fontWeight: "900", color: COLORS.blue, fontFamily: FONTS.heading },
  statLabel: { fontSize: 8, color: COLORS.textM, fontFamily: FONTS.body, textTransform: "uppercase", letterSpacing: 1 },
  vehicleBottom: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastServiceLabel: { fontSize: 11, color: COLORS.textM, fontFamily: FONTS.body },
  metaRow: { flexDirection: "row", gap: 8 },
  metaTag: { fontSize: 10, color: COLORS.textD, fontFamily: FONTS.body },

  // ── Empty state
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text, fontFamily: FONTS.heading },
  emptySub: { fontSize: 12, color: COLORS.textM, textAlign: "center", lineHeight: 20, marginTop: 8, fontFamily: FONTS.body },
  emptyBtn: { marginTop: 20, backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  emptyBtnText: { color: COLORS.bg, fontWeight: "800", fontSize: 14, fontFamily: FONTS.bodyBold },

  // ── Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  modalSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, borderTopWidth: 1, borderColor: COLORS.border,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text, fontFamily: FONTS.heading, letterSpacing: 2, marginBottom: 16 },
  fieldLabel: {
    fontSize: 10, fontWeight: "800", color: COLORS.textM, textTransform: "uppercase",
    letterSpacing: 1.2, fontFamily: FONTS.bodyBold, marginTop: 12, marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, color: COLORS.text, fontSize: 14, fontFamily: FONTS.body,
  },
  saveBtn: { backgroundColor: COLORS.accent, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 20 },
  saveBtnText: { color: COLORS.bg, fontWeight: "800", fontSize: 15, fontFamily: FONTS.bodyBold },
  cancelBtn: { padding: 14, alignItems: "center", marginTop: 4 },
  cancelBtnText: { color: COLORS.textM, fontSize: 13, fontFamily: FONTS.body },
});
