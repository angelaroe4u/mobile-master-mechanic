// ─── GARAGE SERVICE ──────────────────────────────────────────────────────────
// Manages vehicle profiles, service history, photos, and notes.
// DEV MODE: in-memory storage. Production: Firestore/Supabase.

import { getCurrentUser } from "./firebase";
import { loadJSON, saveJSON } from "./persist";
import { moveToTrash, TYPES as TRASH } from "./trash";

// ─── IN-MEMORY STORE ────────────────────────────────────────────────────────
// Each vehicle: { id, userId, year, make, model, trim, mileage, transmission,
//                 nickname, photos:[], notes:[], serviceRecords:[], createdAt, updatedAt }
// Each serviceRecord: { id, diagId, woTitle, diagnosis, workOrder, stepsCompleted:{},
//                       stepCompletionDates:{}, completedAt, actualCost, notes,
//                       vehicle:{...}, photos:[] }

let vehicles = [];
let _vehiclesLoaded = null;

const currentUid = () => getCurrentUser()?.uid || null;

// One-time backfill: any record on disk without a userId is attributed to the
// currently signed-in user. Multi-user device case: records belonging to other
// users (already stamped with their uid) are left untouched. Orphans only get
// claimed once a user is signed in. Returns true if anything changed.
const claimOrphanVehicles = (uid) => {
  if (!uid) return false;
  let changed = false;
  for (let i = 0; i < vehicles.length; i++) {
    if (!vehicles[i].userId) {
      vehicles[i] = { ...vehicles[i], userId: uid };
      changed = true;
    }
  }
  return changed;
};

// One-time cleanup: an older build hard-coded a dev seed vehicle ("veh-001":
// 2019 Toyota Camry) into the in-memory store on every load. Testers ended up
// with someone else's Camry in their garage. Strip it from any user's
// AsyncStorage on first load after upgrade. Safe no-op if it isn't there.
const stripLegacySeed = (v) => {
  if (!Array.isArray(v)) return { list: v, removed: false };
  const filtered = v.filter((veh) => veh && veh.id !== "veh-001");
  return { list: filtered, removed: filtered.length !== v.length };
};

// Lazy-load on first call. Returns a promise that resolves once vehicles are populated from AsyncStorage.
const ensureLoaded = () => {
  if (!_vehiclesLoaded) {
    _vehiclesLoaded = loadJSON("garage_vehicles", []).then(async (v) => {
      const seedStrip = stripLegacySeed(v);
      vehicles = seedStrip.list;
      const claimed = claimOrphanVehicles(currentUid());
      if (seedStrip.removed || claimed) {
        await saveJSON("garage_vehicles", vehicles);
      }
    });
  }
  return _vehiclesLoaded;
};

const persistVehicles = () => saveJSON("garage_vehicles", vehicles);

// Kick off the load eagerly so synchronous reads (e.g. findMatchingVehicles) get data fast.
ensureLoaded();

const genId = () => Math.random().toString(36).slice(2, 10);

// ─── VEHICLE MATCHING ───────────────────────────────────────────────────────
// Fuzzy match a vehicle description against the CURRENT USER'S garage vehicles.
// Returns [] when no user is signed in so we never leak another user's data.
export const findMatchingVehicles = (vehicleInfo) => {
  if (!vehicleInfo) return [];
  const uid = currentUid();
  if (!uid) return [];
  const { year, make, model } = vehicleInfo;
  if (!year && !make && !model) return [];

  return vehicles.filter((v) => {
    if (v.userId !== uid) return false;
    const yearMatch = !year || !v.year || v.year === year;
    const makeMatch = !make || !v.make || v.make.toLowerCase() === make.toLowerCase();
    const modelMatch = !model || !v.model || v.model.toLowerCase() === model.toLowerCase();
    // Require at least make+model to match, or all three
    const hasEnoughInfo = (make && model) || (year && make) || (year && model);
    return hasEnoughInfo && yearMatch && makeMatch && modelMatch;
  });
};

// ─── CRUD ───────────────────────────────────────────────────────────────────
export const getVehicles = async () => {
  await ensureLoaded();
  const uid = currentUid();
  if (!uid) return [];
  // User may have signed in after the initial load; run backfill opportunistically.
  if (claimOrphanVehicles(uid)) await persistVehicles();
  return vehicles
    .filter((v) => v.userId === uid)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
};

export const getVehicleById = async (id) => {
  await ensureLoaded();
  const uid = currentUid();
  if (!uid) return null;
  return vehicles.find((v) => v.id === id && v.userId === uid) || null;
};

