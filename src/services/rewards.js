// ─── REWARDS SERVICE ─────────────────────────────────────────────────────────
// Tracks earned rewards and level-up events.
// DEV MODE: stores in memory. Production: persists to Firestore user profile.

import { RANKS, RANK_REWARDS } from "../constants/theme";
import { loadJSON, saveJSON } from "./persist";

// In-memory store for dev
let earnedRewards = {};

let _rewardsLoaded = null;
const ensureLoaded = () => {
  if (!_rewardsLoaded) {
    _rewardsLoaded = loadJSON("rewards_earned", {}).then((r) => { earnedRewards = r; });
  }
  return _rewardsLoaded;
};
const persistRewards = () => saveJSON("rewards_earned", earnedRewards);
ensureLoaded();

export const getEarnedRewards = () => earnedRewards;

export const checkAndAwardLevelUp = (prevPoints, newPoints) => {
  // Returns reward data if the user crossed a new level threshold, else null
  for (const rank of RANKS) {
    if (prevPoints < rank.minPoints && newPoints >= rank.minPoints && rank.level > 1) {
      const reward = RANK_REWARDS[rank.level];
      if (reward) {
        earnedRewards[rank.level] = { ...reward, rank, earnedAt: new Date().toISOString() };
        persistRewards();
        return { rank, reward };
      }
    }
  }
  return null;
};

export const markRewardSeen = (level) => {
  if (earnedRewards[level]) {
    earnedRewards[level].seen = true;
    persistRewards();
  }
};

export const getAllEarnedRewards = () => {
  return Object.values(earnedRewards);
};



// ─── RESET ───────────────────────────────────────────────────────────────────
// Clears all earned rewards (memory + persisted storage).
export const resetAllData = async () => {
  earnedRewards = {};
  await saveJSON("rewards_earned", {});
};
