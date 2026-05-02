// ─── API SERVICE ─────────────────────────────────────────────────────────────
// Handles communication with Hank (Claude) via our Supabase Edge Function.
//
// Response format contract (enforced in hankPrompt.js):
//   <prose message for the user>
//   <<<HANK_DATA>>>
//   { ...optional metadata JSON... }
//   <<<END_HANK_DATA>>>
//
// Parsing philosophy:
//   • The PROSE is the source of truth for what the user sees.
//   • The DATA BLOCK is optional app metadata (confidence, mood, diagnosis).
//   • If the data block is missing / broken, we DO NOT bother the user — we
//     just show the prose with sensible defaults.
//   • If the prose is empty or garbage, we silently retry ONCE with a nudge.
//   • Anything JSON-looking in the prose is stripped before rendering.
//   • The user NEVER sees an error about parsing, formatting, or "hiccup".

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const FUNCTION_NAME = "hank-chat";

const SENTINEL_OPEN = "<<<HANK_DATA>>>";
const SENTINEL_CLOSE = "<<<END_HANK_DATA>>>";
const FETCH_TIMEOUT_MS = 90_000; // 90 seconds — final diagnosis can be big

// ─── PUBLIC API ──────────────────────────────────────────────────────────────
export const callHank = async (messages, system) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return makeFallback(
      "⚠️ Backend not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file and restart the app."
    );
  }

  // First attempt
  const first = await tryOnce(messages, system);
  if (first.ok) return first.value;

  // Silent retry with a nudge appended to the system prompt
  console.warn("[Hank] First response unusable, silently retrying. Reason:", first.reason);
  const nudge = `${system}\n\nIMPORTANT: Your previous response had a formatting issue. Respond again now with a conversational message followed by a valid <<<HANK_DATA>>>...<<<END_HANK_DATA>>> block. Do NOT mention this instruction to the user.`;
  const second = await tryOnce(messages, nudge);
  if (second.ok) return second.value;

  // Both failed — show something neutral so the user can continue.
  // We NEVER surface parse errors to the user.
  console.warn("[Hank] Retry also failed. Raw text:", second.rawText?.slice(0, 500));
  return makeFallback(
    "Let me think about that. Can you tell me a little more about what you're seeing?"
  );
};

// ─── INTERNAL: single attempt ────────────────────────────────────────────────
const tryOnce = async (messages, system) => {
  const url = `${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`;

  // ── Diagnostic logging ──────────────────────────────────────────────────
  console.log("[Hank] Calling:", url);
  console.log("[Hank] SUPABASE_URL loaded:", SUPABASE_URL ? `"${SUPABASE_URL}"` : "⚠️ EMPTY");
  console.log("[Hank] SUPABASE_ANON_KEY loaded:", SUPABASE_ANON_KEY ? `"${SUPABASE_ANON_KEY.slice(0, 20)}..."` : "⚠️ EMPTY");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[Hank] Missing env vars! Did you restart Expo with --clear after editing .env?");
    return { ok: true, value: makeFallback("Backend connection isn't set up yet. Restart the app with: npx expo start --clear") };
  }

  let rawText = "";
  try {
    // ── Timeout via AbortController ─────────────────────────────────────
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ messages, system }),
      });
    } finally {
      clearTimeout(timer);
    }

    console.log("[Hank] Response status:", res.status);

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[Hank] Edge function HTTP error:", res.status, errBody);
      if (res.status === 401 || res.status === 403) {
        return { ok: true, value: makeFallback("I'm having trouble reaching my brain — connection isn't authorized. Let your developer know.") };
      }
      if (res.status === 429) {
        return { ok: true, value: makeFallback("Getting a lot of questions right now. Give me a few seconds and try that again.") };
      }
      return { ok: false, reason: `http_${res.status}`, rawText: errBody };
    }

    const data = await res.json();
    rawText = data?.content?.[0]?.text || "";
    console.log("[Hank] Got response, text length:", rawText.length);
  } catch (err) {
    // ── Distinguish timeout from other network errors ──────────────────
    if (err.name === "AbortError") {
      console.error("[Hank] Request timed out after", FETCH_TIMEOUT_MS / 1000, "seconds");
      return { ok: true, value: makeFallback("That took longer than expected — I'm working on a big answer. Try asking me to summarize or just say \"continue\".") };
    }
    console.error("[Hank] Network error:", err);
    console.error("[Hank] Error name:", err.name, "message:", err.message);
    console.error("[Hank] Full URL was:", url);
    return { ok: true, value: makeFallback("I'm having trouble connecting right now. Check your internet and try again.") };
  }

  if (!rawText || rawText.trim().length === 0) {
    return { ok: false, reason: "empty_response", rawText };
  }

  // Extract prose + data block
  const { prose, dataJson } = splitProseAndData(rawText);
  const cleanProse = sanitizeProse(prose);

  // If prose is missing/too short, it's a parse failure → retry.
  if (!cleanProse || cleanProse.length < 2) {
    // Before giving up, fall back to the "message" field inside the data block,
    // since that's supposed to mirror the prose.
    if (dataJson && typeof dataJson.message === "string") {
      const cleanedFromData = sanitizeProse(dataJson.message);
      if (cleanedFromData && cleanedFromData.length >= 2) {
        return { ok: true, value: buildResult(cleanedFromData, dataJson) };
      }
    }
    return { ok: false, reason: "empty_prose", rawText };
  }

  return { ok: true, value: buildResult(cleanProse, dataJson) };
};