export const createVehicle = async (vehicleInfo) => {
  await ensureLoaded();
  const user = getCurrentUser();
  const vehicle = {
    id: genId(),
    userId: user?.uid,
    year: vehicleInfo.year || "",
    make: vehicleInfo.make || "",
    model: vehicleInfo.model || "",
    trim: vehicleInfo.trim || "",
    mileage: vehicleInfo.mileage || "",
    transmission: vehicleInfo.transmission || "",
    nickname: vehicleInfo.nickname || "",
    photos: [],
    notes: [],
    serviceRecords: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  vehicles.unshift(vehicle);
  console.log("[DEV] createVehicle:", vehicle.id, vehicle.year, vehicle.make, vehicle.model);
  await persistVehicles();

  return vehicle;
};

export const updateVehicle = async (id, updates) => {
  await ensureLoaded();
  const idx = vehicles.findIndex((v) => v.id === id);
  if (idx >= 0) {
    vehicles[idx] = { ...vehicles[idx], ...updates, updatedAt: new Date().toISOString() };
    await persistVehicles();
    return vehicles[idx];
  }
  return null;
};

export const deleteVehicle = async (id) => {
  await ensureLoaded();
  const idx = vehicles.findIndex((v) => v.id === id);
  if (idx < 0) return false;
  const [item] = vehicles.splice(idx, 1);
  await moveToTrash(TRASH.VEHICLE, item);
  await persistVehicles();

  return true;
};

// ─── SERVICE RECORDS ────────────────────────────────────────────────────────
export const addServiceRecord = async (vehicleId, record) => {
  await ensureLoaded();
  const idx = vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) return null;

  const serviceRecord = {
    id: genId(),
    diagId: record.diagId || "",
    woTitle: record.woTitle || "Repair",
    diagnosis: record.diagnosis || null,
    workOrder: record.workOrder || null,
    stepsCompleted: record.stepsCompleted || {},
    stepCompletionDates: record.stepCompletionDates || {},
    completedAt: record.completedAt || null,
    actualCost: record.actualCost || null,
    notes: record.notes || "",
    photos: record.photos || [],
    vehicle: {
      year: vehicles[idx].year,
      make: vehicles[idx].make,
      model: vehicles[idx].model,
      trim: vehicles[idx].trim,
      mileage: record.mileage || vehicles[idx].mileage,
    },
    createdAt: new Date().toISOString(),
  };

  vehicles[idx].serviceRecords.unshift(serviceRecord);
  vehicles[idx].updatedAt = new Date().toISOString();

  // Update mileage if provided (keeps it current)
  if (record.mileage) {
    vehicles[idx].mileage = record.mileage;
  }

  console.log("[DEV] addServiceRecord:", vehicleId, serviceRecord.id);
  await persistVehicles();

  return serviceRecord;
};

// Find a service record by diagId (for updating an existing record on completion)
export const findServiceRecordByDiagId = (vehicleId, diagId) => {
  const v = vehicles.find((v) => v.id === vehicleId);
  if (!v || !diagId) return null;
  const rec = v.serviceRecords.find((r) => r.diagId === diagId);
  return rec || null;
};

export const updateServiceRecord = async (vehicleId, recordId, updates) => {
  await ensureLoaded();
  const vIdx = vehicles.findIndex((v) => v.id === vehicleId);
  if (vIdx < 0) return null;
  const rIdx = vehicles[vIdx].serviceRecords.findIndex((r) => r.id === recordId);
  if (rIdx < 0) return null;
  vehicles[vIdx].serviceRecords[rIdx] = { ...vehicles[vIdx].serviceRecords[rIdx], ...updates };
  vehicles[vIdx].updatedAt = new Date().toISOString();
  await persistVehicles();

  return vehicles[vIdx].serviceRecords[rIdx];
};

// ─── PHOTOS ─────────────────────────────────────────────────────────────────
export const addVehiclePhoto = async (vehicleId, photoUri, caption = "") => {
  await ensureLoaded();
  const idx = vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) return null;
  const photo = { id: genId(), uri: photoUri, caption, createdAt: new Date().toISOString() };
  vehicles[idx].photos.push(photo);
  vehicles[idx].updatedAt = new Date().toISOString();
  await persistVehicles();

  return photo;
};

// ─── NOTES ──────────────────────────────────────────────────────────────────
export const addVehicleNote = async (vehicleId, text) => {
  await ensureLoaded();
  const idx = vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) return null;
  const note = { id: genId(), text, createdAt: new Date().toISOString() };
  vehicles[idx].notes.unshift(note);
  vehicles[idx].updatedAt = new Date().toISOString();
  await persistVehicles();

  return note;};

