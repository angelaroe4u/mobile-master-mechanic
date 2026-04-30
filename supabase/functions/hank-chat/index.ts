// ─── HANK CHAT EDGE FUNCTION ─────────────────────────────────────────────────
// Supabase Edge Function that proxies calls from the Mobile Master Mechanic
// app to the Anthropic Messages API.
//
// Why this exists:
//   The Anthropic API key must NEVER be shipped in the mobile app bundle. This
//   function lives on Supabase's servers, holds the key as a secret, and lets
//   the app call Hank without ever seeing the key.
//
// Deploy:
//   1. Install Supabase CLI: npm i -g supabase
//   2. Log in:               supabase login
//   3. Link project:         supabase link --project-ref <YOUR_PROJECT_REF>
//   4. Set the secret:       supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   5. Deploy:               supabase functions deploy hank-chat --no-verify-jwt
//      (remove --no-verify-jwt once you wire up Supabase Auth in the app)
//
// ─────────────────────────────────────────────────────────────────────────────

// deno-lint-ignore-file no-explicit-any
// @ts-ignore Deno runtime
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8192;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // ─── CORS preflight ────────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ─── Load API key from secrets ─────────────────────────────────────────────
  // @ts-ignore Deno runtime
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set in Supabase secrets");
    return json({ error: "Server misconfigured: missing API key" }, 500);
  }

  // ─── Parse request body ────────────────────────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch (_err) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { messages, system, model } = body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "`messages` must be a non-empty array" }, 400);
  }
  if (typeof system !== "string") {
    return json({ error: "`system` must be a string" }, 400);
  }

  // ─── Call Anthropic ────────────────────────────────────────────────────────
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages,
      }),
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("Anthropic error:", res.status, text);
      // Surface status codes so the client can show friendly messages
      return json({ error: "Anthropic API error", status: res.status, detail: text }, res.status);
    }

    // Pass the Anthropic JSON body back to the client verbatim
    return new Response(text, {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return json({ error: "Upstream request failed" }, 502);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
