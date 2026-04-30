# Supabase Backend — Mobile Master Mechanic

This folder holds the server-side code that keeps your Anthropic API key off of
customer phones. The app calls **our** server (`hank-chat`), and **our** server
calls Anthropic.

---

## One-time setup (do this once)

### 1. Create a Supabase project
Go to https://supabase.com → **New Project**.
- Project name: `mobile-master-mechanic`
- Database password: save it somewhere safe
- Region: closest to your users (US East is a safe default)

Once the project is created, grab two values from **Project Settings → API**:
- **Project URL** (looks like `https://xxxxx.supabase.co`)
- **anon public key** (long string starting with `eyJ...`)

Paste both into the app's `.env` file:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 2. Install the Supabase CLI
```bash
npm install -g supabase
supabase login
```
That will open a browser window — log in with the same account.

### 3. Link the CLI to your project
From the project root (`MobileMasterTech/`):
```bash
supabase link --project-ref <YOUR_PROJECT_REF>
```
Your project ref is the `xxxxx` part of the Supabase URL above.

### 4. Store the Anthropic API key as a secret
This is the key the server will use. It lives on Supabase's servers — never
in the app:
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...
```

> ⚠️ **Rotate the old key first.** The old `sk-ant-...` key that used to live
> in `.env` was shipped inside the app bundle, so treat it as compromised.
> Generate a fresh one at https://console.anthropic.com/settings/keys and
> revoke the old one.

### 5. Deploy the function
```bash
supabase functions deploy hank-chat --no-verify-jwt
```
The `--no-verify-jwt` flag lets the app call the function with just the anon
key. Once you wire up Supabase Auth in the app (sign-up / sign-in), drop that
flag so only logged-in users can call Hank.

---

## Testing the function

From your terminal:
```bash
curl -i -X POST "https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/hank-chat" \
  -H "Authorization: Bearer <YOUR_ANON_KEY>" \
  -H "apikey: <YOUR_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "system": "You are Hank, a friendly mechanic. Respond in JSON: {\"message\": string}.",
    "messages": [{"role": "user", "content": "Say hi."}]
  }'
```

You should get a 200 back with an Anthropic response body.

---

## Redeploying after changes

After editing `supabase/functions/hank-chat/index.ts`:
```bash
supabase functions deploy hank-chat --no-verify-jwt
```
Deploys are near-instant.

View live logs:
```bash
supabase functions logs hank-chat
```

---

## What this unblocks

✅ You can submit to the App Store and Google Play without leaking your
   Anthropic key.
✅ You can change/rotate the key later without pushing an app update.
✅ You can add per-user rate limits, usage tracking, and auth gating by
   editing `index.ts` and redeploying.