export const deleteVehicleNote = async (vehicleId, noteId) => {
  await ensureLoaded();
  const idx = vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) return;
  vehicles[idx].notes = vehicles[idx].notes.filter((n) => n.id !== noteId);
  await persistVehicles();
};

// ─── OIL CHANGES ───────────────────────────────────────────────────────────
export const addOilChange = async (vehicleId, entry) => {
  await ensureLoaded();
  const idx = vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) return null;
  const record = {
    id: genId(),
    date: entry.date || new Date().toISOString(),
    mileage: entry.mileage || "",
    oilType: entry.oilType || "",        // e.g. "Full Synthetic"
    oilWeight: entry.oilWeight || "",    // e.g. "5W-30"
    filterBrand: entry.filterBrand || "",
    notes: entry.notes || "",
    createdAt: new Date().toISOString(),
  };
  if (!vehicles[idx].oilChanges) vehicles[idx].oilChanges = [];
  vehicles[idx].oilChanges.unshift(record);
  vehicles[idx].updatedAt = new Date().toISOString();
  if (entry.mileage) vehicles[idx].mileage = entry.mileage;
  await persistVehicles();

  return record;};

export const getOilChanges = async (vehicleId) => {
  const v = vehicles.find((v) => v.id === vehicleId);
  return v?.oilChanges || [];
};

// ─── TIRE INFO ─────────────────────────────────────────────────────────────
export const updateTireInfo = async (vehicleId, tireInfo) => {
  await ensureLoaded();
  const idx = vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) return null;
  vehicles[idx].tireInfo = { ...(vehicles[idx].tireInfo || {}), ...tireInfo };
  vehicles[idx].updatedAt = new Date().toISOString();
  await persistVehicles();

  return vehicles[idx].tireInfo;};

// ─── FLUIDS ────────────────────────────────────────────────────────────────
export const updateFluids = async (vehicleId, fluids) => {
  await ensureLoaded();
  const idx = vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) return null;
  vehicles[idx].fluids = { ...(vehicles[idx].fluids || {}), ...fluids };
  vehicles[idx].updatedAt = new Date().toISOString();
  await persistVehicles();

  return vehicles[idx].fluids;};

// ─── FREQUENT PARTS ────────────────────────────────────────────────────────
export const addFrequentPart = async (vehicleId, part) => {
  await ensureLoaded();
  const idx = vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) return null;
  const record = {
    id: genId(),
    name: part.name || "",
    partNumber: part.partNumber || "",
    lastReplacedDate: part.lastReplacedDate || null,
    lastReplacedMileage: part.lastReplacedMileage || "",
    intervalMiles: part.intervalMiles || "",
    cost: part.cost || "",
    notes: part.notes || "",
    createdAt: new Date().toISOString(),
  };
  if (!vehicles[idx].frequentParts) vehicles[idx].frequentParts = [];
  vehicles[idx].frequentParts.push(record);
  vehicles[idx].updatedAt = new Date().toISOString();
  await persistVehicles();

  return record;};

export const updateFrequentPart = async (vehicleId, partId, updates) => {
  await ensureLoaded();
  const idx = vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) return null;
  const parts = vehicles[idx].frequentParts || [];
  const pi = parts.findIndex((p) => p.id === partId);
  if (pi < 0) return null;
  vehicles[idx].frequentParts[pi] = { ...parts[pi], ...updates };
  vehicles[idx].updatedAt = new Date().toISOString();
  await persistVehicles();

  return vehicles[idx].frequentParts[pi];};

export const deleteFrequentPart = async (vehicleId, partId) => {
  await ensureLoaded();
  const idx = vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) return;
  vehicles[idx].frequentParts = (vehicles[idx].frequentParts || []).filter((p) => p.id !== partId);
  await persistVehicles();
};

// ─── MAINTENANCE SCHEDULE ──────────────────────────────────────────────────
// Calculates next suggested maintenance, vehicle-specific.
// Intervals are calculated forward from the last known service mileage.
// If no data exists for a category, urgency = "no_data" (open for entry, no "overdue" label).

// Vehicle-specific recommended oil change intervals (miles)
const OIL_INTERVALS = {
  default: 5000,
  // Full-synthetic modern vehicles
  toyota: 10000, honda: 7500, hyundai: 7500, kia: 7500, subaru: 6000,
  ford: 7500, chevrolet: 7500, gmc: 7500, bmw: 10000, mercedes: 10000,
  audi: 10000, volkswagen: 10000, nissan: 5000, mazda: 7500, lexus: 10000,
};