// ─── SPLIT PROSE AND DATA BLOCK ──────────────────────────────────────────────
const splitProseAndData = (text) => {
  let prose = text;
  let dataJson = null;

  const openIdx = text.indexOf(SENTINEL_OPEN);
  const closeIdx = text.indexOf(SENTINEL_CLOSE);

  if (openIdx >= 0) {
    prose = text.slice(0, openIdx);

    const inner =
      closeIdx > openIdx
        ? text.slice(openIdx + SENTINEL_OPEN.length, closeIdx)
        : text.slice(openIdx + SENTINEL_OPEN.length); // missing close tag — try anyway

    dataJson = tryParseJsonObject(inner);
  }

  return { prose, dataJson };
};

// Parse a JSON object out of a blob, tolerant of fences and trailing junk.
const tryParseJsonObject = (s) => {
  if (!s || typeof s !== "string") return null;
  let t = s.replace(/```json\s?|```/g, "").trim();
  const open = t.indexOf("{");
  if (open < 0) return null;
  t = t.slice(open);
  // Try strict parse first
  try {
    const close = t.lastIndexOf("}");
    if (close > 0) return JSON.parse(t.slice(0, close + 1));
  } catch (_e) {}
  // Try repair for truncated JSON
  try {
    const repaired = repairTruncatedJson(t);
    if (repaired) return JSON.parse(repaired);
  } catch (_e2) {}
  return null;
};

