// ─── VEHICLE DETAIL SCREEN ───────────────────────────────────────────────────
// Full vehicle profile: maintenance, oil tracker, fluids, tires, parts, service
// history, photos, notes — with printable records.
import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert,
  TextInput, Modal, Image, KeyboardAvoidingView, Platform, Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav, { BOTTOM_NAV_HEIGHT } from "../components/BottomNav";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, GRADIENTS, FONTS } from "../constants/theme";
import { useColors } from "../context/ThemeContext";
import {
  getVehicleById, updateVehicle, addVehicleNote, deleteVehicleNote,
  addOilChange, updateTireInfo, updateFluids,
  addFrequentPart, deleteFrequentPart,
  getMaintenanceSuggestions, generatePrintableHTML,
  addReminder, getOilSpecs, FLUID_INTERVALS, addMaintenanceRecord,
} from "../services/garage";
import Badge from "../components/Badge";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const fmtDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

// ─── COLLAPSIBLE SECTION ─────────────────────────────────────────────────────
const Section = ({ title, count, children, defaultOpen = false, color = COLORS.accent }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.section}>
      <TouchableOpacity onPress={() => setOpen(!open)} style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: color }]} />
        <Text style={styles.sectionLabel}>{title}</Text>
        {count !== undefined && <Text style={styles.sectionCount}>({count})</Text>}
        <Text style={styles.sectionChevron}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
};

