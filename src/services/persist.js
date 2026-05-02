// ─── PERSISTENCE HELPER ──────────────────────────────────────────────────────
// Uses expo-file-system to write JSON files in the app's document directory.
// We swapped from AsyncStorage to expo-file-system because async-storage's
// native module wasn't reliably linking in EAS production builds, causing
// silent save failures that looked like "data not persisting." File system
// is a hard requirement for any Expo app and is guaranteed to be linked.
//
// Each "key" maps to a separate JSON file under <documentDirectory>/mmm_v1/.
// clearAll() wipes the whole directory.

import * as FileSystem from "expo-file-system/legacy";

const DIR = FileSystem.documentDirectory + "mmm_v1/";

const fileFor = (key) => `${DIR}${key}.json`;

// Make sure the directory exists before any read/write attempt.
let _dirReady = null;
const ensureDir = () => {
  if (!_dirReady) {
    _dirReady = (async () => {
      try {
        const info = await FileSystem.getInfoAsync(DIR);
        if (!info.exists) {
          await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
        }
      } catch (e) {
        console.warn("[persist] makeDirectoryAsync failed:", e?.message ?? e);
      }
    })();
  }
  return _dirReady;
};
ensureDir();

// ─── LOAD / SAVE / DELETE ───────────────────────────────────────────────────

export const loadJSON = async (key, fallback) => {
  try {
    await ensureDir();
    const path = fileFor(key);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return fallback;
    const raw = await FileSystem.readAsStringAsync(path);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn("[persist] load failed:", key, e?.message ?? e);
    return fallback;
  }
};

export const saveJSON = async (key, value) => {
  try {
    await ensureDir();
    await FileSystem.writeAsStringAsync(fileFor(key), JSON.stringify(value));
  } catch (e) {
    console.warn("[persist] save failed:", key, e?.message ?? e);
  }
};

export const removeKey = async (key) => {
  try {
    await ensureDir();
    await FileSystem.deleteAsync(fileFor(key), { idempotent: true });
  } catch (_e) {
    /* ignore */
  }
};

export const clearAll = async () => {
  try {
    await ensureDir();
    const items = await FileSystem.readDirectoryAsync(DIR);
    await Promise.all(
      items.map((name) =>
        FileSystem.deleteAsync(DIR + name, { idempotent: true })
      )
    );
  } catch (e) {
    console.warn("[persist] clearAll failed:", e?.message ?? e);
  }
};

// ─── DEBUG / DIAGNOSTIC ─────────────────────────────────────────────────────
// Used by the "Test Storage" button in Settings to verify persistence works.
// Writes a value, reads it back, and returns a diagnostic result.

export const testStorage = async () => {
  const TEST_KEY = "_test_" + Date.now();
  const TEST_VALUE = { hello: "world", ts: Date.now() };
  try {
    await saveJSON(TEST_KEY, TEST_VALUE);
    const read = await loadJSON(TEST_KEY, null);
    await removeKey(TEST_KEY);
    if (!read) return { ok: false, error: "Read returned null after write" };
    if (read.hello !== "world") return { ok: false, error: "Read value didn't match what we wrote" };
    // Also report the storage location for sanity
    return {
      ok: true,
      message: "Storage works! Wrote and read a test value.",
      location: DIR,
    };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) };
  }
};