const getOilInterval = (make) => {
  if (!make) return OIL_INTERVALS.default;
  return OIL_INTERVALS[make.toLowerCase()] || OIL_INTERVALS.default;
};

// ─── MANUFACTURER OIL SPECS ────────────────────────────────────────────────
// Oil weight recommendations by make, with mileage-based thresholds
// Each entry: { weight, mileageRange, notes }
const OIL_SPECS = {
  default: [
    { weight: "5W-30", mileageRange: "0 – 75,000 mi", notes: "Standard recommendation for most vehicles" },
    { weight: "5W-20", mileageRange: "0 – 75,000 mi", notes: "Fuel economy oriented" },
    { weight: "10W-30", mileageRange: "75,000+ mi", notes: "Higher viscosity for older engines" },
  ],
  toyota: [
    { weight: "0W-20", mileageRange: "0 – 100,000 mi", notes: "Factory fill, full synthetic" },
    { weight: "0W-16", mileageRange: "0 – 100,000 mi", notes: "Select newer models (Camry, Corolla 2020+)" },
    { weight: "5W-30", mileageRange: "100,000+ mi", notes: "Higher mileage engines" },
  ],
  honda: [
    { weight: "0W-20", mileageRange: "0 – 100,000 mi", notes: "Factory recommended, full synthetic" },
    { weight: "5W-20", mileageRange: "Older models / 100k+ mi", notes: "Pre-2012 or high-mileage" },
  ],
  ford: [
    { weight: "5W-20", mileageRange: "0 – 75,000 mi", notes: "Most EcoBoost & naturally aspirated" },
    { weight: "5W-30", mileageRange: "0 – 100,000 mi", notes: "Trucks, heavy tow packages" },
    { weight: "10W-30", mileageRange: "100,000+ mi", notes: "High-mileage option" },
  ],
  chevrolet: [
    { weight: "5W-30", mileageRange: "0 – 100,000 mi", notes: "V8 trucks and SUVs" },
    { weight: "0W-20", mileageRange: "0 – 100,000 mi", notes: "4-cyl and turbo 4-cyl" },
    { weight: "dexos1™ Gen 3", mileageRange: "All", notes: "GM-approved oil specification" },
  ],
  bmw: [
    { weight: "0W-30", mileageRange: "0 – 100,000 mi", notes: "LL-01 approved, full synthetic" },
    { weight: "5W-30", mileageRange: "100,000+ mi", notes: "Higher mileage, LL-01 required" },
  ],
  hyundai: [
    { weight: "5W-20", mileageRange: "0 – 75,000 mi", notes: "Most models" },
    { weight: "5W-30", mileageRange: "0 – 100,000 mi", notes: "Turbo engines" },
  ],
  nissan: [
    { weight: "0W-20", mileageRange: "0 – 75,000 mi", notes: "Most newer models" },
    { weight: "5W-30", mileageRange: "0 – 100,000 mi", notes: "Trucks, older models, VQ engines" },
  ],
  subaru: [
    { weight: "0W-20", mileageRange: "0 – 100,000 mi", notes: "Factory fill, full synthetic required" },
    { weight: "5W-30", mileageRange: "100,000+ mi", notes: "High mileage or turbo models" },
  ],
};

export const getOilSpecs = (make) => {
  if (!make) return OIL_SPECS.default;
  return OIL_SPECS[make.toLowerCase()] || OIL_SPECS.default;
};

// ─── FLUID CHANGE INTERVALS (miles) ───────────────────────────────────────
export const FLUID_INTERVALS = {
  coolant:            { interval: 30000,  label: "Coolant / Antifreeze" },
  brakeFluid:         { interval: 45000,  label: "Brake Fluid" },
  transmissionFluid:  { interval: 60000,  label: "Transmission Fluid" },
  powerSteering:      { interval: 75000,  label: "Power Steering Fluid" },
  differentialFluid:  { interval: 60000,  label: "Differential Fluid" },
  washerFluid:        { interval: 0,      label: "Washer Fluid (as needed)" },
};

