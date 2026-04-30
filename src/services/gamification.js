// ─── GAMIFICATION SERVICE (DEV MODE) ─────────────────────────────────────────
// Running with mock data for Expo Go development.
// Points accumulate in memory. Production: persists to Firestore user profile.

import { getCurrentUser } from "./firebase";
import { RANKS, POINTS as POINT_VALUES } from "../constants/theme";
import { checkAndAwardLevelUp } from "./rewards";

export const POINTS = POINT_VALUES;

// In-memory point accumulator (start at 75 to match dev seed)
let totalPoints = 75;
let diagnosesCount = 3;

// Listeners that get notified when points change
const listeners = new Set();

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

  return { newTotal: totalPoints, levelUp: levelUpResult };
};

export const getUserStats = async () => {
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

export const incrementDiagCount = () => { diagnosesCount++; };