export default function VehicleDetailScreen({ navigation, route }) {
  const { colors } = useColors();
  const { vehicleId } = route.params;
  const [vehicle, setVehicle] = useState(null);
  const [maintenance, setMaintenance] = useState([]);

  // ── Modal states ──
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showOilModal, setShowOilModal] = useState(false);
  const [showTireModal, setShowTireModal] = useState(false);
  const [showFluidModal, setShowFluidModal] = useState(false);
  const [showPartModal, setShowPartModal] = useState(false);

  // ── Form fields ──
  const [noteText, setNoteText] = useState("");
  const [oilForm, setOilForm] = useState({ mileage: "", oilWeight: "", oilType: "", filterBrand: "", notes: "" });
  const [tireForm, setTireForm] = useState({ frontSize: "", rearSize: "", frontPressure: "", rearPressure: "", sparePressure: "", brand: "" });
  const [fluidForm, setFluidForm] = useState({ engineOil: "", coolant: "", brakeFluid: "", transmissionFluid: "", powerSteering: "", washerFluid: "" });
  const [partForm, setPartForm] = useState({ name: "", partNumber: "", lastReplacedMileage: "", intervalMiles: "", cost: "", notes: "" });

  const [expandedRecord, setExpandedRecord] = useState(null);
  const [activeSpecTab, setActiveSpecTab] = useState(null); // "oil" | "fluids" | "tires" | "parts" | null
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintItem, setMaintItem] = useState(null); // the maintenance suggestion being logged
  const [maintForm, setMaintForm] = useState({ mileage: "", cost: "", notes: "" });

  const reload = useCallback(async () => {
    const v = await getVehicleById(vehicleId);
    if (v) {
      setVehicle(v);
      const m = await getMaintenanceSuggestions(vehicleId);
      setMaintenance(m);
      // Pre-fill tire and fluid forms from existing data
      if (v.tireInfo) setTireForm((f) => ({ ...f, ...v.tireInfo }));
      if (v.fluids) setFluidForm((f) => ({ ...f, ...v.fluids }));
    }
  }, [vehicleId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      reload();
      return () => { active = false; };
    }, [reload])
  );

  if (!vehicle) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const vLabel = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
  const openRecords = vehicle.serviceRecords.filter((r) => !r.completedAt);
  const completedRecords = vehicle.serviceRecords.filter((r) => !!r.completedAt);
  const totalSpent = completedRecords.reduce((s, r) => s + (parseFloat(r.actualCost) || 0), 0);
  const oilChanges = vehicle.oilChanges || [];
  const tireInfo = vehicle.tireInfo || {};
  const fluids = vehicle.fluids || {};
  const frequentParts = vehicle.frequentParts || [];

  // ── Handlers ──
  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await addVehicleNote(vehicleId, noteText.trim());
    setNoteText("");
    setShowNoteModal(false);
    await reload();
  };

  const handleDeleteNote = (noteId) => {
    Alert.alert("Delete Note", "Remove this note?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteVehicleNote(vehicleId, noteId); await reload(); } },
    ]);
  };

  const handleAddOil = async () => {
    await addOilChange(vehicleId, { ...oilForm, date: new Date().toISOString() });
    setOilForm({ mileage: "", oilWeight: "", oilType: "", filterBrand: "", notes: "" });
    setShowOilModal(false);
    await reload();
  };

  const handleSaveTires = async () => {
    await updateTireInfo(vehicleId, tireForm);
    setShowTireModal(false);
    await reload();
  };

  const handleSaveFluids = async () => {
    await updateFluids(vehicleId, fluidForm);
    setShowFluidModal(false);
    await reload();
  };

  const handleAddPart = async () => {
    if (!partForm.name.trim()) return;
    await addFrequentPart(vehicleId, { ...partForm, lastReplacedDate: new Date().toISOString() });
    setPartForm({ name: "", partNumber: "", lastReplacedMileage: "", intervalMiles: "", cost: "", notes: "" });
    setShowPartModal(false);
    await reload();
  };

  const handleDeletePart = (partId) => {
    Alert.alert("Delete Part", "Remove this tracked part?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteFrequentPart(vehicleId, partId); await reload(); } },
    ]);
  };

  const handleLogMaintenance = async () => {
    if (!maintItem) return;
    await addMaintenanceRecord(vehicleId, {
      type: maintItem.type,
      label: maintItem.label,
      mileage: maintForm.mileage,
      cost: maintForm.cost,
      notes: maintForm.notes,
    });
    setMaintForm({ mileage: "", cost: "", notes: "" });
    setMaintItem(null);
    setShowMaintModal(false);
    await reload();
  };

  const openMaintLog = (item) => {
    setMaintItem(item);
    setMaintForm({ mileage: vehicle.mileage || "", cost: "", notes: "" });
    setShowMaintModal(true);
  };

  const handlePrint = async () => {
    try {
      const html = await generatePrintableHTML(vehicleId);
      // Use the phone's native print dialog (iOS: AirPrint, Android: system print)
      await Print.printAsync({ html });
    } catch (e) {
      // If print fails (e.g. user cancelled), try share as fallback
      try {
        const html = await generatePrintableHTML(vehicleId);
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `${vLabel} Service Record` });
        }
      } catch (e2) {
        Alert.alert("Error", "Could not print or share. " + e2.message);
      }
    }
  };

  const handleStartDiagnosis = () => {
    navigation.navigate("DiagChat", { diag: null, vehicleId, prefillVehicle: vehicle });
  };

  const sevColor = (sev) => ({
    critical: COLORS.red, high: COLORS.accent, medium: COLORS.blue, low: COLORS.green,
  }[sev] || COLORS.blue);

  const urgencyColor = (u) => u === "overdue" ? COLORS.red : u === "no_data" ? COLORS.textD : COLORS.accent;
  const urgencyLabel = (u) => u === "overdue" ? "OVERDUE" : u === "no_data" ? "NO DATA" : u === "good" ? "OK" : "UPCOMING";

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{vLabel}</Text>
          {vehicle.mileage ? (
            <Text style={styles.headerMileage}>{parseInt(vehicle.mileage).toLocaleString()} mi</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={handlePrint} style={styles.printBtn}>
          <Text style={styles.printBtnText}>🖨</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleStartDiagnosis}>
          <Text style={styles.diagBtn}>🔧</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: COLORS.blue }]}>{vehicle.serviceRecords.length}</Text>
            <Text style={styles.statLabel}>Services</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: COLORS.green }]}>{completedRecords.length}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: COLORS.accent }]}>${totalSpent || 0}</Text>
            <Text style={styles.statLabel}>Spent</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: COLORS.purple }]}>{oilChanges.length}</Text>
            <Text style={styles.statLabel}>Oil Chgs</Text>
          </View>
        </View>

        {/* ════ OIL CHANGE TRACKER (always visible, uncollapsable) ══════ */}
        <View style={styles.oilBox}>
          <View style={styles.oilBoxHeader}>
            <Text style={styles.oilBoxTitle}>🛢 Oil Change Record</Text>
            <TouchableOpacity onPress={() => setShowOilModal(true)}>
              <Text style={styles.oilBoxAddBtn}>+ Log</Text>
            </TouchableOpacity>
          </View>
          {oilChanges.length === 0 ? (
            <View style={styles.oilBoxEmpty}>
              <Text style={styles.emptyNote}>No oil changes recorded. Tap + Log to start tracking.</Text>
            </View>
          ) : (
            oilChanges.slice(0, 5).map((o) => (
              <View key={o.id} style={styles.oilRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.oilDate}>{fmtDate(o.date)}</Text>
                  <Text style={styles.oilDetail}>
                    {o.mileage ? parseInt(o.mileage).toLocaleString() + " mi" : ""}{o.oilWeight ? " · " + o.oilWeight : ""}{o.oilType ? " " + o.oilType : ""}
                  </Text>
                  {o.filterBrand ? <Text style={styles.oilFilter}>Filter: {o.filterBrand}</Text> : null}
                  {o.notes ? <Text style={styles.oilNotes}>{o.notes}</Text> : null}
                </View>
                <Text style={styles.oilIcon}>🛢</Text>
              </View>
            ))
          )}
        </View>

        {/* ════ SUGGESTED MAINTENANCE BOX ═══════════════════════════════════ */}
        <View style={styles.maintenanceBox}>
          <View style={styles.maintenanceHeader}>
            <Text style={styles.maintenanceTitle}>🔔 Suggested Maintenance</Text>
          </View>
          {maintenance.map((m, i) => (
            <TouchableOpacity key={i} style={styles.maintenanceItem} onPress={() => openMaintLog(m)} activeOpacity={0.7}>
              <View style={[styles.urgencyDot, { backgroundColor: urgencyColor(m.urgency) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.maintenanceLabel}>{m.label}</Text>
                <Text style={styles.maintenanceDetail}>{m.detail}</Text>
                {m.nextDueMileage ? (
                  <Text style={[styles.maintenanceNext, { color: urgencyColor(m.urgency) }]}>
                    Next due at {m.nextDueMileage.toLocaleString()} mi
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.urgencyTag, { color: urgencyColor(m.urgency) }]}>
                  {urgencyLabel(m.urgency)}
                </Text>
                <Text style={styles.maintTapHint}>Tap to log</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ════ MANUFACTURER SPECS — 4-BUTTON GRID ═════════════════════════ */}
        <View style={styles.specsBox}>
          <Text style={styles.specsTitle}>Manufacturer Specs</Text>
          <View style={styles.specsGrid}>
            <TouchableOpacity
              style={[styles.specBtn, activeSpecTab === "oil" && styles.specBtnActive]}
              onPress={() => setActiveSpecTab(activeSpecTab === "oil" ? null : "oil")}
            >
              <Text style={styles.specBtnIcon}>🛢</Text>
              <Text style={[styles.specBtnLabel, activeSpecTab === "oil" && styles.specBtnLabelActive]}>Oil Specs</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.specBtn, activeSpecTab === "fluids" && styles.specBtnActive]}
              onPress={() => setActiveSpecTab(activeSpecTab === "fluids" ? null : "fluids")}
            >
              <Text style={styles.specBtnIcon}>💧</Text>
              <Text style={[styles.specBtnLabel, activeSpecTab === "fluids" && styles.specBtnLabelActive]}>Fluids</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.specBtn, activeSpecTab === "tires" && styles.specBtnActive]}
              onPress={() => setActiveSpecTab(activeSpecTab === "tires" ? null : "tires")}
            >
              <Text style={styles.specBtnIcon}>🔘</Text>
              <Text style={[styles.specBtnLabel, activeSpecTab === "tires" && styles.specBtnLabelActive]}>Tires & Pressure</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.specBtn, activeSpecTab === "parts" && styles.specBtnActive]}
              onPress={() => setActiveSpecTab(activeSpecTab === "parts" ? null : "parts")}
            >
              <Text style={styles.specBtnIcon}>🔩</Text>
              <Text style={[styles.specBtnLabel, activeSpecTab === "parts" && styles.specBtnLabelActive]}>Tracked Parts</Text>
            </TouchableOpacity>
          </View>

          {/* ── Expanded spec panels ── */}
          {activeSpecTab === "oil" && (
            <View style={styles.specPanel}>
              <View style={styles.specPanelHead}>
                <Text style={styles.specPanelTitle}>
                  Manufacturer Oil Specs{vehicle.make ? ` — ${vehicle.make}` : ""}
                </Text>
              </View>
              <View style={styles.oilSpecTable}>
                <View style={styles.oilSpecHeaderRow}>
                  <Text style={[styles.oilSpecHeaderCell, { flex: 1 }]}>Weight</Text>
                  <Text style={[styles.oilSpecHeaderCell, { flex: 1.5 }]}>Mileage Range</Text>
                  <Text style={[styles.oilSpecHeaderCell, { flex: 2 }]}>Notes</Text>
                </View>
                {getOilSpecs(vehicle.make).map((spec, i) => (
                  <View key={i} style={[styles.oilSpecRow, i % 2 === 0 && styles.oilSpecRowAlt]}>
                    <Text style={[styles.oilSpecWeight, { flex: 1 }]}>{spec.weight}</Text>
                    <Text style={[styles.oilSpecRange, { flex: 1.5 }]}>{spec.mileageRange}</Text>
                    <Text style={[styles.oilSpecNotes, { flex: 2 }]}>{spec.notes}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.oilSpecDisclaimer}>
                Always confirm with your owner's manual. Specs vary by engine and model year.
              </Text>
            </View>
          )}

          {activeSpecTab === "fluids" && (
            <View style={styles.specPanel}>
              <View style={styles.specPanelHead}>
                <Text style={styles.specPanelTitle}>Vehicle Fluids & Intervals</Text>
                <TouchableOpacity onPress={() => setShowFluidModal(true)}>
                  <Text style={styles.addRowBtnText}>Edit Fluids</Text>
                </TouchableOpacity>
              </View>
              {/* Fluid intervals table (excludes oil — that's in Oil Specs) */}
              <View style={styles.fluidIntervalTable}>
                {Object.entries(FLUID_INTERVALS).map(([key, info]) => (
                  <View key={key} style={styles.fluidIntervalRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.fluidIntervalLabel}>{info.label}</Text>
                      {fluids[key] ? (
                        <Text style={styles.fluidIntervalCurrent}>Current: {fluids[key]}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.fluidIntervalMiles}>
                      {info.interval > 0 ? `Every ${(info.interval / 1000).toFixed(0)}k mi` : "As needed"}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.oilSpecDisclaimer}>
                Oil change intervals are shown in the Oil Specs tab. Always verify with your manual.
              </Text>
            </View>
          )}

          {activeSpecTab === "tires" && (
            <View style={styles.specPanel}>
              <View style={styles.specPanelHead}>
                <Text style={styles.specPanelTitle}>Tires & Pressure</Text>
                <TouchableOpacity onPress={() => setShowTireModal(true)}>
                  <Text style={styles.addRowBtnText}>Edit Tires</Text>
                </TouchableOpacity>
              </View>
              {!tireInfo.frontSize && !tireInfo.rearSize ? (
                <Text style={styles.emptyNote}>No tire info. Tap edit to add sizes and pressures.</Text>
              ) : (
                <>
                  <View style={styles.tireGrid}>
                    <View style={styles.tireBox}>
                      <Text style={styles.tireLabel}>Front</Text>
                      <Text style={styles.tireSize}>{tireInfo.frontSize || "—"}</Text>
                      <Text style={styles.tirePressure}>{tireInfo.frontPressure ? tireInfo.frontPressure + " PSI" : "—"}</Text>
                    </View>
                    <View style={styles.tireBox}>
                      <Text style={styles.tireLabel}>Rear</Text>
                      <Text style={styles.tireSize}>{tireInfo.rearSize || "—"}</Text>
                      <Text style={styles.tirePressure}>{tireInfo.rearPressure ? tireInfo.rearPressure + " PSI" : "—"}</Text>
                    </View>
                  </View>
                  {tireInfo.sparePressure ? (
                    <Text style={styles.sparePressure}>Spare: {tireInfo.sparePressure} PSI</Text>
                  ) : null}
                  {tireInfo.brand ? (
                    <Text style={styles.tireBrand}>Current: {tireInfo.brand}{tireInfo.installedMileage ? ` (installed at ${parseInt(tireInfo.installedMileage).toLocaleString()} mi)` : ""}</Text>
                  ) : null}
                </>
              )}
            </View>
          )}

          {activeSpecTab === "parts" && (
            <View style={styles.specPanel}>
              <View style={styles.specPanelHead}>
                <Text style={styles.specPanelTitle}>Tracked Parts</Text>
                <TouchableOpacity onPress={() => setShowPartModal(true)}>
                  <Text style={styles.addRowBtnText}>+ Add Part</Text>
                </TouchableOpacity>
              </View>
              {frequentParts.length === 0 ? (
                <Text style={styles.emptyNote}>Track filters, belts, wipers, and other wear parts here.</Text>
              ) : (
                frequentParts.map((p) => {
                  const curMi = parseInt(vehicle.mileage) || 0;
                  const lastMi = parseInt(p.lastReplacedMileage) || 0;
                  const interval = parseInt(p.intervalMiles) || 0;
                  const milesSince = curMi - lastMi;
                  const isDue = interval > 0 && milesSince >= interval * 0.9;
                  return (
                    <TouchableOpacity key={p.id} onLongPress={() => handleDeletePart(p.id)} style={[styles.partTrackRow, isDue && styles.partTrackRowDue]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.partTrackName}>{p.name}</Text>
                        <Text style={styles.partTrackMeta}>
                          {p.partNumber ? "#" + p.partNumber + " · " : ""}
                          {p.lastReplacedMileage ? "Last: " + parseInt(p.lastReplacedMileage).toLocaleString() + " mi" : ""}
                          {p.intervalMiles ? " · Every " + parseInt(p.intervalMiles).toLocaleString() + " mi" : ""}
                        </Text>
                        {p.cost ? <Text style={styles.partTrackCost}>${p.cost}</Text> : null}
                      </View>
                      {isDue && (
                        <View style={styles.dueTag}>
                          <Text style={styles.dueTagText}>DUE</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </View>

        {/* New Diagnosis CTA */}
        <TouchableOpacity onPress={handleStartDiagnosis} style={styles.newDiagBtn}>
          <Text style={styles.newDiagBtnText}>🔧 Start New Diagnosis</Text>
        </TouchableOpacity>

        {/* ════ SERVICE RECORDS ══════════════════════════════════════════════ */}
        {openRecords.length > 0 && (
          <Section title="Open Work Orders" count={openRecords.length} color={COLORS.accent} defaultOpen={true}>
            {openRecords.map((record) => renderServiceRecord(record))}
          </Section>
        )}

        <Section title="Completed Repairs" count={completedRecords.length} color={COLORS.green}>
          {completedRecords.length === 0 ? (
            <Text style={styles.emptyNote}>No completed repairs yet.</Text>
          ) : (
            completedRecords.map((record) => renderServiceRecord(record))
          )}
        </Section>

        {/* ════ NOTES ═══════════════════════════════════════════════════════ */}
        <Section title="Notes" count={vehicle.notes.length}>
          <TouchableOpacity onPress={() => setShowNoteModal(true)} style={styles.addRowBtn}>
            <Text style={styles.addRowBtnText}>+ Add Note</Text>
          </TouchableOpacity>
          {vehicle.notes.length === 0 ? (
            <Text style={styles.emptyNote}>No notes yet.</Text>
          ) : (
            vehicle.notes.map((note) => (
              <TouchableOpacity key={note.id} onLongPress={() => handleDeleteNote(note.id)} style={styles.noteCard}>
                <Text style={styles.noteText}>{note.text}</Text>
                <Text style={styles.noteDate}>{fmtDateTime(note.createdAt)}</Text>
              </TouchableOpacity>
            ))
          )}
        </Section>

        {/* Print CTA */}
        <TouchableOpacity onPress={handlePrint} style={styles.printCta}>
          <Text style={styles.printCtaText}>🖨 Print / Share Service Record</Text>
          <Text style={styles.printCtaSub}>Professional detailed list with parts & costs</Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODALS                                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* ── Note Modal ─────────────────────────────── */}
      <BottomModal visible={showNoteModal} onClose={() => setShowNoteModal(false)} title="Add Note">
        <TextInput style={[styles.fieldInput, { height: 100, textAlignVertical: "top" }]} value={noteText} onChangeText={setNoteText}
          placeholder="Oil change due at 90k, rattle near rear axle, etc." placeholderTextColor={COLORS.textD} multiline />
        <TouchableOpacity style={styles.saveBtn} onPress={handleAddNote}><Text style={styles.saveBtnText}>Save Note</Text></TouchableOpacity>
      </BottomModal>

      {/* ── Oil Change Modal ───────────────────────── */}
      <BottomModal visible={showOilModal} onClose={() => setShowOilModal(false)} title="Log Oil Change">
        <View style={styles.formRow}>
          <FormField label="Mileage" value={oilForm.mileage} onChange={(v) => setOilForm({ ...oilForm, mileage: v })} keyboardType="numeric" placeholder="87500" />
          <FormField label="Oil Weight" value={oilForm.oilWeight} onChange={(v) => setOilForm({ ...oilForm, oilWeight: v })} placeholder="5W-30" />
        </View>
        <FormField label="Oil Type" value={oilForm.oilType} onChange={(v) => setOilForm({ ...oilForm, oilType: v })} placeholder="Full Synthetic" />
        <FormField label="Filter Brand" value={oilForm.filterBrand} onChange={(v) => setOilForm({ ...oilForm, filterBrand: v })} placeholder="Mobil 1, Wix, etc." />
        <FormField label="Notes" value={oilForm.notes} onChange={(v) => setOilForm({ ...oilForm, notes: v })} placeholder="Optional notes" />
        <TouchableOpacity style={styles.saveBtn} onPress={handleAddOil}><Text style={styles.saveBtnText}>Log Oil Change</Text></TouchableOpacity>
      </BottomModal>

      {/* ── Tire Modal ─────────────────────────────── */}
      <BottomModal visible={showTireModal} onClose={() => setShowTireModal(false)} title="Tire Information">
        <View style={styles.formRow}>
          <FormField label="Front Size" value={tireForm.frontSize} onChange={(v) => setTireForm({ ...tireForm, frontSize: v })} placeholder="215/55R17" />
          <FormField label="Rear Size" value={tireForm.rearSize} onChange={(v) => setTireForm({ ...tireForm, rearSize: v })} placeholder="215/55R17" />
        </View>
        <View style={styles.formRow}>
          <FormField label="Front PSI" value={tireForm.frontPressure} onChange={(v) => setTireForm({ ...tireForm, frontPressure: v })} keyboardType="numeric" placeholder="35" />
          <FormField label="Rear PSI" value={tireForm.rearPressure} onChange={(v) => setTireForm({ ...tireForm, rearPressure: v })} keyboardType="numeric" placeholder="35" />
        </View>
        <View style={styles.formRow}>
          <FormField label="Spare PSI" value={tireForm.sparePressure} onChange={(v) => setTireForm({ ...tireForm, sparePressure: v })} keyboardType="numeric" placeholder="60" />
          <FormField label="Brand/Model" value={tireForm.brand} onChange={(v) => setTireForm({ ...tireForm, brand: v })} placeholder="Michelin Defender" />
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTires}><Text style={styles.saveBtnText}>Save Tire Info</Text></TouchableOpacity>
      </BottomModal>

      {/* ── Fluid Modal ────────────────────────────── */}
      <BottomModal visible={showFluidModal} onClose={() => setShowFluidModal(false)} title="Vehicle Fluids">
        <FormField label="Engine Oil" value={fluidForm.engineOil} onChange={(v) => setFluidForm({ ...fluidForm, engineOil: v })} placeholder="0W-20 Full Synthetic" />
        <FormField label="Coolant" value={fluidForm.coolant} onChange={(v) => setFluidForm({ ...fluidForm, coolant: v })} placeholder="Toyota Pink, Dexcool, etc." />
        <FormField label="Brake Fluid" value={fluidForm.brakeFluid} onChange={(v) => setFluidForm({ ...fluidForm, brakeFluid: v })} placeholder="DOT 3, DOT 4" />
        <FormField label="Transmission Fluid" value={fluidForm.transmissionFluid} onChange={(v) => setFluidForm({ ...fluidForm, transmissionFluid: v })} placeholder="ATF, CVT, Manual GL-4" />
        <FormField label="Power Steering" value={fluidForm.powerSteering} onChange={(v) => setFluidForm({ ...fluidForm, powerSteering: v })} placeholder="ATF or Electronic" />
        <FormField label="Washer Fluid" value={fluidForm.washerFluid} onChange={(v) => setFluidForm({ ...fluidForm, washerFluid: v })} placeholder="Standard -20°F" />
        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveFluids}><Text style={styles.saveBtnText}>Save Fluids</Text></TouchableOpacity>
      </BottomModal>

      {/* ── Maintenance Log Modal ──────────────────── */}
      <BottomModal visible={showMaintModal} onClose={() => { setShowMaintModal(false); setMaintItem(null); }} title={`Log ${maintItem?.label || "Maintenance"}`}>
        <Text style={styles.maintModalInfo}>
          Recommended every {maintItem?.intervalMiles ? parseInt(maintItem.intervalMiles).toLocaleString() : "—"} miles
        </Text>
        <FormField label="Mileage at Service" value={maintForm.mileage} onChange={(v) => setMaintForm({ ...maintForm, mileage: v })} keyboardType="numeric" placeholder={vehicle.mileage || "Current mileage"} />
        <FormField label="Cost ($)" value={maintForm.cost} onChange={(v) => setMaintForm({ ...maintForm, cost: v })} keyboardType="numeric" placeholder="0.00" />
        <FormField label="Notes" value={maintForm.notes} onChange={(v) => setMaintForm({ ...maintForm, notes: v })} placeholder="Optional details" />
        <TouchableOpacity style={styles.saveBtn} onPress={handleLogMaintenance}><Text style={styles.saveBtnText}>Log {maintItem?.label || "Service"}</Text></TouchableOpacity>
      </BottomModal>

      {/* ── Part Tracker Modal ─────────────────────── */}
      <BottomModal visible={showPartModal} onClose={() => setShowPartModal(false)} title="Track a Part">
        <FormField label="Part Name" value={partForm.name} onChange={(v) => setPartForm({ ...partForm, name: v })} placeholder="Engine Air Filter, Belt, Wiper, etc." />
        <View style={styles.formRow}>
          <FormField label="Part Number" value={partForm.partNumber} onChange={(v) => setPartForm({ ...partForm, partNumber: v })} placeholder="Optional" />
          <FormField label="Cost" value={partForm.cost} onChange={(v) => setPartForm({ ...partForm, cost: v })} keyboardType="numeric" placeholder="$" />
        </View>
        <View style={styles.formRow}>
          <FormField label="Mileage at Replace" value={partForm.lastReplacedMileage} onChange={(v) => setPartForm({ ...partForm, lastReplacedMileage: v })} keyboardType="numeric" placeholder="87000" />
          <FormField label="Replace Every (mi)" value={partForm.intervalMiles} onChange={(v) => setPartForm({ ...partForm, intervalMiles: v })} keyboardType="numeric" placeholder="15000" />
        </View>
        <FormField label="Notes" value={partForm.notes} onChange={(v) => setPartForm({ ...partForm, notes: v })} placeholder="Brand preference, etc." />
        <TouchableOpacity style={styles.saveBtn} onPress={handleAddPart}><Text style={styles.saveBtnText}>Save Part</Text></TouchableOpacity>
      </BottomModal>
<BottomNav active="Home" />
    </SafeAreaView>
  );

  // ── Service record renderer (closure over state) ──
  function renderServiceRecord(record) {
    const isExpanded = expandedRecord === record.id;
    const isComplete = !!record.completedAt;
    const stepsTotal = record.workOrder?.steps?.length || 0;
    const stepsDone = Object.keys(record.stepsCompleted || {}).filter((k) => record.stepsCompleted[k]).length;

    return (
      <View key={record.id} style={[styles.recordCard, isComplete && styles.recordCardDone]}>
        <TouchableOpacity onPress={() => setExpandedRecord(isExpanded ? null : record.id)} style={styles.recordHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.recordTitle}>{record.woTitle}</Text>
            <Text style={styles.recordDate}>{fmtDateTime(record.completedAt || record.createdAt)}</Text>
            {record.diagnosis?.severity && (
              <Badge color={sevColor(record.diagnosis.severity)}>{record.diagnosis.severity.toUpperCase()}</Badge>
            )}
          </View>
          <View style={styles.recordRight}>
            {isComplete ? (
              <View style={styles.completeBadge}><Text style={styles.completeBadgeText}>✓</Text></View>
            ) : stepsTotal > 0 ? (
              <Text style={styles.recordProgress}>{stepsDone}/{stepsTotal}</Text>
            ) : null}
            {record.actualCost ? (
              <Text style={styles.recordCost}>${record.actualCost}</Text>
            ) : record.workOrder?.estimatedTotalCost ? (
              <Text style={styles.recordEstCost}>~${record.workOrder.estimatedTotalCost}</Text>
            ) : null}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.recordDetail}>
            {record.diagnosis?.summary && <Text style={styles.recordSummary}>{record.diagnosis.summary}</Text>}
            {record.workOrder?.steps?.length > 0 && (
              <>
                <Text style={styles.detailLabel}>Steps</Text>
                {record.workOrder.steps.map((step, si) => {
                  const done = record.stepsCompleted?.[si];
                  const doneDate = record.stepCompletionDates?.[si];
                  return (
                    <View key={si} style={[styles.stepRow, done && styles.stepRowDone]}>
                      <View style={[styles.stepCheck, done && styles.stepCheckDone]}>
                        <Text style={styles.stepCheckText}>{done ? "✓" : si + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.stepText, done && styles.stepTextDone]}>{step}</Text>
                        {doneDate && <Text style={styles.stepDate}>Completed {fmtDate(doneDate)}</Text>}
                      </View>
                    </View>
                  );
                })}
              </>
            )}
            {record.workOrder?.parts?.length > 0 && (
              <>
                <Text style={styles.detailLabel}>Parts Used</Text>
                {record.workOrder.parts.map((part, pi) => (
                  <View key={pi} style={styles.partRow}>
                    <Text style={styles.partName}>{part.name}{part.partNumber ? " #" + part.partNumber : ""}</Text>
                    <Text style={styles.partCost}>${part.estimatedCost}</Text>
                  </View>
                ))}
              </>
            )}
            {record.notes ? (
              <><Text style={styles.detailLabel}>Notes</Text><Text style={styles.recordNotes}>{record.notes}</Text></>
            ) : null}
          </View>
        )}
      </View>
    );
  }
}

// ─── REUSABLE BOTTOM MODAL ──────────────────────────────────────────────────
function BottomModal({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── REUSABLE FORM FIELD ────────────────────────────────────────────────────
function FormField({ label, value, onChange, placeholder, keyboardType, multiline }) {
  return (
    <View style={[styles.formField, multiline && { flex: 0 }]}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && { height: 60, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textD}
        keyboardType={keyboardType || "default"}
        multiline={!!multiline}
      />
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadingText: { color: COLORS.textM, textAlign: "center", marginTop: 60, fontFamily: FONTS.body },
  header: {
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12,
  },
  backBtn: { fontSize: 22, color: COLORS.accent },
  headerTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text, fontFamily: FONTS.heading, letterSpacing: 1 },
  headerMileage: { fontSize: 11, color: COLORS.textM, fontFamily: FONTS.body },
  printBtn: { marginRight: 4 },
  printBtnText: { fontSize: 22 },
  diagBtn: { fontSize: 22 },
  scroll: { padding: 16 },

  // ── Stats
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statBox: {
    flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, padding: 10, alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "900", fontFamily: FONTS.heading },
  statLabel: { fontSize: 7, color: COLORS.textM, textTransform: "uppercase", letterSpacing: 1, fontFamily: FONTS.body, marginTop: 2 },

  // ── Oil Change box (always visible)
  oilBox: {
    backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.green + "40",
    borderRadius: 14, marginBottom: 16, overflow: "hidden",
  },
  oilBoxHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.green + "15", paddingHorizontal: 14, paddingVertical: 10,
  },
  oilBoxTitle: { fontSize: 13, fontWeight: "800", color: COLORS.green, fontFamily: FONTS.bodyBold },
  oilBoxAddBtn: { fontSize: 12, fontWeight: "700", color: COLORS.accent, fontFamily: FONTS.bodyBold },
  oilBoxEmpty: { padding: 14 },

  // ── Maintenance box
  maintenanceBox: {
    backgroundColor: "#1a1a0e", borderWidth: 2, borderColor: COLORS.accent + "50",
    borderRadius: 14, marginBottom: 16, overflow: "hidden",
  },
  maintenanceHeader: { backgroundColor: COLORS.accent + "15", paddingHorizontal: 14, paddingVertical: 10 },
  maintenanceTitle: { fontSize: 13, fontWeight: "800", color: COLORS.accent, fontFamily: FONTS.bodyBold },
  maintenanceItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  urgencyDot: { width: 8, height: 8, borderRadius: 4 },
  maintenanceLabel: { fontSize: 13, fontWeight: "700", color: COLORS.text, fontFamily: FONTS.bodyBold },
  maintenanceDetail: { fontSize: 10, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 1 },
  maintenanceNext: { fontSize: 9, fontWeight: "700", fontFamily: FONTS.bodyBold, marginTop: 2 },
  urgencyTag: { fontSize: 9, fontWeight: "800", letterSpacing: 1, fontFamily: FONTS.bodyBold },
  maintTapHint: { fontSize: 8, color: COLORS.textD, fontFamily: FONTS.body, marginTop: 2 },
  maintModalInfo: { fontSize: 11, color: COLORS.textM, fontFamily: FONTS.body, marginBottom: 12, textAlign: "center" },

  // ── Oil Spec table
  oilSpecTable: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, overflow: "hidden" },
  oilSpecHeaderRow: { flexDirection: "row", backgroundColor: COLORS.accent + "20", paddingHorizontal: 10, paddingVertical: 8 },
  oilSpecHeaderCell: { fontSize: 9, fontWeight: "800", color: COLORS.accent, fontFamily: FONTS.bodyBold, textTransform: "uppercase", letterSpacing: 1 },
  oilSpecRow: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  oilSpecRowAlt: { backgroundColor: COLORS.surface },
  oilSpecWeight: { fontSize: 12, fontWeight: "800", color: COLORS.text, fontFamily: FONTS.bodyBold },
  oilSpecRange: { fontSize: 10, color: COLORS.textM, fontFamily: FONTS.body },
  oilSpecNotes: { fontSize: 9, color: COLORS.textD, fontFamily: FONTS.body },
  oilSpecDisclaimer: { fontSize: 8, color: COLORS.textD, fontFamily: FONTS.body, marginTop: 8, fontStyle: "italic", textAlign: "center" },

  // ── Fluid interval table
  fluidIntervalTable: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, overflow: "hidden" },
  fluidIntervalRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  fluidIntervalLabel: { fontSize: 12, fontWeight: "700", color: COLORS.text, fontFamily: FONTS.bodyBold },
  fluidIntervalCurrent: { fontSize: 9, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 1 },
  fluidIntervalMiles: { fontSize: 10, fontWeight: "800", color: COLORS.accent, fontFamily: FONTS.bodyBold },

  // ── Manufacturer Specs grid
  specsBox: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, marginBottom: 16, overflow: "hidden",
  },
  specsTitle: {
    fontSize: 11, fontWeight: "800", color: COLORS.textM, textTransform: "uppercase",
    letterSpacing: 1.5, fontFamily: FONTS.bodyBold, padding: 14, paddingBottom: 10,
  },
  specsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10, paddingBottom: 10, gap: 8 },
  specBtn: {
    width: "47%", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, padding: 14, alignItems: "center", gap: 6,
  },
  specBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accent + "15" },
  specBtnIcon: { fontSize: 22 },
  specBtnLabel: { fontSize: 10, fontWeight: "800", color: COLORS.textM, fontFamily: FONTS.bodyBold, textAlign: "center" },
  specBtnLabelActive: { color: COLORS.accent },
  specPanel: {
    borderTopWidth: 1, borderTopColor: COLORS.border, padding: 14,
  },
  specPanelHead: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10,
  },
  specPanelTitle: { fontSize: 12, fontWeight: "800", color: COLORS.text, fontFamily: FONTS.bodyBold },

  // ── New diag
  newDiagBtn: {
    backgroundColor: COLORS.accent + "15", borderWidth: 1, borderColor: COLORS.accent + "40",
    borderRadius: 12, padding: 14, alignItems: "center", marginBottom: 16,
  },
  newDiagBtnText: { fontSize: 13, fontWeight: "800", color: COLORS.accent, fontFamily: FONTS.bodyBold },

  // ── Sections
  section: { marginBottom: 12 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, padding: 12,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: COLORS.textM, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: FONTS.bodyBold, flex: 1 },
  sectionCount: { fontSize: 11, color: COLORS.textD, fontFamily: FONTS.body },
  sectionChevron: { fontSize: 12, color: COLORS.textD },
  sectionBody: { paddingTop: 8 },
  addRowBtn: { alignSelf: "flex-start", marginBottom: 8 },
  addRowBtnText: { fontSize: 12, color: COLORS.accent, fontWeight: "700", fontFamily: FONTS.bodyBold },

  // ── Oil change rows
  oilRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 12, marginBottom: 6,
  },
  oilDate: { fontSize: 12, fontWeight: "700", color: COLORS.text, fontFamily: FONTS.bodyBold },
  oilDetail: { fontSize: 11, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 1 },
  oilFilter: { fontSize: 10, color: COLORS.textD, fontFamily: FONTS.body },
  oilNotes: { fontSize: 10, color: COLORS.textD, fontStyle: "italic", fontFamily: FONTS.body },
  oilIcon: { fontSize: 22 },

  // ── Fluids
  fluidGrid: { gap: 6 },
  fluidItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  fluidLabel: { fontSize: 11, color: COLORS.textM, fontFamily: FONTS.body },
  fluidValue: { fontSize: 12, fontWeight: "700", color: COLORS.text, fontFamily: FONTS.bodyBold },

  // ── Tires
  tireGrid: { flexDirection: "row", gap: 10, marginBottom: 8 },
  tireBox: {
    flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 12, alignItems: "center",
  },
  tireLabel: { fontSize: 9, color: COLORS.textM, textTransform: "uppercase", letterSpacing: 1, fontFamily: FONTS.body },
  tireSize: { fontSize: 14, fontWeight: "800", color: COLORS.text, fontFamily: FONTS.bodyBold, marginTop: 2 },
  tirePressure: { fontSize: 12, color: "#8b5cf6", fontWeight: "700", fontFamily: FONTS.bodyBold, marginTop: 2 },
  sparePressure: { fontSize: 11, color: COLORS.textM, fontFamily: FONTS.body, textAlign: "center" },
  tireBrand: { fontSize: 11, color: COLORS.textD, fontFamily: FONTS.body, textAlign: "center", marginTop: 4 },

  // ── Part tracker
  partTrackRow: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 12, marginBottom: 6, flexDirection: "row", alignItems: "center", gap: 10,
  },
  partTrackRowDue: { borderColor: COLORS.accent + "60", backgroundColor: "#1a1a0e" },
  partTrackName: { fontSize: 13, fontWeight: "700", color: COLORS.text, fontFamily: FONTS.bodyBold },
  partTrackMeta: { fontSize: 10, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 2 },
  partTrackCost: { fontSize: 11, color: COLORS.accent, fontWeight: "700", fontFamily: FONTS.bodyBold, marginTop: 2 },
  partTrackNotes: { fontSize: 10, color: COLORS.textD, fontStyle: "italic", fontFamily: FONTS.body, marginTop: 1 },
  dueTag: { backgroundColor: COLORS.accent, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  dueTagText: { fontSize: 9, fontWeight: "800", color: COLORS.white, fontFamily: FONTS.bodyBold, letterSpacing: 1 },

  // ── Service record cards
  recordCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, marginBottom: 10, overflow: "hidden" },
  recordCardDone: { borderColor: COLORS.green + "30" },
  recordHeader: { padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  recordTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text, fontFamily: FONTS.bodyBold },
  recordDate: { fontSize: 10, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 2, marginBottom: 4 },
  recordRight: { alignItems: "flex-end", gap: 4 },
  recordProgress: { fontSize: 11, color: COLORS.accent, fontWeight: "800", fontFamily: FONTS.bodyBold },
  recordCost: { fontSize: 13, fontWeight: "900", color: COLORS.green, fontFamily: FONTS.heading },
  recordEstCost: { fontSize: 11, color: COLORS.textD, fontFamily: FONTS.body },
  completeBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.green, alignItems: "center", justifyContent: "center" },
  completeBadgeText: { color: COLORS.white, fontSize: 14, fontWeight: "800" },
  recordDetail: { borderTopWidth: 1, borderTopColor: COLORS.border, padding: 14 },
  recordSummary: { fontSize: 12, color: COLORS.textM, lineHeight: 20, fontFamily: FONTS.body, marginBottom: 10 },
  detailLabel: { fontSize: 10, fontWeight: "800", color: COLORS.textM, textTransform: "uppercase", letterSpacing: 1.2, fontFamily: FONTS.bodyBold, marginTop: 10, marginBottom: 6 },

  // ── Steps in record
  stepRow: { flexDirection: "row", gap: 10, marginBottom: 6, alignItems: "flex-start" },
  stepRowDone: { opacity: 0.7 },
  stepCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.blue, alignItems: "center", justifyContent: "center" },
  stepCheckDone: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  stepCheckText: { fontSize: 9, fontWeight: "800", color: COLORS.text },
  stepText: { fontSize: 11, color: COLORS.text, lineHeight: 18, flex: 1, fontFamily: FONTS.body },
  stepTextDone: { textDecorationLine: "line-through", color: COLORS.textM },
  stepDate: { fontSize: 9, color: COLORS.textD, fontFamily: FONTS.body, marginTop: 1 },

  // ── Parts
  partRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  partName: { fontSize: 12, color: COLORS.text, fontFamily: FONTS.body },
  partCost: { fontSize: 12, color: COLORS.accent, fontWeight: "700", fontFamily: FONTS.bodyBold },
  recordNotes: { fontSize: 12, color: COLORS.textM, lineHeight: 20, fontFamily: FONTS.body },

  // ── Notes
  noteCard: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  noteText: { fontSize: 13, color: COLORS.text, lineHeight: 20, fontFamily: FONTS.body },
  noteDate: { fontSize: 9, color: COLORS.textD, fontFamily: FONTS.body, marginTop: 6 },
  emptyNote: { fontSize: 11, color: COLORS.textD, fontFamily: FONTS.body, marginBottom: 8 },

  // ── Print CTA
  printCta: {
    backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.blue + "40",
    borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8,
  },
  printCtaText: { fontSize: 14, fontWeight: "800", color: COLORS.blue, fontFamily: FONTS.bodyBold },
  printCtaSub: { fontSize: 10, color: COLORS.textM, fontFamily: FONTS.body, marginTop: 3 },

  // ── Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  modalSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, borderTopWidth: 1, borderColor: COLORS.border, maxHeight: "80%",
  },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text, fontFamily: FONTS.heading, letterSpacing: 2, marginBottom: 12 },

  // ── Form
  formRow: { flexDirection: "row", gap: 10 },
  formField: { flex: 1, marginBottom: 10 },
  formLabel: { fontSize: 10, fontWeight: "800", color: COLORS.textM, textTransform: "uppercase", letterSpacing: 1, fontFamily: FONTS.bodyBold, marginBottom: 4 },
  fieldInput: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, color: COLORS.text, fontSize: 13, fontFamily: FONTS.body,
  },
  saveBtn: { backgroundColor: COLORS.green, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 12 },
  saveBtnText: { color: COLORS.white, fontWeight: "800", fontSize: 15, fontFamily: FONTS.bodyBold },
  cancelBtn: { padding: 14, alignItems: "center", marginTop: 4 },
  cancelBtnText: { color: COLORS.textM, fontSize: 13, fontFamily: FONTS.body },
});