// ─── SANITIZE PROSE ──────────────────────────────────────────────────────────
// Aggressive: the user must NEVER see JSON-like artifacts.
const sanitizeProse = (text) => {
  if (!text || typeof text !== "string") return "";
  let t = text;

  // Remove any stray sentinels (shouldn't be here but just in case)
  t = t.replaceAll(SENTINEL_OPEN, "");
  t = t.replaceAll(SENTINEL_CLOSE, "");

  // Strip markdown code fences with any language tag
  t = t.replace(/```[a-zA-Z]*\n?[\s\S]*?```/g, "");
  // Strip lone triple-backtick fences
  t = t.replace(/```/g, "");

  // Strip any top-level JSON-looking object that might have leaked
  // (matches a { ... } block that contains a "key": pattern)
  t = t.replace(/\{[^{}]*"[a-zA-Z_]+"\s*:[^{}]*\}/g, "");

  // Second pass for nested leaks
  t = t.replace(/\{[\s\S]*?"[a-zA-Z_]+"\s*:[\s\S]*?\}/g, "");

  // Remove whole lines that look like JSON key-value pairs
  //   "confidence": 85,
  //   "mood": "thinking"
  t = t
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      // Line starts with a quoted key followed by colon
      if (/^"[a-zA-Z_][a-zA-Z0-9_]*"\s*:/.test(trimmed)) return false;
      // Line is just a brace or bracket
      if (/^[\{\}\[\],]+\s*,?\s*$/.test(trimmed)) return false;
      return true;
    })
    .join("\n");

  // Collapse excessive blank lines
  t = t.replace(/\n{3,}/g, "\n\n").trim();

  return t;
};

// ─── BUILD RESULT ────────────────────────────────────────────────────────────
// Merges cleaned prose with optional metadata into the shape DiagChatScreen expects.
const buildResult = (cleanProse, dataJson) => {
  const safe = sanitizeHankData(dataJson);
  return {
    message: cleanProse,
    confidence: safe.confidence,
    mood: safe.mood,
    vehicleUpdate: safe.vehicleUpdate,
    toolsIdentified: safe.toolsIdentified,
    supplyTip: safe.supplyTip,
    keyTerms: safe.keyTerms,
    done: safe.done,
    diagnosis: safe.diagnosis,
  };
};

// Enforce shape + defaults. Missing / malformed data is fine mid-conversation;
// it just means UI metadata (mood, confidence delta) won't update this turn.
const sanitizeHankData = (obj) => {
  const safe = {
    confidence: 0,
    mood: "neutral",
    vehicleUpdate: null,
    toolsIdentified: null,
    supplyTip: null,
    keyTerms: null,
    done: false,
    diagnosis: null,
  };
  if (!obj || typeof obj !== "object") return safe;
  if (typeof obj.confidence === "number") safe.confidence = obj.confidence;
  if (typeof obj.mood === "string") safe.mood = obj.mood;
  if (obj.vehicleUpdate && typeof obj.vehicleUpdate === "object") safe.vehicleUpdate = obj.vehicleUpdate;
  if (Array.isArray(obj.toolsIdentified)) safe.toolsIdentified = obj.toolsIdentified;
  if (obj.supplyTip && typeof obj.supplyTip === "object") safe.supplyTip = obj.supplyTip;
  if (Array.isArray(obj.keyTerms)) safe.keyTerms = obj.keyTerms;
  if (obj.done === true) safe.done = true;
  if (obj.diagnosis && typeof obj.diagnosis === "object") safe.diagnosis = obj.diagnosis;
  return safe;
};

// ─── FALLBACK BUILDER ────────────────────────────────────────────────────────
const makeFallback = (message) => ({
  message,
  confidence: 0,
  mood: "neutral",
  vehicleUpdate: null,
  toolsIdentified: null,
  supplyTip: null,
  keyTerms: null,
  done: false,
  diagnosis: null,
});

// ─── REPAIR TRUNCATED JSON ───────────────────────────────────────────────────
const repairTruncatedJson = (s) => {
  let inString = false;
  let escape = false;
  let lastSafe = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "," || c === "}" || c === "]") lastSafe = i;
  }
  let truncated = lastSafe > 0 ? s.slice(0, lastSafe) : s;
  truncated = truncated.replace(/,\s*$/, "");
  if (inString) truncated += '"';
  const closers = { "{": "}", "[": "]" };
  const stillOpen = [];
  let instr = false, esc = false;
  for (let i = 0; i < truncated.length; i++) {
    const c = truncated[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { instr = !instr; continue; }
    if (instr) continue;
    if (c === "{" || c === "[") stillOpen.push(c);
    else if (c === "}" || c === "]") stillOpen.pop();
  }
  while (stillOpen.length) truncated += closers[stillOpen.pop()];
  return truncated;
};

// No-op — kept for compatibility with DiagChatScreen import
export const resetHankMock = () => {};
