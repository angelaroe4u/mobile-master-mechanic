// ─── REWARDS SERVICE ─────────────────────────────────────────────────────────
// Tracks earned rewards and level-up events.
// DEV MODE: stores in memory. Production: persists to Firestore user profile.

import { RANKS, RANK_REWARDS } from "../constants/theme";
import { loadJSON, saveJSON } from "./persist";
import { grantBonusChats, grantBonusPasses, grantBonusMonths } from "./hankUsage";

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

// Auto-apply in-app bonus rewards (chats / passes / months). Shopify codes
// and share links don't auto-apply — the user has to do something with them
// (copy the code, share the link).
const autoApplyReward = async (reward) => {
  if (!reward) return;
  try {
    if (reward.type === "bonus_chats"  && reward.value) await grantBonusChats(reward.value);
    if (reward.type === "bonus_passes" && reward.value) await grantBonusPasses(reward.value);
    if (reward.type === "bonus_months" && reward.value) await grantBonusMonths(reward.value);
  } catch (e) {
    console.warn("[rewards] autoApplyReward failed:", e?.message ?? e);
  }
};

export const checkAndAwardLevelUp = (prevPoints, newPoints) => {
  // Returns reward data if the user crossed a new level threshold, else null
  for (const rank of RANKS) {
    if (prevPoints < rank.minPoints && newPoints >= rank.minPoints && rank.level > 1) {
      const reward = RANK_REWARDS[rank.level];
      if (reward) {
        earnedRewards[rank.level] = { ...reward, rank, earnedAt: new Date().toISOString() };
        persistRewards();
        // Fire-and-forget — bonus chats/passes/months are auto-applied here
        autoApplyReward(reward);
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
