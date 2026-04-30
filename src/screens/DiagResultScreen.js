import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Linking, Share, Alert, Animated, Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, GRADIENTS, FONTS, PART_STORES } from "../constants/theme";
import { useColors } from "../context/ThemeContext";
import { saveDiagnosis } from "../services/firestore";
import { awardPoints, POINTS } from "../services/gamification";
import {
  findMatchingVehicles, createVehicle, addServiceRecord, updateServiceRecord,
  findServiceRecordByDiagId, getVehicleById, updateVehicle, addReminder,
  getMaintenanceSuggestions,
} from "../services/garage";
import { useDiagnosis } from "../context/DiagnosisContext";
import Badge from "../components/Badge";
import Button from "../components/Button";

export default function DiagResultScreen({ navigation, route }) {
  const { colors } = useColors();
  const { clearSession } = useDiagnosis();
  const { diag } = route.params;
  const [expandedWO, setExpandedWO] = useState(0);
  const [partSearch, setPartSearch] = useState(null);
  const [completingWO, setCompletingWO] = useState(null);
  const [actualCost, setActualCost] = useState("");
  const [completedWOs, setCompletedWOs] = useState(new Set());

  // ── Step-level checklist state ────────────────────────────────────────────
  // Keys are "woIndex-stepIndex", values are true/false
  // Restore from saved diag if available
  const [checkedSteps, setCheckedSteps] = useState(
    diag.savedCheckedSteps || {}
  );

  // ── Parts arrival state ─────────────────────────────────────────────────
  // Keys are "woIndex-partIndex", values are true/false or delivery date string
  const [arrivedParts, setArrivedParts] = useState(
    diag.savedArrivedParts || {}
  );

  // Track whether we've already saved a service record to garage (prevent dupes)
  const [savedToGarage, setSavedToGarage] = useState(diag.savedToGarage || false);
  const [savedGarageVehicleId, setSavedGarageVehicleId] = useState(diag.savedGarageVehicleId || diag.linkedVehicleId || null);

  // ── Completion confirmation modal ───────────────────────────────────────
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeWOIndex, setCompleteWOIndex] = useState(null);
  const [completeTimeHours, setCompleteTimeHours] = useState("");
  const [completePartsCost, setCompletePartsCost] = useState("");

  const toggleStep = (woIdx, stepIdx) => {
    const key = `${woIdx}-${stepIdx}`;
    setCheckedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePartArrived = (woIdx, partIdx) => {
    const key = `${woIdx}-${partIdx}`;
    const newArrived = !arrivedParts[key];
    setArrivedParts((prev) => ({ ...prev, [key]: newArrived }));

    // Also update the part status in the diagnosis data so SuppliesHub sees it
    try {
      const updatedWOs = [...(diag.diagnosis?.workOrders || [])];
      if (updatedWOs[woIdx]?.parts?.[partIdx]) {
        updatedWOs[woIdx] = { ...updatedWOs[woIdx], parts: [...updatedWOs[woIdx].parts] };
        updatedWOs[woIdx].parts[partIdx] = {
          ...updatedWOs[woIdx].parts[partIdx],
          status: newArrived ? "arrived" : "needed",
        };
        const toSave = {
          ...diag,
          diagnosis: { ...diag.diagnosis, workOrders: updatedWOs },
          savedArrivedParts: { ...arrivedParts, [key]: newArrived },
        };
        saveDiagnosis(toSave);
        // Update the local diag reference so future saves include this
        diag.diagnosis.workOrders = updatedWOs;
        diag.savedArrivedParts = { ...arrivedParts, [key]: newArrived };
      }
    } catch (e) {
      console.log("[DiagResult] togglePartArrived save error:", e);
    }
  };

  // ── Auto-save state when user navigates away ───────────────────────────
  const checkedStepsRef = useRef(checkedSteps);
  const arrivedPartsRef = useRef(arrivedParts);
  useEffect(() => { checkedStepsRef.current = checkedSteps; }, [checkedSteps]);
  useEffect(() => { arrivedPartsRef.current = arrivedParts; }, [arrivedParts]);

  useEffect(() => {
    return () => {
      // Save on unmount (user exits the screen)
      // Sync arrivedParts to work order part statuses for SuppliesHub
      const currentArrived = arrivedPartsRef.current;
      const syncedWOs = (diag.diagnosis?.workOrders || []).map((wo, wi) => ({
        ...wo,
        parts: (wo.parts || []).map((part, pi) => ({
          ...part,
          status: currentArrived[`${wi}-${pi}`] ? "arrived" : (part.status || "needed"),
        })),
      }));
      const toSave = {
        ...diag,
        diagnosis: { ...diag.diagnosis, workOrders: syncedWOs },
        savedCheckedSteps: checkedStepsRef.current,
        savedArrivedParts: currentArrived,
      };
      saveDiagnosis(toSave);
    };
  }, []);

  // Calculate overall job progress (all steps across all work orders)
  const { totalSteps, completedStepCount, progressPct } = useMemo(() => {
    let total = 0;
    let done = 0;
    const wos = diag.diagnosis?.workOrders || [];
    wos.forEach((wo, wi) => {
      const steps = wo.steps || [];
      total += steps.length;
      steps.forEach((_, si) => {
        if (checkedSteps[`${wi}-${si}`]) done++;
      });
    });
    return { totalSteps: total, completedStepCount: done, progressPct: total > 0 ? done / total : 0 };
  }, [checkedSteps, diag.diagnosis]);

  const d = diag.diagnosis;
  const v = diag.vehicle || {};
  const vLabel = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
  const wasForceAccepted = diag.forceAccepted && diag.confidence < 95;
  const totalEst = d?.workOrders?.reduce((s, wo) => s + (wo.estimatedTotalCost || 0), 0) || 0;
  const totalHours = d?.workOrders?.reduce((s, wo) => s + (wo.estimatedHours || 0), 0) || 0;
  const sevColor = { critical: COLORS.red, high: COLORS.accent, medium: COLORS.blue, low: COLORS.green }[d?.severity] || COLORS.blue;

  // Feature #8: Social sharing
  const handleShare = async () => {
    try {
      const message = `🔧 Mobile Master Mechanic diagnosed my ${vLabel}!\n\n` +
        `Diagnosis: ${d.title}\n` +
        `Severity: ${d.severity}\n` +
        `Est. Cost: $${totalEst}\n\n` +
        `Get your free diagnosis: https://mobilemastermechanic.com/download`;

      await Share.share({
        message,
        title: `${vLabel} Diagnosis — Mobile Master Mechanic`,
      });
      await awardPoints(POINTS.socialShare);
    } catch (e) {
      // User cancelled
    }
  };

  // Opens the completion confirmation modal
  const promptCompleteWO = (wi) => {
    const wo = d.workOrders[wi];
    setCompleteWOIndex(wi);
    setCompleteTimeHours(String(wo.estimatedHours || ""));
    setCompletePartsCost(String(wo.estimatedTotalCost || ""));
    setShowCompleteModal(true);
  };

  const handleConfirmComplete = async () => {
    const wi = completeWOIndex;
    const wo = d.workOrders[wi];
    setShowCompleteModal(false);

    setCompletedWOs((prev) => new Set([...prev, wi]));
    setCompletingWO(null);
    setActualCost("");
    await awardPoints(POINTS.workOrderCompleted);

    const actualPartsCost = parseFloat(completePartsCost) || wo.estimatedTotalCost;
    const actualTime = parseFloat(completeTimeHours) || wo.estimatedHours;

    // Mark all parts in this WO as arrived in the diagnosis data so SuppliesHub updates
    try {
      const updatedWOs = [...(diag.diagnosis?.workOrders || [])];
      if (updatedWOs[wi]?.parts?.length) {
        updatedWOs[wi] = {
          ...updatedWOs[wi],
          parts: updatedWOs[wi].parts.map((p) => ({ ...p, status: "arrived" })),
        };
        diag.diagnosis.workOrders = updatedWOs;
      }
      // Also mark all part arrival checkboxes for this WO
      const newArrivedParts = { ...arrivedParts };
      (wo.parts || []).forEach((_, pi) => {
        newArrivedParts[`${wi}-${pi}`] = true;
      });
      setArrivedParts(newArrivedParts);
      diag.savedArrivedParts = newArrivedParts;
    } catch (e) {
      console.log("[DiagResult] complete WO parts update error:", e);
    }

    if (completedWOs.size + 1 >= d.workOrders.length) {
      const updated = {
        ...diag,
        completed: true,
        completedAt: new Date().toISOString(),
        actualCost: actualPartsCost,
        actualTime,
        savedCheckedSteps: checkedSteps,
        savedArrivedParts: arrivedParts,
      };
      await saveDiagnosis(updated);

      // ── Save completed record to Garage ──
      // If already saved (open WO exists), update it to completed.
      // If not yet saved, create a new completed record.
      try {
        let completeVehicleId = savedGarageVehicleId || diag.linkedVehicleId;
        if (!completeVehicleId) {
          const matches = findMatchingVehicles(diag.vehicle);
          if (matches.length > 0) {
            completeVehicleId = matches[0].id;
          } else if (diag.vehicle?.make) {
            const newV = await createVehicle({
              year: diag.vehicle.year || "",
              make: diag.vehicle.make || "",
              model: diag.vehicle.model || "",
              trim: diag.vehicle.trim || "",
              mileage: diag.vehicle.mileage || "",
              transmission: diag.vehicle.transmission || "",
            });
            completeVehicleId = newV.id;
          }
        }
        if (completeVehicleId) {
          // Check if a record already exists for this diagnosis
          const existingRecord = findServiceRecordByDiagId(completeVehicleId, diag.id);
          if (existingRecord) {
            // Update existing open record to completed
            await updateServiceRecord(completeVehicleId, existingRecord.id, {
              stepsCompleted: checkedSteps,
              completedAt: new Date().toISOString(),
              actualCost: actualPartsCost,
              actualTime,
            });
          } else {
            // Create new completed record
            const wos = d.workOrders || [];
            const woTitle = wos.map((w) => w.title).join(" + ") || d.title || "Repair";
            await addServiceRecord(completeVehicleId, {
              diagId: diag.id,
              woTitle,
              diagnosis: { title: d.title, severity: d.severity, summary: d.summary },
              workOrder: {
                estimatedTotalCost: actualPartsCost,
                estimatedHours: actualTime,
                difficulty: wos[0]?.difficulty || "moderate",
                parts: wos.flatMap((w) => w.parts || []),
                steps: wos.flatMap((w) => w.steps || []),
              },
              stepsCompleted: checkedSteps,
              stepCompletionDates: {},
              completedAt: new Date().toISOString(),
              actualCost: actualPartsCost,
              mileage: diag.vehicle?.mileage || "",
            });
          }
          setSavedToGarage(true);
          setSavedGarageVehicleId(completeVehicleId);
        }
      } catch (err) {
        console.log("[Garage] complete-save error:", err);
      }

      clearSession();

      Alert.alert(
        "Job Complete!",
        `Great work on the ${vLabel}! How was your experience with Hank's diagnosis?`,
        [
          { text: "Great", onPress: () => { awardPoints(POINTS.feedbackGiven); navigation.navigate("MainTabs"); } },
          { text: "Needs work", onPress: () => { awardPoints(POINTS.feedbackGiven); navigation.navigate("MainTabs"); } },
          { text: "Later", onPress: () => navigation.navigate("MainTabs") },
        ]
      );
    }
  };

  const getPartUrl = (store, part) => {
    const q = encodeURIComponent(
      `${v.year || ""} ${v.make || ""} ${v.model || ""} ${part.searchQuery || part.name}`
    );
    return store.url + q;
  };

  // ── Part Search Modal ──
  if (partSearch) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setPartSearch(null)}>
            <Text style={styles.backBtn}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Find This Part</Text>
          <View style={{ width: 28 }} />
        </View>
        <ScrollView style={{ padding: 20 }}>
          <View style={styles.partCard}>
            <Text style={styles.partName}>{partSearch.name}</Text>
            {partSearch.partNumber && (
              <Text style={styles.partNum}>Part #: {partSearch.partNumber}</Text>
            )}
            <Text style={styles.partCost}>Est. ${partSearch.estimatedCost}</Text>
          </View>

          <Text style={styles.sectionLabel}>Shop at These Retailers</Text>
          {PART_STORES.map((store) => (
            <TouchableOpacity
              key={store.name}
              onPress={() => Linking.openURL(getPartUrl(store, partSearch))}
              style={styles.storeRow}
              activeOpacity={0.8}
            >
              <View style={styles.storeInfo}>
                <Text style={styles.storeName}>{store.name}</Text>
                <Text style={styles.storeCta}>Tap to search →</Text>
              </View>
              <View style={[styles.shopBadge, { backgroundColor: store.color }]}>
                <Text style={styles.shopBadgeText}>Shop</Text>
              </View>
            </TouchableOpacity>
          ))}

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Main Result View ──
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Diagnosis Results</Text>
        <TouchableOpacity onPress={handleShare}>
          <Text style={styles.shareBtn}>📤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Vehicle Card */}
        <LinearGradient
          colors={["#1a2235", "#111827"]}
          style={[styles.vehicleCard, { borderColor: sevColor + "50" }]}
        >
          <View style={styles.vehicleHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.vehicleLabel}>Vehicle</Text>
              <Text style={styles.vehicleName}>{vLabel || "Unknown Vehicle"}</Text>
              {v.mileage && (
                <Text style={styles.vehicleMileage}>
                  {parseInt(v.mileage).toLocaleString()} miles
                </Text>
              )}
            </View>
            <Badge color={sevColor}>{d?.severity?.toUpperCase()}</Badge>
          </View>

          {/* Diagnosis Summary */}
          <View style={styles.diagBox}>
            <Text style={styles.diagTitle}>{d?.title}</Text>
            <Text style={styles.diagSummary}>{d?.summary}</Text>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: COLORS.accent }]}>${totalEst}</Text>
              <Text style={styles.statLabel}>Est. Total</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: COLORS.blue }]}>{totalHours.toFixed(1)}h</Text>
              <Text style={styles.statLabel}>Est. Time</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: COLORS.green }]}>{diag.confidence}%</Text>
              <Text style={styles.statLabel}>Confidence</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Force-accept warning */}
        {wasForceAccepted && (
          <View style={styles.forceAcceptBanner}>
            <Text style={styles.forceAcceptTitle}>⚠ Early Acceptance ({diag.confidence}% confidence)</Text>
            <Text style={styles.forceAcceptText}>
              This diagnosis was accepted before Hank finished his full analysis. The work order may be incomplete — consider re-diagnosing for a more thorough result.
            </Text>
          </View>
        )}

        {/* Re-diagnose */}
        <Button
          full
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={{ marginBottom: 16 }}
        >
          🔄 Continue / Re-Diagnose
        </Button>

        {/* YouTube help link (Feature #7) */}
        <TouchableOpacity
          onPress={() => {
            const query = encodeURIComponent(`${vLabel} ${d?.title} repair`);
            Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
          }}
          style={styles.youtubeLink}
        >
          <Text style={styles.youtubeLinkText}>▶ Find repair videos on YouTube</Text>
        </TouchableOpacity>

        {/* Work Orders */}
        <Text style={styles.sectionLabel}>
          Work Orders ({d?.workOrders?.length || 0})
        </Text>

        {d?.workOrders?.map((wo, wi) => {
          const isExpanded = expandedWO === wi;
          const isDone = completedWOs.has(wi);

          return (
            <View key={wi} style={[styles.woCard, isDone && styles.woCardDone]}>
              {/* Celebratory banner for completed work orders */}
              {isDone && (
                <View style={styles.celebBanner}>
                  <Text style={styles.celebBannerText}>WORK ORDER COMPLETE</Text>
                  <Text style={styles.celebBannerSub}>Nice work, this one's done!</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={() => setExpandedWO(isExpanded ? null : wi)}
                style={styles.woHeader}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.woTitle, isDone && { color: COLORS.green }]}>
                    {wo.title}
                  </Text>
                  <View style={styles.woMeta}>
                    <Text style={styles.woMetaItem}>${wo.estimatedTotalCost} est.</Text>
                    <Text style={styles.woMetaItem}>{wo.estimatedHours}h</Text>
                    <Text style={[styles.woMetaItem, {
                      color: wo.difficulty === "DIY" ? COLORS.green
                        : wo.difficulty === "professional" ? COLORS.red : COLORS.accent,
                    }]}>{wo.difficulty}</Text>
                  </View>
                </View>
                <View style={styles.woRight}>
                  {isDone && <Badge color={COLORS.green}>Done</Badge>}
                  <Text style={styles.chevron}>{isExpanded ? "▲" : "▼"}</Text>
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.woDetail}>
                  <Text style={styles.woDesc}>{wo.description}</Text>

                  {/* Parts — with arrival tracking */}
                  {wo.parts?.length > 0 && (
                    <>
                      <Text style={styles.woSubLabel}>Parts Needed</Text>
                      {wo.parts.map((part, pi) => {
                        const arrKey = `${wi}-${pi}`;
                        const isArrived = !!arrivedParts[arrKey];
                        return (
                          <View key={pi} style={[styles.partRow, isArrived && styles.partRowArrived]}>
                            <TouchableOpacity onPress={() => togglePartArrived(wi, pi)} style={styles.partArrivalCheck}>
                              <View style={[styles.partCheckbox, isArrived && styles.partCheckboxDone]}>
                                {isArrived && <Text style={styles.partCheckmark}>✓</Text>}
                              </View>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setPartSearch(part)} style={{ flex: 1 }}>
                              <Text style={[styles.partRowName, isArrived && { color: COLORS.green }]}>{part.name}</Text>
                              {part.partNumber && (
                                <Text style={styles.partRowNum}>#{part.partNumber}</Text>
                              )}
                              <Text style={styles.partArrivalLabel}>
                                {isArrived ? "Arrived" : "Tap checkbox when arrived"}
                              </Text>
                            </TouchableOpacity>
                            <View style={styles.partRowRight}>
                              <Text style={styles.partRowCost}>${part.estimatedCost}</Text>
                              <Text style={styles.partRowFind}>Find →</Text>
                            </View>
                          </View>
                        );
                      })}
                    </>
                  )}

                  {/* Steps — Checklist */}
                  {wo.steps?.length > 0 && (
                    <>
                      <Text style={[styles.woSubLabel, { marginTop: 14 }]}>Repair Steps</Text>
                      {wo.steps.map((step, si) => {
                        const isChecked = !!checkedSteps[`${wi}-${si}`];
                        return (
                          <TouchableOpacity
                            key={si}
                            style={[styles.stepRow, isChecked && styles.stepRowChecked]}
                            onPress={() => toggleStep(wi, si)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.stepCheckbox, isChecked && styles.stepCheckboxChecked]}>
                              {isChecked ? (
                                <Text style={styles.stepCheckmark}>✓</Text>
                              ) : (
                                <Text style={styles.stepNumText}>{si + 1}</Text>
                              )}
                            </View>
                            <Text style={[styles.stepText, isChecked && styles.stepTextChecked]}>{step}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}

                  {/* Complete WO */}
                  {!isDone && (
                    <Button
                      full
                      size="sm"
                      variant="green"
                      style={{ marginTop: 14 }}
                      onPress={() => promptCompleteWO(wi)}
                    >
                      Mark Work Order Complete
                    </Button>
                  )}
                  {isDone && (
                    <View style={styles.doneTag}>
                      <Text style={styles.doneTagText}>Completed</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* Save button */}
        {!diag.completed && (
          <Button
            full
            variant="accent"
            style={{ marginTop: 8 }}
            onPress={async () => {
              // Sync arrivedParts state to actual work order part statuses for SuppliesHub
              const syncedWOs = (diag.diagnosis?.workOrders || []).map((wo, wi) => ({
                ...wo,
                parts: (wo.parts || []).map((part, pi) => ({
                  ...part,
                  status: arrivedParts[`${wi}-${pi}`] ? "arrived" : (part.status || "needed"),
                })),
              }));
              const toSave = {
                ...diag,
                saved: true,
                title: diag.diagnosis?.title || "Diagnosis",
                summary: diag.diagnosis?.summary || "",
                severity: diag.diagnosis?.severity || "medium",
                diagnosis: { ...diag.diagnosis, workOrders: syncedWOs },
                savedCheckedSteps: checkedSteps,
                savedArrivedParts: arrivedParts,
                savedToGarage: true,
              };
              await saveDiagnosis(toSave);
              // Keep local diag in sync
              diag.diagnosis.workOrders = syncedWOs;

              // ── Save to Garage (create or update) ─
              let savedVehicleId = savedGarageVehicleId || diag.linkedVehicleId || null;
              try {
                if (!savedVehicleId) {
                  const matches = findMatchingVehicles(diag.vehicle);
                  if (matches.length > 0) {
                    savedVehicleId = matches[0].id;
                  } else if (diag.vehicle?.make) {
                    const newV = await createVehicle({
                      year: diag.vehicle.year || "",
                      make: diag.vehicle.make || "",
                      model: diag.vehicle.model || "",
                      trim: diag.vehicle.trim || "",
                      mileage: diag.vehicle.mileage || "",
                      transmission: diag.vehicle.transmission || "",
                    });
                    savedVehicleId = newV.id;
                  }
                }
                if (savedVehicleId) {
                  const existingRecord = findServiceRecordByDiagId(savedVehicleId, diag.id);
                  if (existingRecord) {
                    // Update existing record with latest steps + cost
                    await updateServiceRecord(savedVehicleId, existingRecord.id, {
                      stepsCompleted: checkedSteps,
                      notes: wasForceAccepted
                        ? `[Auto-note] Diagnosis was force-accepted at ${diag.confidence}% confidence. Work order may be incomplete.`
                        : existingRecord.notes,
                    });
                  } else {
                    // Create new open work order record
                    const wos = diag.diagnosis?.workOrders || [];
                    const woTitle = wos.map((wo) => wo.title).join(" + ") || diag.diagnosis?.title || "Repair";
                    const forceNote = wasForceAccepted
                      ? `[Auto-note] Diagnosis was force-accepted at ${diag.confidence}% confidence. Work order may be incomplete.`
                      : "";
                    await addServiceRecord(savedVehicleId, {
                      diagId: diag.id,
                      woTitle,
                      diagnosis: { title: diag.diagnosis?.title, severity: diag.diagnosis?.severity, summary: diag.diagnosis?.summary },
                      workOrder: {
                        estimatedTotalCost: totalEst,
                        estimatedHours: totalHours,
                        difficulty: wos[0]?.difficulty || "moderate",
                        parts: wos.flatMap((wo) => wo.parts || []),
                        steps: wos.flatMap((wo) => wo.steps || []),
                      },
                      stepsCompleted: checkedSteps,
                      mileage: diag.vehicle?.mileage || "",
                      notes: forceNote,
                    });
                  }
                  setSavedToGarage(true);
                  setSavedGarageVehicleId(savedVehicleId);
                }
              } catch (err) {
                console.log("[Garage] save error:", err);
              }

              // ── Clear Hank's session so next diagnosis starts fresh ──
              clearSession();

              // ── Prompt for maintenance reminders ───────────
              if (savedVehicleId) {
                try {
                  const suggestions = await getMaintenanceSuggestions(savedVehicleId);
                  const overdueItems = suggestions.filter((s) => s.urgency === "overdue");
                  if (overdueItems.length > 0) {
                    const itemList = overdueItems.map((s) => s.label).join(", ");
                    Alert.alert(
                      "🔔 Hank's Reminder",
                      `Hey — while you're at it, your ${vLabel} is overdue for: ${itemList}. Want me to set a reminder?`,
                      [
                        {
                          text: "Yes, remind me",
                          onPress: async () => {
                            for (const item of overdueItems) {
                              const currentMi = parseInt(v.mileage) || 0;
                              await addReminder(savedVehicleId, {
                                type: item.type,
                                label: item.label,
                                dueMileage: String(currentMi + (item.intervalMiles || 5000)),
                                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                                notes: `Suggested after ${d?.title || "repair"}`,
                              });
                            }
                            Alert.alert("Reminders Set!", "Hank will remind you when maintenance is due.", [
                              { text: "OK", onPress: () => navigation.navigate("MainTabs") },
                            ]);
                          },
                        },
                        { text: "No thanks", onPress: () => navigation.navigate("MainTabs") },
                      ]
                    );
                    return;
                  }
                } catch (err) {
                  console.log("[Garage] reminder check error:", err);
                }
              }

              Alert.alert(
                "Saved!",
                "Work order saved to your garage. Ready for the next car!",
                [{ text: "OK", onPress: () => navigation.navigate("MainTabs") }]
              );
            }}
          >
            💾 Save Vehicle & Work Orders
          </Button>
        )}

        {/* Safety disclaimers at bottom */}
        <View style={styles.safetyBlurb}>
          <Text style={styles.safetyBlurbText}>
            ⚠ Double-check all suggested parts, specs, and procedures against your vehicle's manual before starting. This is AI-generated guidance — not professional advice.
          </Text>
        </View>
        <View style={styles.safetyBlurbSmall}>
          <Text style={styles.safetyBlurbSmallText}>
            Always have safety-critical repairs (brakes, steering, suspension) verified by a certified professional.
          </Text>
        </View>
      </ScrollView>

      {/* ── Completion Confirmation Modal ────────────── */}
      <Modal visible={showCompleteModal} transparent animationType="slide" onRequestClose={() => setShowCompleteModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCompleteModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Confirm Completion</Text>
            <Text style={styles.modalSubtitle}>
              {completeWOIndex !== null ? d?.workOrders?.[completeWOIndex]?.title : ""}
            </Text>
            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>Actual Time (hours)</Text>
              <TextInput
                style={styles.modalInput}
                value={completeTimeHours}
                onChangeText={setCompleteTimeHours}
                keyboardType="numeric"
                placeholder="e.g. 2.5"
                placeholderTextColor={COLORS.textD}
              />
            </View>
            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>Actual Parts Cost ($)</Text>
              <TextInput
                style={styles.modalInput}
                value={completePartsCost}
                onChangeText={setCompletePartsCost}
                keyboardType="numeric"
                placeholder="e.g. 185.00"
                placeholderTextColor={COLORS.textD}
              />
            </View>
            <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleConfirmComplete}>
              <Text style={styles.modalConfirmText}>Complete Work Order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCompleteModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Pinned Progress Bar ────────────────────── */}
      {totalSteps > 0 && (
        <View style={styles.progressBar}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>
              {progressPct >= 1 ? "JOB COMPLETE!" : "JOB PROGRESS"}
            </Text>
            <Text style={styles.progressCount}>
              {completedStepCount}/{totalSteps} steps
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={progressPct >= 1 ? GRADIENTS.green : GRADIENTS.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${Math.max(progressPct * 100, 2)}%` }]}
            />
          </View>
          <Text style={[styles.progressPct, progressPct >= 1 && { color: COLORS.green }]}>
            {Math.round(progressPct * 100)}%
          </Text>
        </View>
      )}

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
                  { backgroundColor: i === 1 ? COLORS.green : "#2a3d5a" },
                ]}
              />
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.dashBtn}
          onPress={() => navigation.navigate("DiagChat", { newDiag: true })}
        >
          <Text style={styles.dashIcon}>＋</Text>
          <Text style={styles.dashLabel}>NEW</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { fontSize: 20, color: COLORS.accent },
  shareBtn: { fontSize: 20 },
  headerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
    fontFamily: FONTS.bodyBold,
  },
  vehicleCard: {
    borderWidth: 2,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  vehicleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  vehicleLabel: {
    fontSize: 11,
    color: COLORS.textM,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontFamily: FONTS.body,
  },
  vehicleName: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
    fontFamily: FONTS.heading,
  },
  vehicleMileage: {
    fontSize: 11,
    color: COLORS.textM,
    fontFamily: FONTS.body,
  },
  diagBox: {
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  diagTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 4,
    fontFamily: FONTS.bodyBold,
  },
  diagSummary: {
    fontSize: 12,
    color: COLORS.textM,
    lineHeight: 20,
    fontFamily: FONTS.body,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    fontFamily: FONTS.heading,
  },
  statLabel: {
    fontSize: 9,
    color: COLORS.textM,
    textTransform: "uppercase",
    fontFamily: FONTS.body,
  },
  // ── Force-accept banner
  forceAcceptBanner: {
    backgroundColor: "#1a1a0e",
    borderWidth: 2,
    borderColor: COLORS.accent + "60",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  forceAcceptTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.accent,
    fontFamily: FONTS.bodyBold,
    marginBottom: 4,
  },
  forceAcceptText: {
    fontSize: 11,
    color: COLORS.textM,
    lineHeight: 18,
    fontFamily: FONTS.body,
  },

  // ── Safety blurbs
  safetyBlurb: {
    backgroundColor: "#1a1a0e",
    borderWidth: 1,
    borderColor: COLORS.accent + "40",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  safetyBlurbText: {
    fontSize: 11,
    color: COLORS.accent,
    lineHeight: 18,
    fontFamily: FONTS.body,
    textAlign: "center",
  },
  safetyBlurbSmall: {
    padding: 10,
    marginTop: 8,
    alignItems: "center",
  },
  safetyBlurbSmallText: {
    fontSize: 9,
    color: COLORS.textD,
    lineHeight: 14,
    fontFamily: FONTS.body,
    textAlign: "center",
  },

  youtubeLink: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.red + "40",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: "center",
  },
  youtubeLinkText: {
    fontSize: 13,
    color: COLORS.red,
    fontWeight: "700",
    fontFamily: FONTS.bodyBold,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textM,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 10,
    fontFamily: FONTS.bodyBold,
  },
  woCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    marginBottom: 10,
    overflow: "hidden",
  },
  woCardDone: {
    borderColor: COLORS.green + "50",
  },
  woHeader: {
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  woTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
    fontFamily: FONTS.bodyBold,
  },
  woMeta: {
    flexDirection: "row",
    gap: 8,
    marginTop: 3,
  },
  woMetaItem: {
    fontSize: 10,
    color: COLORS.textM,
    fontFamily: FONTS.body,
  },
  woRight: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  chevron: { color: COLORS.textM, fontSize: 14 },
  woDetail: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 14,
  },
  woDesc: {
    fontSize: 12,
    color: COLORS.textM,
    marginBottom: 14,
    lineHeight: 20,
    fontFamily: FONTS.body,
  },
  woSubLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.textM,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
    fontFamily: FONTS.bodyBold,
  },
  partRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  partRowName: { fontSize: 12, fontWeight: "700", color: COLORS.text, fontFamily: FONTS.bodyBold },
  partRowNum: { fontSize: 10, color: COLORS.textM, fontFamily: FONTS.body },
  partRowRight: { flexDirection: "row", gap: 8, alignItems: "center" },
  partRowCost: { fontSize: 13, fontWeight: "800", color: COLORS.accent, fontFamily: FONTS.bodyBold },
  partRowFind: { fontSize: 11, color: COLORS.blue, fontWeight: "700", fontFamily: FONTS.bodyBold },
  stepRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
    alignItems: "flex-start",
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepRowChecked: {
    backgroundColor: COLORS.green + "10",
    borderColor: COLORS.green + "30",
  },
  stepCheckbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: COLORS.blue,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.blue + "20",
    marginTop: 1,
  },
  stepCheckboxChecked: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  stepCheckmark: { fontSize: 14, fontWeight: "800", color: COLORS.white },
  stepNumText: { fontSize: 10, fontWeight: "800", color: COLORS.blue },
  stepText: { fontSize: 12, color: COLORS.text, lineHeight: 20, flex: 1, fontFamily: FONTS.body },
  stepTextChecked: { color: COLORS.textM, textDecorationLine: "line-through" },

  // ── Progress Bar (pinned above dashboard)
  progressBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressInfo: { width: 90 },
  progressLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: COLORS.accent,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontFamily: FONTS.bodyBold,
  },
  progressCount: {
    fontSize: 10,
    color: COLORS.textM,
    fontFamily: FONTS.body,
    marginTop: 1,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressPct: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.accent,
    fontFamily: FONTS.heading,
    width: 40,
    textAlign: "right",
  },
  doneTag: {
    backgroundColor: COLORS.green + "15",
    borderWidth: 1,
    borderColor: COLORS.green + "30",
    borderRadius: 10,
    padding: 14,
    marginTop: 14,
  },
  doneTagText: { fontSize: 12, color: COLORS.green, fontWeight: "700", fontFamily: FONTS.bodyBold },
  partCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  partName: { fontSize: 16, fontWeight: "800", color: COLORS.text, fontFamily: FONTS.bodyBold },
  partNum: { fontSize: 11, color: COLORS.textM, marginTop: 2, fontFamily: FONTS.body },
  partCost: { fontSize: 12, color: COLORS.accent, fontWeight: "700", marginTop: 4, fontFamily: FONTS.bodyBold },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    gap: 14,
  },
  storeInfo: { flex: 1 },
  storeName: { fontSize: 14, fontWeight: "800", color: COLORS.text, fontFamily: FONTS.bodyBold },
  storeCta: { fontSize: 11, color: COLORS.textM, fontFamily: FONTS.body },
  shopBadge: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  shopBadgeText: { fontSize: 11, fontWeight: "700", color: COLORS.white, fontFamily: FONTS.bodyBold },
  // ── Celebratory banner
  celebBanner: {
    backgroundColor: COLORS.green + "18",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.green + "40",
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  celebBannerText: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.green,
    fontFamily: FONTS.heading,
    letterSpacing: 2,
  },
  celebBannerSub: {
    fontSize: 10,
    color: COLORS.green,
    fontFamily: FONTS.body,
    marginTop: 2,
    opacity: 0.8,
  },

  // ── Parts arrival
  partRowArrived: {
    borderColor: COLORS.green + "50",
    backgroundColor: COLORS.green + "08",
  },
  partArrivalCheck: { marginRight: 8, justifyContent: "center" },
  partCheckbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bg,
  },
  partCheckboxDone: {
    backgroundColor: COLORS.green, borderColor: COLORS.green,
  },
  partCheckmark: { fontSize: 13, fontWeight: "800", color: COLORS.white },
  partArrivalLabel: { fontSize: 8, color: COLORS.textD, fontFamily: FONTS.body, marginTop: 2 },

  // ── Completion confirmation modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center", marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16, fontWeight: "900", color: COLORS.text,
    fontFamily: FONTS.heading, textAlign: "center", marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12, color: COLORS.textM, fontFamily: FONTS.body,
    textAlign: "center", marginBottom: 20,
  },
  modalField: { marginBottom: 14 },
  modalFieldLabel: {
    fontSize: 11, fontWeight: "700", color: COLORS.textM,
    fontFamily: FONTS.bodyBold, marginBottom: 6,
  },
  modalInput: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    color: COLORS.text, fontSize: 14, fontFamily: FONTS.body,
  },
  modalConfirmBtn: {
    backgroundColor: COLORS.green, borderRadius: 12,
    paddingVertical: 14, alignItems: "center", marginTop: 8,
  },
  modalConfirmText: {
    fontSize: 14, fontWeight: "800", color: COLORS.white, fontFamily: FONTS.bodyBold,
  },
  modalCancelBtn: {
    paddingVertical: 12, alignItems: "center", marginTop: 6,
  },
  modalCancelText: {
    fontSize: 13, color: COLORS.textM, fontFamily: FONTS.body,
  },

  // ── Bottom Dashboard
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