// ─── MAINTENANCE LOGGING ──────────────────────────────────────────────────
// Log a maintenance item (tire rotation, brake inspection, air filter, etc.)
export const addMaintenanceRecord = async (vehicleId, record) => {
  await ensureLoaded();
  const idx = vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) return null;
  if (!vehicles[idx].maintenanceRecords) vehicles[idx].maintenanceRecords = [];
  const entry = {
    id: genId(),
    type: record.type || "general",       // oil_change, tire_rotation, brake_inspection, air_filter, etc.
    label: record.label || "",
    mileage: record.mileage || "",
    date: record.date || new Date().toISOString(),
    cost: record.cost || "",
    notes: record.notes || "",
    createdAt: new Date().toISOString(),
  };
  vehicles[idx].maintenanceRecords.unshift(entry);
  vehicles[idx].updatedAt = new Date().toISOString();
  if (record.mileage) vehicles[idx].mileage = record.mileage;
  await persistVehicles();

  return entry;};

export const getMaintenanceSuggestions = async (vehicleId) => {
  const v = vehicles.find((v) => v.id === vehicleId);
  if (!v) return [];

  const mileage = parseInt(v.mileage) || 0;
  const oilChanges = v.oilChanges || [];
  const lastOil = oilChanges[0];
  const oilInterval = getOilInterval(v.make);

  const suggestions = [];

  // ── Helper: determine urgency based on data availability ──
  // hasRecord: whether we have any data for this category
  // milesSince: miles since last service
  // intervalMiles: recommended interval
  // Returns "no_data" if no record (user hasn't entered info), "overdue" / "upcoming" / "good" otherwise
  const calcUrgency = (hasRecord, milesSince, intervalMiles) => {
    if (!hasRecord) return "no_data";
    if (milesSince >= intervalMiles) return "overdue";
    if (milesSince >= intervalMiles * 0.9) return "upcoming";
    return "good";
  };

  // ── Oil Change ──
  const lastOilMileage = parseInt(lastOil?.mileage) || 0;
  const milesSinceOil = lastOil ? (mileage - lastOilMileage) : 0;
  const nextOilAt = lastOil ? (lastOilMileage + oilInterval) : 0;
  const oilUrgency = calcUrgency(!!lastOil, milesSinceOil, oilInterval);
  suggestions.push({
    type: "oil_change",
    label: "Oil Change",
    urgency: oilUrgency,
    detail: lastOil
      ? `Last: ${lastOilMileage.toLocaleString()} mi · Next: ${nextOilAt.toLocaleString()} mi (every ${oilInterval.toLocaleString()} mi)`
      : "No oil change on record — log one to track intervals",
    intervalMiles: oilInterval,
    nextDueMileage: lastOil ? nextOilAt : null,
  });

  // Helper: find the most recent record for a type across maintenanceRecords and serviceRecords
  const mRecords = v.maintenanceRecords || [];
  const findLast = (type, srMatch) => {
    // Check maintenanceRecords first (explicit logs)
    const mRec = mRecords.find((r) => r.type === type);
    if (mRec) return { mileage: parseInt(mRec.mileage) || 0, found: true };
    // Fall back to service records
    const sRec = (v.serviceRecords || []).find(srMatch || (() => false));
    if (sRec) return { mileage: parseInt(sRec.vehicle?.mileage) || 0, found: true };
    return { mileage: 0, found: false };
  };

  // ── Tire Rotation — every 7,500 mi ──
  const lastRot = findLast("tire_rotation", (r) =>
    r.woTitle?.toLowerCase().includes("tire") && r.woTitle?.toLowerCase().includes("rotat"));
  const nextRotAt = lastRot.found ? (lastRot.mileage + 7500) : 0;
  const rotUrgency = calcUrgency(lastRot.found, lastRot.found ? (mileage - lastRot.mileage) : 0, 7500);
  suggestions.push({
    type: "tire_rotation",
    label: "Tire Rotation",
    urgency: rotUrgency,
    detail: lastRot.found
      ? `Last: ${lastRot.mileage.toLocaleString()} mi · Next: ${nextRotAt.toLocaleString()} mi`
      : "No rotation on record — tap to log one",
    intervalMiles: 7500,
    nextDueMileage: lastRot.found ? nextRotAt : null,
  });

  // ── Brake Inspection — every 20,000 mi ──
  const lastBrake = findLast("brake_inspection", (r) =>
    r.woTitle?.toLowerCase().includes("brake"));
  const nextBrakeAt = lastBrake.found ? (lastBrake.mileage + 20000) : 0;
  const brakeUrgency = calcUrgency(lastBrake.found, lastBrake.found ? (mileage - lastBrake.mileage) : 0, 20000);
  suggestions.push({
    type: "brake_inspection",
    label: "Brake Inspection",
    urgency: brakeUrgency,
    detail: lastBrake.found
      ? `Last: ${lastBrake.mileage.toLocaleString()} mi · Next: ${nextBrakeAt.toLocaleString()} mi`
      : "No brake service on record — tap to log",
    intervalMiles: 20000,
    nextDueMileage: lastBrake.found ? nextBrakeAt : null,
  });

  // ── Air Filter — every 15,000 mi ──
  const lastAF = findLast("air_filter");
  const lastAirFilter = (v.frequentParts || []).find((p) =>
    p.name?.toLowerCase().includes("air filter"));
  const afData = lastAF.found ? lastAF : (lastAirFilter ? { mileage: parseInt(lastAirFilter.lastReplacedMileage) || 0, found: true } : { mileage: 0, found: false });
  const nextAFAt = afData.found ? (afData.mileage + 15000) : 0;
  const afUrgency = calcUrgency(afData.found, afData.found ? (mileage - afData.mileage) : 0, 15000);
  suggestions.push({
    type: "air_filter",
    label: "Air Filter",
    urgency: afUrgency,
    detail: afData.found
      ? `Last: ${afData.mileage.toLocaleString()} mi · Next: ${nextAFAt.toLocaleString()} mi`
      : "No record of replacement — tap to log",
    intervalMiles: 15000,
    nextDueMileage: afData.found ? nextAFAt : null,
  });

  // ── Transmission Fluid — every 60,000 mi ──
  const lastTrans = findLast("transmission_fluid", (r) =>
    r.woTitle?.toLowerCase().includes("transmission") && r.woTitle?.toLowerCase().includes("fluid"));
  const nextTransAt = lastTrans.found ? (lastTrans.mileage + 60000) : 0;
  const transUrgency = calcUrgency(lastTrans.found, lastTrans.found ? (mileage - lastTrans.mileage) : 0, 60000);
  suggestions.push({
    type: "transmission_fluid",
    label: "Transmission Fluid",
    urgency: transUrgency,
    detail: lastTrans.found
      ? `Last: ${lastTrans.mileage.toLocaleString()} mi · Next: ${nextTransAt.toLocaleString()} mi`
      : "No transmission fluid change on record — tap to log",
    intervalMiles: 60000,
    nextDueMileage: lastTrans.found ? nextTransAt : null,
  });

  // ── Coolant Flush — every 30,000 mi ──
  const lastCoolant = findLast("coolant_flush", (r) =>
    r.woTitle?.toLowerCase().includes("coolant") || r.woTitle?.toLowerCase().includes("flush"));
  const nextCoolantAt = lastCoolant.found ? (lastCoolant.mileage + 30000) : 0;
  const coolantUrgency = calcUrgency(lastCoolant.found, lastCoolant.found ? (mileage - lastCoolant.mileage) : 0, 30000);
  suggestions.push({
    type: "coolant_flush",
    label: "Coolant Flush",
    urgency: coolantUrgency,
    detail: lastCoolant.found
      ? `Last: ${lastCoolant.mileage.toLocaleString()} mi · Next: ${nextCoolantAt.toLocaleString()} mi`
      : "No coolant flush on record — tap to log",
    intervalMiles: 30000,
    nextDueMileage: lastCoolant.found ? nextCoolantAt : null,
  });

  return suggestions;
};

