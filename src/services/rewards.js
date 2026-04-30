// ─── REWARDS SERVICE ─────────────────────────────────────────────────────────
// Tracks earned rewards and level-up events.
// DEV MODE: stores in memory. Production: persists to Firestore user profile.

import { RANKS, RANK_REWARDS } from "../constants/theme";

// In-memory store for dev
let earnedRewards = {};

export const getEarnedRewards = () => earnedRewards;

export const checkAndAwardLevelUp = (prevPoints, newPoints) => {
  // Returns reward data if the user crossed a new level threshold, else null
  for (const rank of RANKS) {
    if (prevPoints < rank.minPoints && newPoints >= rank.minPoints && rank.level > 1) {
      const reward = RANK_REWARDS[rank.level];
      if (reward) {
        earnedRewards[rank.level] = { ...reward, rank, earnedAt: new Date().toISOString() };
        return { rank, reward };
      }
    }
  }
  return null;
};

export const markRewardSeen = (level) => {
  if (earnedRewards[level]) {
    earnedRewards[level].seen = true;
  }
};

export const getAllEarnedRewards = () => {
  return Object.values(earnedRewards);
};

// Seed some rewards in dev mode so Settings shows content
earnedRewards = {
  2: { ...RANK_REWARDS[2], rank: RANKS[1], earnedAt: "2026-04-10T12:00:00Z", seen: true },
};
