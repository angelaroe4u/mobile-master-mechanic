// ─── PARTS TRACKER SCREEN ────────────────────────────────────────────────────
// Aggregates all parts needed across work orders.
// Users can mark each part as ordered, log vendor, cost, ETA.
import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, FlatList,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS, FONTS, BORDER_RADIUS } from "../constants/theme";
import { getDiagnoses, saveDiagnosis } from "../services/firestore";

const STATUS_COLORS = {
  needed:   COLORS.red,
  ordered:  COLORS.accent,
  arrived:  COLORS.green,
};

const STATUS_LABEL = {
  needed:  "Needed",
  ordered: "Ordered",
  arrived: "Arrived",
};

export default function SuppliesHubScreen({ navigation }) {
  const [allParts, setAllParts] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Modal form state
  const [formOrdered, setFormOrdered] = useState(false);
  const [formVendor, setFormVendor] = useState("");
  const [formCost, setFormCost] = useState("");
  const [formEta, setFormEta] = useState("");

  // Reload parts every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadParts();
    }, [])
  );

  const loadParts = async () => {
    try {
      const diags = await getDiagnoses();
      setDiagnoses(diags);

      // Flatten all parts from all work orders across all diagnoses
      const parts = [];
      for (const diag of diags) {
        if (!diag.diagnosis?.workOrders) continue;
        for (const wo of diag.diagnosis.workOrders) {
          if (!wo.parts) continue;
          for (const part of wo.parts) {
            parts.push({
              // Unique key for this part instance
              key: `${diag.id}__${wo.title}__${part.name}`,
              diagId: diag.id,
              diagTitle: diag.title || "Diagnosis",
              vehicle: diag.vehicle
                ? [diag.vehicle.year, diag.vehicle.make, diag.vehicle.model].filter(Boolean).join(" ")
                : "Unknown Vehicle",
              woTitle: wo.title,
              partName: part.name,
              partNumber: part.partNumber,
              estimatedCost: part.estimatedCost,
              searchQuery: part.searchQuery,
              // These fields are user-filled:
              status: part.status || "needed",
              vendor: part.vendor || "",
              actualCost: part.actualCost || "",
              eta: part.eta || "",
            });
          }
        }
      }
      setAllParts(parts);
    } catch (e) {
      console.error("loadParts error:", e);
    }
  };

  const openPartDetail = (part) => {
    setSelectedPart(part);
    setFormOrdered(part.status !== "needed");
    setFormVendor(part.vendor || "");
    setFormCost(part.actualCost ? String(part.actualCost) : "");
    setFormEta(part.eta || "");
    setShowModal(true);
  };

  const savePartUpdate = async () => {
    if (!selectedPart) return;

    const newStatus = formOrdered
      ? (formEta && new Date(formEta) <= new Date() ? "arrived" : "ordered")
      : "needed";

    // Update local state
    const updatedParts = allParts.map((p) =>
      p.key === selectedPart.key
        ? { ...p, status: newStatus, vendor: formVendor, actualCost: formCost, eta: formEta }
        : p
    );
    setAllParts(updatedParts);

    // Persist back to the diagnosis in firestore
    try {
      const diag = diagnoses.find((d) => d.id === selectedPart.diagId);
      if (diag?.diagnosis?.workOrders) {
        const updatedWOs = diag.diagnosis.workOrders.map((wo) => {
          if (wo.title !== selectedPart.woTitle) return wo;
          return {
            ...wo,
            parts: wo.parts.map((part) => {
              if (part.name !== selectedPart.partName) return part;
              return { ...part, status: newStatus, vendor: formVendor, actualCost: formCost, eta: formEta };
            }),
          };
        });
        const updatedDiag = { ...diag, diagnosis: { ...diag.diagnosis, workOrders: updatedWOs } };
        await saveDiagnosis(updatedDiag);
        setDiagnoses((prev) => prev.map((d) => d.id === diag.id ? updatedDiag : d));
      }
    } catch (e) {
      console.error("savePartUpdate error:", e);
    }

    setShowModal(false);
  };

  // Group parts by status
  const needed  = allParts.filter((p) => p.status === "needed");
  const ordered = allParts.filter((p) => p.status === "ordered");
  const arrived = allParts.filter((p) => p.status === "arrived");

  const renderPart = ({ item }) => (
    <TouchableOpacity
      style={styles.partRow}
      onPress={() => openPartDetail(item)}
      activeOpacity={0.75}
    >
      <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
      <View style={styles.partInfo}>
        <Text style={styles.partName}>{item.partName}</Text>
        <Text style={styles.partMeta}>{item.vehicle} · {item.woTitle}</Text>
        {item.partNumber ? <Text style={styles.partNumber}>#{item.partNumber}</Text> : null}
        {item.vendor ? <Text style={styles.partVendor}>Ordered from: {item.vendor}{item.actualCost ? ` · $${item.actualCost}` : ""}</Text> : null}
        {item.eta ? <Text style={styles.partEta}>ETA: {item.eta}</Text> : null}
      </View>
      <View style={styles.partRight}>
        <Text style={[styles.statusBadge, { color: STATUS_COLORS[item.status] }]}>
          {STATUS_LABEL[item.status]}
        </Text>
        {item.estimatedCost ? (
          <Text style={styles.estCost}>~${item.estimatedCost}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const Section = ({ title, data, color }) => {
    if (data.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: color }]} />
          <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
          <Text style={styles.sectionCount}>{data.length}</Text>
        </View>
        <FlatList
          data={data}
          keyExtractor={(item) => item.key}
          renderItem={renderPart}
          scrollEnabled={false}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PARTS TRACKER</Text>
        <Text style={styles.headerSub}>
          {allParts.length} part{allParts.length !== 1 ? "s" : ""} across {diagnoses.filter(d => d.diagnosis?.workOrders?.length).length} job{diagnoses.filter(d => d.diagnosis?.workOrders?.length).length !== 1 ? "s" : ""}
        </Text>
      </View>

      {allParts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔩</Text>
          <Text style={styles.emptyTitle}>No Parts Yet</Text>
          <Text style={styles.emptySub}>
            Parts needed from your work orders will appear here once a diagnosis is completed.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.navigate("DiagChat", { diag: null })}
          >
            <Text style={styles.emptyBtnText}>Start a Diagnosis →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Section title="Still Needed" data={needed} color={COLORS.red} />
          <Section title="Ordered" data={ordered} color={COLORS.accent} />
          <Section title="Arrived" data={arrived} color={COLORS.green} />
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* ── Part Detail Modal ─────────────────────── */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>{selectedPart?.partName}</Text>
            <Text style={styles.modalMeta}>
              {selectedPart?.vehicle} · {selectedPart?.woTitle}
            </Text>
            {selectedPart?.partNumber ? (
              <Text style={styles.modalPartNum}>Part #: {selectedPart.partNumber}</Text>
            ) : null}
            {selectedPart?.estimatedCost ? (
              <Text style={styles.modalEstCost}>Estimated cost: ${selectedPart.estimatedCost}</Text>
            ) : null}

            {/* Ordered toggle */}
            <TouchableOpacity
              style={[styles.toggleBtn, formOrdered && styles.toggleBtnActive]}
              onPress={() => setFormOrdered(!formOrdered)}
            >
              <Text style={[styles.toggleBtnText, formOrdered && { color: COLORS.bg }]}>
                {formOrdered ? "✓ Marked as Ordered" : "Mark as Ordered"}
              </Text>
            </TouchableOpacity>

            {formOrdered && (
              <>
                <Text style={styles.fieldLabel}>Ordered From</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={formVendor}
                  onChangeText={setFormVendor}
                  placeholder="AutoZone, Amazon, RockAuto..."
                  placeholderTextColor={COLORS.textD}
                />

                <Text style={styles.fieldLabel}>Actual Cost ($)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={formCost}
                  onChangeText={setFormCost}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textD}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.fieldLabel}>Expected Arrival Date</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={formEta}
                  onChangeText={setFormEta}
                  placeholder="e.g. April 15, 2026"
                  placeholderTextColor={COLORS.textD}
                />
              </>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={savePartUpdate}>
              <Text style={styles.saveBtnText}>Save & Update Work Order</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  },
  headerTitle: {
    fontSize: 26,
    color: COLORS.text,
    fontFamily: FONTS.heading,
    letterSpacing: 3,
  },
  headerSub: { fontSize: 11, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 2 },

  scroll: { padding: 16 },

  // ── Sections
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontFamily: FONTS.bodyBold,
    flex: 1,
  },
  sectionCount: {
    fontSize: 11,
    color: COLORS.textD,
    fontFamily: FONTS.body,
    backgroundColor: COLORS.card,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // ── Part rows
  partRow: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  partInfo: { flex: 1 },
  partName: { fontSize: 14, fontWeight: "700", color: COLORS.text, fontFamily: FONTS.bodyBold },
  partMeta: { fontSize: 10, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 2 },
  partNumber: { fontSize: 10, color: COLORS.textD, fontFamily: FONTS.body, marginTop: 1 },
  partVendor: { fontSize: 10, color: COLORS.accent, fontFamily: FONTS.body, marginTop: 3 },
  partEta: { fontSize: 10, color: COLORS.green, fontFamily: FONTS.body, marginTop: 1 },
  partRight: { alignItems: "flex-end", gap: 4 },
  statusBadge: { fontSize: 10, fontWeight: "800", fontFamily: FONTS.bodyBold, textTransform: "uppercase" },
  estCost: { fontSize: 10, color: COLORS.textD, fontFamily: FONTS.body },

  // ── Empty state
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text, fontFamily: FONTS.heading, letterSpacing: 1 },
  emptySub: { fontSize: 12, color: COLORS.textM, textAlign: "center", lineHeight: 20, marginTop: 8, fontFamily: FONTS.body },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyBtnText: { color: COLORS.bg, fontWeight: "800", fontSize: 14, fontFamily: FONTS.bodyBold },

  // ── Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text, fontFamily: FONTS.bodyBold },
  modalMeta: { fontSize: 11, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 3 },
  modalPartNum: { fontSize: 10, color: COLORS.textD, fontFamily: FONTS.body, marginTop: 2 },
  modalEstCost: { fontSize: 11, color: COLORS.accent, fontFamily: FONTS.body, marginTop: 2 },
  toggleBtn: {
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  toggleBtnActive: { backgroundColor: COLORS.accent },
  toggleBtnText: { color: COLORS.accent, fontWeight: "800", fontSize: 14, fontFamily: FONTS.bodyBold },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.textM,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: FONTS.bodyBold,
    marginTop: 14,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 13,
    fontFamily: FONTS.body,
  },
  saveBtn: {
    backgroundColor: COLORS.green,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
  },
  saveBtnText: { color: COLORS.white, fontWeight: "800", fontSize: 15, fontFamily: FONTS.bodyBold },
  cancelBtn: { padding: 14, alignItems: "center", marginTop: 4 },
  cancelBtnText: { color: COLORS.textM, fontSize: 13, fontFamily: FONTS.body },
});