// ─── REMINDERS ─────────────────────────────────────────────────────────────
export const addReminder = async (vehicleId, reminder) => {
  await ensureLoaded();
  const idx = vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) return null;
  const record = {
    id: genId(),
    type: reminder.type || "maintenance",        // maintenance, oil_change, custom
    label: reminder.label || "",
    dueMileage: reminder.dueMileage || "",
    dueDate: reminder.dueDate || "",
    notes: reminder.notes || "",
    dismissed: false,
    createdAt: new Date().toISOString(),
  };
  if (!vehicles[idx].reminders) vehicles[idx].reminders = [];
  vehicles[idx].reminders.push(record);
  vehicles[idx].updatedAt = new Date().toISOString();
  await persistVehicles();

  return record;};

export const getReminders = async (vehicleId) => {
  const v = vehicles.find((v) => v.id === vehicleId);
  return (v?.reminders || []).filter((r) => !r.dismissed);
};

export const getDueReminders = async () => {
  const allDue = [];
  for (const v of vehicles) {
    const reminders = (v.reminders || []).filter((r) => !r.dismissed);
    for (const r of reminders) {
      const mileage = parseInt(v.mileage) || 0;
      const dueMileage = parseInt(r.dueMileage) || Infinity;
      const dueDate = r.dueDate ? new Date(r.dueDate) : null;
      const isDue = mileage >= dueMileage || (dueDate && dueDate <= new Date());
      if (isDue) {
        allDue.push({ ...r, vehicle: v });
      }
    }
  }
  return allDue;
};

