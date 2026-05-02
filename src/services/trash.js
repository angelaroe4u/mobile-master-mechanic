// ─── TRASH SERVICE ───────────────────────────────────────────────────────────
// Soft-delete with a 14-day grace period.
//
// All user-facing deletes route through here:
//   moveToTrash(type, item)   - pushes item into trash with a deletedAt timestamp
//   restoreFromTrash(type, id) - returns the item (caller re-adds to its store)
//   getTrash()                 - lists trashed items grouped by type
//   purgeExpired()             - removes items older than RETENTION_DAYS
//   emptyTrash(type?)          - permanently deletes one type or everything
//
// Storage shape (under persist key "trash"):
//   {
//     diagnoses: [{ ...item, deletedAt: ISO }],
//     vehicles:  [{ ...item, deletedAt: ISO }],
//   }
//
// Add new categories by adding keys to TYPES.

import { loadJSON, saveJSON } from "./persist";

const STORAGE_KEY = "trash";
const RETENTION_DAYS = 14;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

export const TYPES = {
  DIAGNOSIS: "diagnoses",
  VEHICLE: "vehicles",
};

const EMPTY_TRASH = { diagnoses: [], vehicles: [] };

let trash = { ...EMPTY_TRASH };
let _loaded = null;

const ensureLoaded = () => {
  if (!_loaded) {
    _loaded = loadJSON(STORAGE_KEY, EMPTY_TRASH).then((t) => {
      trash = { ...EMPTY_TRASH, ...t };
    });
  }
  return _loaded;
};

const persist = () => saveJSON(STORAGE_KEY, trash);

ensureLoaded();

// ─── Move-to-trash ──────────────────────────────────────────────────────────
// Caller passes the original item. We snapshot it and tag with deletedAt.
export const moveToTrash = async (type, item) => {
  await ensureLoaded();
  if (!trash[type]) trash[type] = [];
  // Avoid duplicate entries if user soft-deletes the same item twice
  trash[type] = trash[type].filter((t) => t.id !== item.id);
  trash[type].push({ ...item, deletedAt: new Date().toISOString() });
  await persist();
  return true;
};

// ─── Restore ────────────────────────────────────────────────────────────────
// Removes the item from trash and returns it. Caller is responsible for
// re-inserting into the appropriate live store.
export const restoreFromTrash = async (type, id) => {
  await ensureLoaded();
  const idx = (trash[type] || []).findIndex((t) => t.id === id);
  if (idx < 0) return null;
  const [item] = trash[type].splice(idx, 1);
  await persist();
  // Strip the deletedAt tag before returning
  const { deletedAt, ...clean } = item;
  return clean;
};

// ─── List trash ─────────────────────────────────────────────────────────────
export const getTrash = async () => {
  await ensureLoaded();
  // Return a deep copy with computed expiresAt + daysRemaining
  const now = Date.now();
  const decorate = (item) => {
    const deleted = new Date(item.deletedAt).getTime();
    const expires = deleted + RETENTION_MS;
    return {
      ...item,
      expiresAt: new Date(expires).toISOString(),
      daysRemaining: Math.max(0, Math.ceil((expires - now) / (24 * 60 * 60 * 1000))),
    };
  };
  return {
    diagnoses: (trash.diagnoses || []).map(decorate),
    vehicles: (trash.vehicles || []).map(decorate),
    totalCount: (trash.diagnoses?.length || 0) + (trash.vehicles?.length || 0),
  };
};

// ─── Purge expired (called on app start) ────────────────────────────────────
export const purgeExpired = async () => {
  await ensureLoaded();
  const now = Date.now();
  let purgedCount = 0;
  for (const type of Object.values(TYPES)) {
    const before = trash[type]?.length || 0;
    trash[type] = (trash[type] || []).filter((item) => {
      const deleted = new Date(item.deletedAt).getTime();
      return now - deleted < RETENTION_MS;
    });
    purgedCount += before - (trash[type]?.length || 0);
  }
  if (purgedCount > 0) {
    await persist();
    console.log(`[trash] auto-purged ${purgedCount} item(s) older than ${RETENTION_DAYS} days`);
  }
  return purgedCount;
};

// ─── Empty trash ────────────────────────────────────────────────────────────
// type=undefined → empty everything
// type=TYPES.DIAGNOSIS → empty just diagnoses
export const emptyTrash = async (type = null) => {
  await ensureLoaded();
  if (type) {
    trash[type] = [];
  } else {
    trash = { ...EMPTY_TRASH };
  }
  await persist();
};

// ─── Reset hook (for Reset App / Delete Account) ─────────────────────────────
export const resetAllData = async () => {
  trash = { ...EMPTY_TRASH };
  await saveJSON(STORAGE_KEY, EMPTY_TRASH);
};

export const RETENTION_DAYS_CONST = RETENTION_DAYS;
