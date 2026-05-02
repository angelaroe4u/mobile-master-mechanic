// ─── FIRESTORE SERVICE (DEV MODE) ─────────────────────────────────────────────
// Running with mock data for Expo Go development.
// Real Firestore will be wired in during EAS build setup.

import { getCurrentUser } from "./firebase";
import { loadJSON, saveJSON } from "./persist";
import { moveToTrash, TYPES as TRASH } from "./trash";

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

export const saveDiagnosis = async (diag) => {
  await ensureLoaded();
  const user = getCurrentUser();
  // Ensure startedAt is always an ISO string (not a Date object) for serialization safety
  const safeStartedAt = diag.startedAt instanceof Date
    ? diag.startedAt.toISOString()
    : diag.startedAt;
  const safeDiag = safeStartedAt !== diag.startedAt ? { ...diag, startedAt: safeStartedAt } : diag;

  const existing = mockDiagnoses.findIndex(d => d.id === safeDiag.id);
  if (existing >= 0) {
    mockDiagnoses[existing] = { ...mockDiagnoses[existing], ...safeDiag };
  } else {
    mockDiagnoses.unshift({ ...safeDiag, userId: user?.uid, startedAt: safeStartedAt || new Date().toISOString() });
  }
  console.log("[DEV] saveDiagnosis:", safeDiag.id);
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
