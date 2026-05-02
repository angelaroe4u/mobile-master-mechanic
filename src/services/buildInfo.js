// ─── BUILD INFO ──────────────────────────────────────────────────────────────
// Exposes the native build version (auto-incremented by EAS each release)
// and tracks when the user first opened each new build, so Settings can show
// both "Build" and "Last updated" without any backend.

import * as Application from "expo-application";
import { loadJSON, saveJSON } from "./persist";

const KEY = "build_history";

export const getCurrentBuild = () => ({
  version: Application.nativeApplicationVersion || "1.0.0",   // marketing version e.g. 1.0.0
  build: Application.nativeBuildVersion || "?",                 // versionCode e.g. 24
});

// Called once on app start. If the build is new (different from what we
// last saw), record an "updatedAt" timestamp. Returns the lastUpdated ISO.
export const recordBuildIfNew = async () => {
  const current = getCurrentBuild();
  const history = await loadJSON(KEY, { lastBuild: null, lastUpdatedAt: null });

  if (history.lastBuild !== current.build) {
    const updated = {
      lastBuild: current.build,
      lastUpdatedAt: new Date().toISOString(),
    };
    await saveJSON(KEY, updated);
    return updated.lastUpdatedAt;
  }
  return history.lastUpdatedAt;
};

export const getLastUpdated = async () => {
  const history = await loadJSON(KEY, { lastUpdatedAt: null });
  return history.lastUpdatedAt;
};
