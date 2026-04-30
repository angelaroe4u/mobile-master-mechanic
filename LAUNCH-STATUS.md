# Mobile Master Mechanic — Launch Status

**Last updated:** April 14, 2026
**Owner:** Angela Roe (angelaroe4u@gmail.com)
**Business entity:** Angie's Auto Supplies Inc.
**Project folder:** `C:\Projects\MobileMasterTech`

> **How to use this file:** If a Cowork chat ever resets, open a new session,
> attach this file, and say *"Read LAUNCH-STATUS.md and pick up where we left
> off."* Claude will have full context in seconds.

---

## 🎯 Mission
Ship **Mobile Master Mechanic** — a React Native/Expo consumer app with
AI-powered diagnostics via "Hank" (Claude) — to both the Apple App Store and
Google Play Store.

---

## ✅ DONE

### Backend
- Supabase project created
  - **Project ref:** `hlibjuiktraynkrgqsuw`
  - **URL:** `https://hlibjuiktraynkrgqsuw.supabase.co`
  - **Data API:** enabled
  - **Automatic RLS:** enabled
- Anthropic API key stored as Supabase secret (`ANTHROPIC_API_KEY`)
- Edge Function `hank-chat` deployed — proxies all Claude calls server-side
- `.env` updated with Supabase URL + publishable key (no more raw Anthropic key in client)
- Supabase CLI installed on Angela's Windows machine via Scoop, logged in, project linked

### Client code
- `src/services/api.js` — rewritten to call the Edge Function instead of Anthropic directly
- `src/services/api.js` — bulletproof prose/JSON splitter with sentinel tags, sanitizer, and silent retry (no parsing errors ever shown to user)
- `src/constants/hankPrompt.js` — enforces `<<<HANK_DATA>>>...<<<END_HANK_DATA>>>` output contract with explicit correct/incorrect examples
- `supabase/functions/hank-chat/index.ts` — server-side proxy; `max_tokens: 8192`
- `supabase/README.md` — step-by-step setup guide (for reference / future devs)
- Chat bubbles are copy-pasteable (long-press → Copy) via `selectable` prop on `<Text>`

### Previously fixed bugs (earlier in project)
- Gamification rank advances on work order completion
- Rewards fire only at rank thresholds
- Jobs tab defaults to open work orders (not "all")
- Parts tab routes to same tracker as home screen
- SuppliesHub updates when parts are checked off or WO closes
- Non-serializable Date warning (converted mock `startedAt` to ISO strings)
- Crash on clicking mock Toyota Camry (fleshed out mock diag-001, added defensive defaults)
- Hooks rule violation fix
- Maintenance items + oil specs persistence
- Work order state persistence
- "Accept as Is" button + completion confirmation modal

### Accounts / legal
- **Google Play Developer account** — created under Angie's Auto Supplies Inc. (organization), verifying
- **Apple Developer account** — enrollment submitted under Angie's Auto Supplies Inc., reviewing
- **D-U-N-S number** — ✅ obtained
- **Expo account** — exists

---

## ❌ STILL TO DO (in order of priority)

### 1. Database schema + migrate mock services (BIGGEST CHUNK — 3–7 days)
Current state: `firestore.js`, `garage.js`, `gamification.js`, `rewards.js`, `subscriptions.js` all use in-memory mocks. Data evaporates on app close. Stores will reject this; customers will rage-quit.

**Tables to design + create in Supabase:**
- `profiles` — user info (links to Supabase Auth)
- `vehicles` — user's garage
- `work_orders` — repair jobs (with status: open/completed/archived)
- `parts` — line items on work orders (with status: ordered/arrived)
- `diagnoses` — Hank conversation sessions
- `maintenance_items` — recurring maintenance per vehicle
- `user_stats` — points, rank, achievements
- `subscriptions` — tier, status, expiry

**RLS policies:** Every table must restrict reads/writes to `auth.uid() = user_id`.

