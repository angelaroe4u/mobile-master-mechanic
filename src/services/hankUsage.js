// ─── HANK USAGE TRACKER ──────────────────────────────────────────────────────
// Tracks how much "free" Hank conversation a user has consumed before they
// hit the paywall, plus any bonus chat credits earned via rank rewards.
//
// Free trial allowance (per user, lifetime — until they subscribe):
//   • 2 user questions + 3 Hank replies in their first conversation, total
//   • After that single free session, every visit to Hank requires either
//     - an active subscription / day pass, or
//     - bonus chat credits (granted by rank rewards)
//
// Storage shape (key: "hank_usage"):
//   {
//     freeUsed: boolean,        // true once the first free session is exhausted
//     bonusChats: number,       // remaining bonus diagnoses from rank rewards
//     bonusPasses: number,      // remaining 24-hour passes from rank rewards
//     bonusUntilIso: string|null, // optional date — bonus subscription window
//     redeemed: { [code]: boolean }, // codes the user has already redeemed
//   }

import { loadJSON, saveJSON } from "./persist";

const STORAGE_KEY = "hank_usage";

export const FREE_QUESTIONS = 2;   // user messages in the first free session
export const FREE_REPLIES   = 3;   // Hank's replies in the first free session

const DEFAULT_STATE = {
  freeUsed: false,
  bonusChats: 0,
  bonusPasses: 0,
  bonusUntilIso: null,
  redeemed: {},
};

// In-memory cache for synchronous reads
let _state = { ...DEFAULT_STATE };
let _loaded = null;

const ensureLoaded = () => {
  if (!_loaded) {
    _loaded = loadJSON(STORAGE_KEY, DEFAULT_STATE).then((s) => {
      _state = { ...DEFAULT_STATE, ...s };
    });
  }
  return _loaded;
};
ensureLoaded();

const persist = () => saveJSON(STORAGE_KEY, _state);

// ─── READS ───────────────────────────────────────────────────────────────────

export const getUsageState = async () => {
  await ensureLoaded();
  return { ..._state };
};

// Synchronous snapshot — may be stale until ensureLoaded() resolves
export const getUsageStateSync = () => ({ ..._state });

// Whether a bonus subscription window is currently active
export const hasActiveBonusWindow = () => {
  if (!_state.bonusUntilIso) return false;
  return new Date(_state.bonusUntilIso).getTime() > Date.now();
};

// Aggregate "does the user have non-paid access to Hank right now?"
// (Bonus chats / passes / window — does NOT include real subscription, that's
// checked separately via subscriptions.js.)
export const hasBonusAccess = async () => {
  await ensureLoaded();
  return _state.bonusChats > 0 || _state.bonusPasses > 0 || hasActiveBonusWindow();
};

// ─── FREE-SESSION COUNTER ────────────────────────────────────────────────────

// Compute remaining free messages given the current transcript
// transcript = [{role: "user"|"assistant", content}]
export const computeRemaining = (transcript = []) => {
  const userMsgs   = transcript.filter((m) => m.role === "user").length;
  const hankReplies = transcript.filter((m) => m.role === "assistant").length;
  return {
    questionsLeft: Math.max(0, FREE_QUESTIONS - userMsgs),
    repliesLeft:   Math.max(0, FREE_REPLIES   - hankReplies),
    questionsUsed: userMsgs,
    repliesUsed:   hankReplies,
  };
};

// True once the free allowance is fully consumed
export const isFreeAllowanceConsumed = (transcript = []) => {
  const r = computeRemaining(transcript);
  return r.questionsLeft <= 0 && r.repliesLeft <= 0;
};

// Mark the user's one free session as used. Idempotent.
export const markFreeUsed = async () => {
  await ensureLoaded();
  if (_state.freeUsed) return;
  _state.freeUsed = true;
  await persist();
};

// ─── BONUS CREDITS (from rank rewards) ───────────────────────────────────────

// Grant N bonus diagnoses (can be used to bypass the paywall, one per session)
export const grantBonusChats = async (n) => {
  await ensureLoaded();
  _state.bonusChats = (_state.bonusChats || 0) + n;
  await persist();
};

// Grant N bonus 24-hour passes
export const grantBonusPasses = async (n) => {
  await ensureLoaded();
  _state.bonusPasses = (_state.bonusPasses || 0) + n;
  await persist();
};

// Grant a bonus subscription window of N months from now
export const grantBonusMonths = async (months) => {
  await ensureLoaded();
  const base = hasActiveBonusWindow() ? new Date(_state.bonusUntilIso) : new Date();
  base.setMonth(base.getMonth() + months);
  _state.bonusUntilIso = base.toISOString();
  await persist();
};

// Consume one bonus chat (called when user enters Hank without a paid sub
// but has a bonus credit). Returns true if a credit was consumed.
export const consumeBonusChat = async () => {
  await ensureLoaded();
  if (_state.bonusChats > 0) {
    _state.bonusChats -= 1;
    await persist();
    return true;
  }
  return false;
};

// Consume one bonus 24-hour pass — sets bonusUntilIso = now + 24h
export const consumeBonusPass = async () => {
  await ensureLoaded();
  if (_state.bonusPasses <= 0) return false;
  _state.bonusPasses -= 1;
  const until = new Date();
  until.setHours(until.getHours() + 24);
  // Extend the window if a longer one is already active
  if (hasActiveBonusWindow() && new Date(_state.bonusUntilIso) > until) {
    // keep existing
  } else {
    _state.bonusUntilIso = until.toISOString();
  }
  await persist();
  return true;
};

// ─── REDEMPTION TRACKING ─────────────────────────────────────────────────────

export const isRedeemed = (code) => !!_state.redeemed?.[code];

export const markRedeemed = async (code) => {
  await ensureLoaded();
  _state.redeemed = { ..._state.redeemed, [code]: true };
  await persist();
};

// ─── RESET ───────────────────────────────────────────────────────────────────

export const resetAllData = async () => {
  _state = { ...DEFAULT_STATE };
  await saveJSON(STORAGE_KEY, _state);
};
