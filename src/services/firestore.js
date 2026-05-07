// ─── FIRESTORE SERVICE (DEV MODE) ─────────────────────────────────────────────
// Running with mock data for Expo Go development.
// Real Firestore will be wired in during EAS build setup.

import { getCurrentUser } from "./firebase";
import { loadJSON, saveJSON } from "./persist";
import { moveToTrash, TYPES as TRASH } from "./trash";
import { findMatchingVehicles, createVehicle } from "./garage";

let mockDiagnoses = [];

let mockVehicles = [];

let _firestoreLoaded = null;
const ensureLoaded = () => {
  if (!_firestoreLoaded) {
    _firestoreLoaded = Promise.all([
      loadJSON("firestore_diagnoses", []).then((d) => { mockDiagnoses = d; }),
      loadJSON("firestore_vehicles", []).then((v) => { mockVehicles = v; }),
    ]);
  }
  return _firestoreLoaded;
};
const persistDiagnoses = () => saveJSON("firestore_diagnoses", mockDiagnoses);
const persistVehicles = () => saveJSON("firestore_vehicles", mockVehicles);
ensureLoaded();


const mockLeaderboard = [
  { uid: "dev-user-001", rank: 1, name: "Angela", points: 75, rankTitle: "Oil Change Specialist" },
  { uid: "user-002", rank: 2, name: "Mike R.", points: 60, rankTitle: "Lube Tech" },
  { uid: "user-003", rank: 3, name: "Sarah K.", points: 45, rankTitle: "Lube Tech" },
  { uid: "user-004", rank: 4, name: "James T.", points: 30, rankTitle: "Lube Tech" },
  { uid: "user-005", rank: 5, name: "Lisa M.", points: 20, rankTitle: "Lube Tech" },
];


// ─── ENSURE VEHICLE IN GARAGE ───────────────────────────────────────────────
// When a diagnosis is saved with a real vehicle, make sure that vehicle exists
// in the user's garage. Returns the linked vehicle ID (existing or newly
// created). No-ops if there's no usable vehicle info yet.
const ensureVehicleInGarage = async (diag) => {
  // Need at least make + model to form a real vehicle
  const v = diag?.vehicle;
  if (!v?.make || !v?.model) return diag?.linkedVehicleId || null;

  // If there's no real conversation yet, don't create a phantom garage entry
  const hasContent =
    (diag.transcript?.length || 0) > 0 ||
    (diag.diagnosis?.workOrders?.length || 0) > 0 ||
    diag.completed;
  if (!hasContent) return diag?.linkedVehicleId || null;

  // If already linked to a garage vehicle, keep that link
  if (diag.linkedVehicleId) return diag.linkedVehicleId;

  // Look for an existing match in the garage
  const matches = findMatchingVehicles(v);
  if (matches.length > 0) return matches[0].id;

  // Create a new garage entry
  try {
    const newV = await createVehicle({
      year: v.year || "",
      make: v.make || "",
      model: v.model || "",
      trim: v.trim || "",
      mileage: v.mileage || "",
      transmission: v.transmission || "",
    });
    return newV.id;
  } catch (e) {
    console.warn("[firestore] ensureVehicleInGarage createVehicle failed:", e?.message ?? e);
    return null;
  }
};

export const saveDiagnosis = async (diag) => {
  await ensureLoaded();
  const user = getCurrentUser();
  // Ensure startedAt is always an ISO string (not a Date object) for serialization safety
  const safeStartedAt = diag.startedAt instanceof Date
    ? diag.startedAt.toISOString()
    : diag.startedAt;
  let safeDiag = safeStartedAt !== diag.startedAt ? { ...diag, startedAt: safeStartedAt } : diag;

  // Auto-add the vehicle to the user's garage if appropriate, and link the diagnosis
  const linkedVehicleId = await ensureVehicleInGarage(safeDiag);
  if (linkedVehicleId && safeDiag.linkedVehicleId !== linkedVehicleId) {
    safeDiag = { ...safeDiag, linkedVehicleId };
  }

  const existing = mockDiagnoses.findIndex(d => d.id === safeDiag.id);
  if (existing >= 0) {
    mockDiagnoses[existing] = { ...mockDiagnoses[existing], ...safeDiag };
  } else {
    mockDiagnoses.unshift({ ...safeDiag, userId: user?.uid, startedAt: safeStartedAt || new Date().toISOString() });
  }
  console.log("[DEV] saveDiagnosis:", safeDiag.id, linkedVehicleId ? `(linked to vehicle ${linkedVehicleId})` : "");
  await persistDiagnoses();
};

export const getDiagnoses = async () => {
  await ensureLoaded();
  return mockDiagnoses;
};

export const getDiagnosisById = async (id) => {
  await ensureLoaded();
  return mockDiagnoses.find(d => d.id === id) || null;
};

export const deleteDiagnosis = async (id) => {
  await ensureLoaded();
  const idx = mockDiagnoses.findIndex((d) => d.id === id);
  if (idx < 0) return false;
  const [item] = mockDiagnoses.splice(idx, 1);
  await moveToTrash(TRASH.DIAGNOSIS, item);
  await persistDiagnoses();

  return true;
};

export const saveVehicle = async (vehicle) => {
  await ensureLoaded();
  mockVehicles.push(vehicle);
  console.log("[DEV] saveVehicle:", vehicle);
  await persistVehicles();
};

export const getVehicles = async () => {
  await ensureLoaded();
  return mockVehicles;
};

export const getLeaderboard = async (limit = 50) => {
  await ensureLoaded();
  return mockLeaderboard.slice(0, limit);
};

export const submitFeedback = async (feedback) => {
  await ensureLoaded();
  console.log("[DEV] submitFeedback:", feedback);
  await persistDiagnoses();
};

export const submitBugReport = async (report) => {
  await ensureLoaded();
  console.log("[DEV] submitBugReport:", report);
  await persistDiagnoses();
};

// ─── RESET ───────────────────────────────────────────────────────────────────
// Wipes all in-memory diagnosis and vehicle records.
export const resetAllData = async () => {
  mockDiagnoses = [];
  mockVehicles = [];
  await Promise.all([
    saveJSON("firestore_diagnoses", []),
    saveJSON("firestore_vehicles", []),
  ]);
};


// ─── Restore (used by Trash screen) ─────────────────────────────────────────
export const restoreDiagnosis = async (diag) => {
  await ensureLoaded();
  mockDiagnoses.unshift({ ...diag });
  await persistDiagnoses();

  return diag;
};


// ─── BACKFILL ────────────────────────────────────────────────────────────────
// Called once on app start. Scans all existing diagnoses and ensures any with
// a real vehicle have a corresponding entry in the garage. Returns the number
// of garage vehicles created/linked.
export const backfillGarageVehicles = async () => {
  await ensureLoaded();
  let updated = 0;
  for (let i = 0; i < mockDiagnoses.length; i++) {
    const d = mockDiagnoses[i];
    const id = await ensureVehicleInGarage(d);
    if (id && d.linkedVehicleId !== id) {
      mockDiagnoses[i] = { ...d, linkedVehicleId: id };
      updated++;
    }
  }
  if (updated > 0) {
    await persistDiagnoses();
    console.log(`[firestore] backfillGarageVehicles: linked ${updated} diagnosis(es) to garage`);
  }
  return updated;
};
