// ─── GAMIFICATION SERVICE (DEV MODE) ─────────────────────────────────────────
// Running with mock data for Expo Go development.
// Points accumulate in memory. Production: persists to Firestore user profile.

import { getCurrentUser } from "./firebase";
import { RANKS, POINTS as POINT_VALUES } from "../constants/theme";
import { checkAndAwardLevelUp } from "./rewards";
import { loadJSON, saveJSON } from "./persist";

export const POINTS = POINT_VALUES;

// In-memory point accumulator (start at 75 to match dev seed)
let totalPoints = 0;
let diagnosesCount = 0;

// Listeners that get notified when points change
const listeners = new Set();

let _gamificationLoaded = null;
const ensureLoaded = () => {
  if (!_gamificationLoaded) {
    _gamificationLoaded = loadJSON("gamification_stats", { totalPoints: 0, diagnosesCount: 0 }).then((d) => {
      totalPoints = d.totalPoints ?? 0;
      diagnosesCount = d.diagnosesCount ?? 0;
    });
  }
  return _gamificationLoaded;
};
const persistStats = () => saveJSON("gamification_stats", { totalPoints, diagnosesCount });
ensureLoaded();

export const onPointsChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const notifyListeners = (stats) => {
  listeners.forEach((fn) => fn(stats));
};

export const calculateRank = (points) => {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (points >= r.minPoints) rank = r;
  }
  return rank;
};

export const awardPoints = async (points) => {
  await ensureLoaded();
  const user = getCurrentUser();
  const prevPoints = totalPoints;
  totalPoints += points;
  console.log("[DEV] awardPoints:", points, "to", user?.uid, "| total:", totalPoints);

  // Check for rank-up reward (only awards at rank threshold crossings)
  const levelUpResult = checkAndAwardLevelUp(prevPoints, totalPoints);
  if (levelUpResult) {
    console.log("[DEV] RANK UP!", levelUpResult.rank.title, "— reward:", levelUpResult.reward.title);
  }

  // Notify all listeners so UI updates
  const stats = await getUserStats();
  notifyListeners(stats);

  await persistStats();
  return { newTotal: totalPoints, levelUp: levelUpResult };
};

export const getUserStats = async () => {
  await ensureLoaded();
  const rank = calculateRank(totalPoints);
  const nextRank = RANKS.find((r) => r.minPoints > totalPoints);
  return {
    points: totalPoints,
    rank,
    nextRank,
    diagnosesCount,
    progress: nextRank
      ? (totalPoints - rank.minPoints) / (nextRank.minPoints - rank.minPoints)
      : 1,
  };
};

export const incrementDiagCount = async () => { await ensureLoaded(); diagnosesCount++; await persistStats(); };

// ─── RESET ───────────────────────────────────────────────────────────────────
// Resets points and diagnosis count to zero. Notifies live listeners.
export const resetAllData = async () => {
  totalPoints = 0;
  diagnosesCount = 0;
  await saveJSON("gamification_stats", { totalPoints: 0, diagnosesCount: 0 });
  const stats = { points: 0, diagnosesCount: 0 };
  listeners.forEach((fn) => fn(stats));
};
