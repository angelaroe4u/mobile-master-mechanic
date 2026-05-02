// ─── PERSISTENCE HELPER ──────────────────────────────────────────────────────
// Wraps AsyncStorage with a JSON loader/saver and a namespaced prefix.
// All app data uses keys prefixed with "mmm_v1_" so we can wipe everything in
// one shot via clearAll() during Reset App / Delete Account.

import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "mmm_v1_";

export const loadJSON = async (key, fallback) => {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn("[persist] load failed:", key, e?.message ?? e);
    return fallback;
  }
};

export const saveJSON = async (key, value) => {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn("[persist] save failed:", key, e?.message ?? e);
  }
};

export const removeKey = async (key) => {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch (_e) {
    /* ignore */
  }
};

export const clearAll = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch (e) {
    console.warn("[persist] clearAll failed:", e?.message ?? e);
  }
};