export const dismissReminder = async (vehicleId, reminderId) => {
  await ensureLoaded();
  const idx = vehicles.findIndex((v) => v.id === vehicleId);
  if (idx < 0) return;
  const ri = (vehicles[idx].reminders || []).findIndex((r) => r.id === reminderId);
  if (ri >= 0) vehicles[idx].reminders[ri].dismissed = true;
  await persistVehicles();
};

// ─── PRINTABLE SERVICE RECORD HTML ─────────────────────────────────────────
export const generatePrintableHTML = async (vehicleId) => {
  const v = vehicles.find((v) => v.id === vehicleId);
  if (!v) return "";

  const vLabel = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
  const mileage = v.mileage ? `${parseInt(v.mileage).toLocaleString()} miles` : "N/A";
  const records = v.serviceRecords || [];
  const oilChanges = v.oilChanges || [];
  const totalSpent = records.reduce((s, r) => s + (parseFloat(r.actualCost) || 0), 0);

  const fmtDate = (iso) => {
    if (!iso) return "N/A";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const recordRows = records.map((r) => {
    const parts = (r.workOrder?.parts || []).map(
      (p) => `<div class="part-row"><span>${p.name}${p.partNumber ? ' #' + p.partNumber : ''}</span><span>$${p.estimatedCost || 0}</span></div>`
    ).join("");
    const steps = (r.workOrder?.steps || []).map(
      (s, i) => `<div class="step">${i + 1}. ${s}</div>`
    ).join("");
    return `
      <div class="record">
        <div class="record-header">
          <div>
            <div class="record-title">${r.woTitle}</div>
            <div class="record-meta">${fmtDate(r.completedAt || r.createdAt)} · ${r.diagnosis?.severity?.toUpperCase() || 'N/A'} · ${r.completedAt ? 'COMPLETED' : 'OPEN'}</div>
          </div>
          <div class="record-cost">${r.actualCost ? '$' + r.actualCost : r.workOrder?.estimatedTotalCost ? '~$' + r.workOrder.estimatedTotalCost : ''}</div>
        </div>
        ${r.diagnosis?.summary ? '<div class="record-summary">' + r.diagnosis.summary + '</div>' : ''}
        ${parts ? '<div class="parts-label">Parts</div>' + parts : ''}
        ${steps ? '<div class="steps-label">Steps</div>' + steps : ''}
        ${r.notes ? '<div class="notes">' + r.notes + '</div>' : ''}
      </div>`;
  }).join("");

  const oilRows = oilChanges.map((o) =>
    `<tr><td>${fmtDate(o.date)}</td><td>${o.mileage ? parseInt(o.mileage).toLocaleString() + ' mi' : 'N/A'}</td><td>${o.oilWeight || ''} ${o.oilType || ''}</td><td>${o.filterBrand || ''}</td><td>${o.notes || ''}</td></tr>`
  ).join("");

  const tireInfo = v.tireInfo || {};

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${vLabel} — Service Record</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, sans-serif; color: #1a1a2e; background: #fff; padding: 40px; max-width: 900px; margin: 0 auto; }
  .header { border-bottom: 3px solid #f59e0b; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 28px; font-weight: 900; color: #0a0e1a; }
  .header .sub { font-size: 13px; color: #475569; margin-top: 4px; }
  .header .logo { font-size: 11px; color: #f59e0b; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-top: 8px; }
  .stats { display: flex; gap: 16px; margin-bottom: 24px; }
  .stat { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
  .stat .val { font-size: 22px; font-weight: 900; }
  .stat .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
  .section-title { font-size: 14px; font-weight: 800; color: #0a0e1a; text-transform: uppercase; letter-spacing: 1.5px; margin: 24px 0 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
  .record { border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 12px; overflow: hidden; }
  .record-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 14px; background: #f8fafc; }
  .record-title { font-size: 14px; font-weight: 800; }
  .record-meta { font-size: 11px; color: #64748b; margin-top: 2px; }
  .record-cost { font-size: 16px; font-weight: 900; color: #22c55e; }
  .record-summary { padding: 10px 14px; font-size: 12px; color: #475569; line-height: 1.6; border-top: 1px solid #f1f5f9; }
  .parts-label, .steps-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; padding: 8px 14px 4px; }
  .part-row { display: flex; justify-content: space-between; padding: 4px 14px; font-size: 12px; }
  .part-row span:last-child { font-weight: 700; color: #f59e0b; }
  .step { padding: 3px 14px; font-size: 11px; color: #334155; }
  .notes { padding: 8px 14px; font-size: 11px; color: #64748b; font-style: italic; border-top: 1px solid #f1f5f9; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f8fafc; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; padding: 8px 12px; text-align: left; border-bottom: 2px solid #e2e8f0; }
  td { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #f1f5f9; }
  .tire-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .tire-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .tire-box .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
  .tire-box .val { font-size: 14px; font-weight: 700; margin-top: 2px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 2px solid #f59e0b; text-align: center; font-size: 10px; color: #94a3b8; }
  @media print { body { padding: 20px; } .no-print { display: none; } }
</style></head><body>
<div class="header">
  <h1>${vLabel}</h1>
  <div class="sub">${mileage} · ${v.transmission || 'N/A'} · Service Record as of ${fmtDate(new Date().toISOString())}</div>
  <div class="logo">Mobile Master Mechanic — Powered by Angie's Auto Supplies</div>
</div>

<div class="stats">
  <div class="stat"><div class="val" style="color:#3b82f6">${records.length}</div><div class="lbl">Total Services</div></div>
  <div class="stat"><div class="val" style="color:#22c55e">${records.filter(r => r.completedAt).length}</div><div class="lbl">Completed</div></div>
  <div class="stat"><div class="val" style="color:#f59e0b">$${totalSpent}</div><div class="lbl">Total Spent</div></div>
</div>

${records.length > 0 ? '<div class="section-title">Service Records</div>' + recordRows : ''}

${oilChanges.length > 0 ? `<div class="section-title">Oil Change History</div>
<table><thead><tr><th>Date</th><th>Mileage</th><th>Oil</th><th>Filter</th><th>Notes</th></tr></thead><tbody>${oilRows}</tbody></table>` : ''}

${tireInfo.frontSize || tireInfo.rearSize ? `<div class="section-title">Tire Information</div>
<div class="tire-grid">
  <div class="tire-box"><div class="lbl">Front Tire Size</div><div class="val">${tireInfo.frontSize || 'N/A'}</div></div>
  <div class="tire-box"><div class="lbl">Rear Tire Size</div><div class="val">${tireInfo.rearSize || 'N/A'}</div></div>
  <div class="tire-box"><div class="lbl">Front Pressure</div><div class="val">${tireInfo.frontPressure ? tireInfo.frontPressure + ' PSI' : 'N/A'}</div></div>
  <div class="tire-box"><div class="lbl">Rear Pressure</div><div class="val">${tireInfo.rearPressure ? tireInfo.rearPressure + ' PSI' : 'N/A'}</div></div>
</div>` : ''}

<div class="footer">
  Generated by Mobile Master Mechanic · ${fmtDate(new Date().toISOString())} · mobilemastermechanic.com
</div>
</body></html>`;
};

// ─── HISTORY CONTEXT (for Hank's system prompt) ─────────────────────────────
// Returns a concise summary of past repairs for a given vehicle
export const getVehicleHistoryContext = async (vehicleId) => {
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  if (!vehicle || vehicle.serviceRecords.length === 0) return "";

  const records = vehicle.serviceRecords.slice(0, 10); // Last 10 repairs
  const lines = records.map((r) => {
    const date = r.completedAt
      ? new Date(r.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const cost = r.actualCost ? ` — $${r.actualCost} actual` : "";
    return `• ${date}: ${r.woTitle}${cost}`;
  });

  return `PREVIOUS REPAIRS ON THIS VEHICLE (${vehicle.year} ${vehicle.make} ${vehicle.model}):\n${lines.join("\n")}`;
};

// NOTE: A legacy dev seed vehicle ("veh-001": 2019 Toyota Camry) used to be
// hard-coded here and pushed into the in-memory store on every app load.
// Testers ended up seeing it as "someone else's car" in their garage. It has
// been removed; stripLegacySeed() in ensureLoaded() also wipes it from any
// user's local AsyncStorage on first load after upgrade.

// ─── RESET ───────────────────────────────────────────────────────────────────
// Wipes all in-memory garage data AND clears it from AsyncStorage.
export const resetAllData = async () => {
  vehicles = [];
  await saveJSON("garage_vehicles", []);
};


// ─── Restore (used by Trash screen) ─────────────────────────────────────────
export const restoreVehicle = async (vehicle) => {
  await ensureLoaded();
  vehicles.push({ ...vehicle, updatedAt: new Date().toISOString() });
  await persistVehicles();
  return vehicle;
};
