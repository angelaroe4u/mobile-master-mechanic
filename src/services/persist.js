// ─── PERSISTENCE HELPER ──────────────────────────────────────────────────────
// Uses expo-file-system to write JSON files in the app's document directory.
// expo-file-system is a hard requirement for any Expo app and is guaranteed
// to be linked. Each "key" maps to a separate JSON file under
// <documentDirectory>/mmm_v1/. clearAll() wipes the whole directory.

import * as FileSystem from "expo-file-system";

const DIR = (FileSystem.documentDirectory || "") + "mmm_v1/";

const fileFor = (key) => `${DIR}${key}.json`;

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
        console.warn("[persist] ensureDir failed:", e?.message ?? e);
      }
    })();
  }
  return _dirReady;
};
ensureDir();

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
    return { ok: true };
  } catch (e) {
    console.warn("[persist] save failed:", key, e?.message ?? e);
    return { ok: false, error: e?.message ?? String(e) };
  }
};

export const removeKey = async (key) => {
  try {
    await ensureDir();
    await FileSystem.deleteAsync(fileFor(key), { idempotent: true });
  } catch (_e) { /* ignore */ }
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

// ─── DIAGNOSTIC: surfaces the EXACT failure point ─────────────────────────
export const testStorage = async () => {
  const TEST_KEY = "_test_" + Date.now();
  const TEST_VALUE = { hello: "world", ts: Date.now() };

  // Step 1: confirm document directory is available
  if (!FileSystem.documentDirectory) {
    return { ok: false, error: "FileSystem.documentDirectory is undefined — expo-file-system native module not linked properly" };
  }

  // Step 2: try to write
  const writeResult = await saveJSON(TEST_KEY, TEST_VALUE);
  if (!writeResult.ok) {
    return { ok: false, error: `WRITE failed: ${writeResult.error}` };
  }

  // Step 3: verify the file actually exists on disk
  try {
    const info = await FileSystem.getInfoAsync(fileFor(TEST_KEY));
    if (!info.exists) {
      return { ok: false, error: "File doesn't exist after write — write silently dropped" };
    }
  } catch (e) {
    return { ok: false, error: `getInfoAsync after write threw: ${e?.message ?? e}` };
  }

  // Step 4: read back
  const read = await loadJSON(TEST_KEY, null);
  await removeKey(TEST_KEY);

  if (!read) return { ok: false, error: "Read returned null even though file exists on disk" };
  if (read.hello !== "world") return { ok: false, error: `Read wrong value: ${JSON.stringify(read)}` };

  return {
    ok: true,
    message: "Storage works! Wrote and read a test value.",
    location: DIR,
  };
};
