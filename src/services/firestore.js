// ─── FIRESTORE SERVICE (DEV MODE) ─────────────────────────────────────────────
// Running with mock data for Expo Go development.
// Real Firestore will be wired in during EAS build setup.

import { getCurrentUser } from "./firebase";

let mockDiagnoses = [
  {
    id: "diag-001",
    userId: "dev-user-001",
    vehicle: { year: "2019", make: "Toyota", model: "Camry", mileage: "87000", transmission: "automatic" },
    title: "Check Engine Light — P0420",
    summary: "Catalytic converter efficiency below threshold.",
    severity: "medium",
    completed: true,
    startedAt: "2026-04-10T12:00:00.000Z",
    transcript: [],
    apiMessages: [],
    tools: [],
    keyTerms: [],
    confidence: 92,
    done: true,
    diagnosis: {
      title: "Catalytic Converter Efficiency — P0420",
      severity: "medium",
      summary: "Catalytic converter efficiency below threshold. Bank 1 catalyst is not operating at peak efficiency.",
      workOrders: [
        {
          title: "Replace Catalytic Converter",
          description: "Remove and replace the failing catalytic converter on Bank 1.",
          estimatedTotalCost: 1200,
          estimatedHours: 3,
          difficulty: "professional",
          parts: [
            { name: "Catalytic Converter (Bank 1)", partNumber: "16400-39445", estimatedCost: 850, searchQuery: "2019 Toyota Camry catalytic converter" },
            { name: "Exhaust Gasket Set", partNumber: "90917-06089", estimatedCost: 25, searchQuery: "2019 Toyota Camry exhaust gasket" },
          ],
          steps: [
            "Lift vehicle and secure on jack stands",
            "Disconnect O2 sensors (upstream and downstream)",
            "Remove exhaust bolts connecting the catalytic converter",
            "Remove old catalytic converter and gaskets",
            "Install new gaskets and catalytic converter",
            "Reconnect O2 sensors",
            "Lower vehicle and clear DTCs with OBD-II scanner",
            "Start engine and verify no exhaust leaks",
          ],
        },
      ],
    },
    messages: [],
  },
  {
    id: "diag-002",
    userId: "dev-user-001",
    vehicle: { year: "2021", make: "Honda", model: "CR-V", mileage: "42000", transmission: "automatic" },
    title: "Squealing noise when braking",
    summary: "Brake pad wear indicator making contact with rotor.",
    severity: "low",
    completed: false,
    startedAt: "2026-04-12T12:00:00.000Z",
    transcript: [],
    apiMessages: [],
    tools: [],
    keyTerms: [],
    confidence: 0,
    done: false,
    diagnosis: null,
    messages: [],
  },
];

let mockVehicles = [
  { year: "2019", make: "Toyota", model: "Camry", mileage: "87000", transmission: "automatic" },
  { year: "2021", make: "Honda", model: "CR-V", mileage: "42000", transmission: "automatic" },
];

const mockLeaderboard = [
  { uid: "dev-user-001", rank: 1, name: "Angela", points: 75, rankTitle: "Oil Change Specialist" },
  { uid: "user-002", rank: 2, name: "Mike R.", points: 60, rankTitle: "Lube Tech" },
  { uid: "user-003", rank: 3, name: "Sarah K.", points: 45, rankTitle: "Lube Tech" },
  { uid: "user-004", rank: 4, name: "James T.", points: 30, rankTitle: "Lube Tech" },
  { uid: "user-005", rank: 5, name: "Lisa M.", points: 20, rankTitle: "Lube Tech" },
];

export const saveDiagnosis = async (diag) => {
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
};

export const getDiagnoses = async () => {
  return mockDiagnoses;
};

export const getDiagnosisById = async (id) => {
  return mockDiagnoses.find(d => d.id === id) || null;
};

export const deleteDiagnosis = async (id) => {
  mockDiagnoses = mockDiagnoses.filter(d => d.id !== id);
  console.log("[DEV] deleteDiagnosis:", id);
};

export const saveVehicle = async (vehicle) => {
  mockVehicles.push(vehicle);
  console.log("[DEV] saveVehicle:", vehicle);
};

export const getVehicles = async () => {
  return mockVehicles;
};

export const getLeaderboard = async (limit = 50) => {
  return mockLeaderboard.slice(0, limit);
};

export const submitFeedback = async (feedback) => {
  console.log("[DEV] submitFeedback:", feedback);
};

export const submitBugReport = async (report) => {
  console.log("[DEV] submitBugReport:", report);
};