### 2. User authentication
- Wire up Supabase Auth (email/password minimum; Apple Sign-In required by Apple for iOS)
- Sign-up, login, password reset, logout screens
- Gate the app behind auth
- Profile creation on first sign-up

### 3. Subscription billing
- Pick platform: **RevenueCat** (recommended — handles both stores, easier) or native IAP
- Set up products in App Store Connect + Google Play Console
- Wire up paywall + subscription status check
- Respect subscription state in-app (free vs. paid features)

### 4. Store listing assets
- **App icon** — 1024×1024 PNG (no transparency, no rounded corners — stores round them)
- **Screenshots** — 2–8 per store
  - iPhone: 6.7" (1290×2796) and optionally 6.5"
  - Android: phone + 7" and 10" tablet
- **Feature graphic** (Google only) — 1024×500 PNG
- **Short description** — ≤80 chars
- **Full description** — ≤4000 chars
- **Privacy policy** — live URL (`mobilemastermechanic.com/privacy`)
- **Terms of service** — live URL
- **Support URL** — live URL for customer contact
- **Age rating questionnaire** — both stores
- **Content rating** (IARC) — Google

### 5. EAS build + beta testing
- Fill in `eas.json` placeholders: `YOUR_EAS_PROJECT_ID`, `YOUR_APPLE_TEAM_ID`, `YOUR_APP_STORE_CONNECT_APP_ID`
- Generate + upload `google-play-service-account.json`
- Run `eas build --platform all --profile production`
- Submit to **TestFlight** (Apple) and **Internal Testing** (Google)
- Test on real devices — NOT just Expo Go
- Get 3–5 real users to run through it

### 6. Submit to stores
- Apple review: 1–3 days typical
- Google review: a few hours to 1 day typical
- Respond to any rejections

---

## 📅 Realistic timeline

From April 14, 2026:
- Backend migration + auth + billing → **3–7 days**
- Store assets + privacy/TOS pages → **1–2 days**
- EAS build + TestFlight beta → **1–2 days**
- Store review → up to **1 week**

**Earliest realistic launch: ~April 28 – May 5, 2026.**

---

## 🔐 Credentials & references

| Item | Value / Location |
|---|---|
| Supabase project ref | `hlibjuiktraynkrgqsuw` |
| Supabase URL | `https://hlibjuiktraynkrgqsuw.supabase.co` |
| Supabase publishable key | in `.env` as `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| Supabase secret key | **NEVER commit this** — in Supabase dashboard only |
| Anthropic API key | stored as Supabase secret `ANTHROPIC_API_KEY` |
| Supabase DB password | saved in Angela's password manager |
| Google Play account | under Angie's Auto Supplies Inc. |
| Apple Developer account | under Angie's Auto Supplies Inc. (D-U-N-S on file) |

---

## 🧭 Pick-up prompts for future sessions

If starting a fresh chat, paste one of these:

- **General resume:** *"Read LAUNCH-STATUS.md and tell me the next thing to do."*
- **Start backend migration:** *"I want to start the database migration today. Read LAUNCH-STATUS.md and design the Supabase schema."*
- **Start store assets:** *"I want to work on store listing assets today. Read LAUNCH-STATUS.md and give me a checklist."*
- **Test the backend:** *"Read LAUNCH-STATUS.md. The Hank edge function is deployed — help me test it end-to-end in Expo Go."*

---

## 📎 Key file paths (for quick reference)

- App entry: `App.js`
- Hank API client: `src/services/api.js`
- Hank prompt: `src/constants/hankPrompt.js`
- Chat screen: `src/screens/DiagChatScreen.js`
- Mock services (to migrate): `src/services/{firestore,garage,gamification,rewards,subscriptions}.js`
- Supabase function: `supabase/functions/hank-chat/index.ts`
- Supabase setup guide: `supabase/README.md`
- Launch guide doc: `Mobile-Master-Mechanic-Launch-Guide.docx`
- Env config: `.env`
- EAS config: `eas.json`
- Navigation: `src/navigation/AppNavigator.js`
