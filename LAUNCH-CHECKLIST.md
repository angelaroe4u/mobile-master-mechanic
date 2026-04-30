# Mobile Master Mechanic — Launch Checklist

Last updated: 2026-04-29

---

## 0. What I just fixed

| File | Issue | Status |
|---|---|---|
| `eas.json` | Truncated mid-`"track":` — invalid JSON; would have failed `eas submit`. | ✅ Rewritten with valid JSON, Android `app-bundle`, track `internal`. |
| `app.json` | Pointed `icon`/`splash`/`adaptiveIcon` at `./src/assets/images/apicon.jpg` — directory was empty. | ✅ Fixed paths to PNG; `versionCode` removed (ignored under `appVersionSource: remote`). |
| `src/assets/images/` | Folder was empty. | ✅ Generated `icon.png` (1024²), `adaptive-icon.png` (1024²), `splash.png` (1242×2436), `favicon.png` (48²) from `public/images/apicon.jpg`. |
| `.easignore` | Missing exclusions caused 50MB+ tarball; Windows couldn't delete it before EAS errored with `EPERM rmdir`. | ✅ Aggressive exclusions; tarball now **~748KB**. |
| `eas.json` build profile | Only `autoIncrement: true` for production. | ✅ Added `android.buildType: app-bundle` (required for Play Store) and `ios.resourceClass: m-medium`. |

---

## 1. Build it (this should now Just Work)

From `C:\Projects\MobileMasterTech>`:

```cmd
eas build --platform android --profile production
```

Then once that's queued, in another terminal:

```cmd
eas build --platform ios --profile production
```

The first iOS build will prompt to set up an Apple ID / push provisioning. Have your Apple Developer account credentials ready.

---

## 2. If the EPERM error STILL hits (it shouldn't)

The tarball is now under 1 MB so Windows file deletion should beat any antivirus scan. If it doesn't:

```cmd
:: Nuclear option — kill any stale Node/Expo/Metro process holding file handles
taskkill /F /IM node.exe
taskkill /F /IM expo.exe
rmdir /s /q "C:\Users\angel\AppData\Local\Temp\eas-cli-nodejs"
eas build --platform android --profile production
```

Or fall back to a fully local build (no upload):

```cmd
eas build --platform android --profile production --local
```

(Needs ~10 GB free disk + Android SDK; takes ~30 min.)

---

## 3. SHIP-BLOCKERS (must do BEFORE you submit to stores)

These will let the build go green but will get the app **rejected** or shipped broken.

### A) DEV MODE in `App.js`
Currently `App.js` hardcodes:
```js
setUser({ uid: "dev-user-001", ... });
setHasSubscription(true);
setHasAcceptedTerms(true);
```
Anyone who installs the app skips Auth, Terms, and Subscribe screens. **You will not collect a single dollar.**

Replace with the real auth flow before the production build.

### B) Mocked services
Every file in `src/services/` (except `api.js`) is a mock:
- `firebase.js` — sign-in always returns the same user
- `firestore.js` — saves to in-memory array, lost on app close
- `garage.js` — vehicles vanish on app close
- `gamification.js` / `rewards.js` — points reset every launch
- `subscriptions.js` — RevenueCat not wired up; **users cannot pay**

Wire these to Supabase (you already have a project + edge function for Hank).

### C) Apple submit credentials
`eas.json` still has placeholders:
```
"ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
"appleTeamId": "YOUR_APPLE_TEAM_ID"
```
Get these from https://appstoreconnect.apple.com → My Apps → (your app) → App Information.

### D) Google Play service account
`eas.json` references `./google-play-service-account.json` — that file doesn't exist yet. Create one in Google Play Console → Setup → API access → Create service account, download the JSON, drop it in the project root. **Don't commit it** (it's in `.easignore`).

### E) Privacy policy + Terms URLs
Both stores require a public privacy policy URL. The text in `src/constants/legal.js` is fine for in-app, but you also need:
- A live URL (e.g., `https://angiesautosupplies.com/privacy`)
- A live Terms URL

### F) Strip non-app secrets from `.env`
Your `.env` contains `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` (a separate trading service). These do *not* get embedded in the bundle (only `EXPO_PUBLIC_*` vars do), but they DO get uploaded to EAS servers in the tarball. Move them to a different file or delete from `.env`.

---

## 4. Minor runtime bugs (non-blocking, worth fixing post-launch)

From the source audit:
- `DiagListScreen.js:94` — FlatList `keyExtractor` uses `item.id`; harden with fallback `item.id || idx.toString()`.
- `LeaderboardScreen.js` — currently unused (not in `AppNavigator.js`). Either wire it up or delete the file.
- `SuppliesHubScreen.js:139` — missing `key` prop on mapped parts list.
- `VehicleDetailScreen.js` — missing `key` prop on oil-change history map.
- `DiagResultScreen.js:715` — defensive null guard around `d?.workOrders?.[completeWOIndex]?.title` when modal is shown.

None will block the build or crash on first launch.

---

## 5. Store metadata you'll need

### Google Play Console
- App title (≤ 30 chars): `Mobile Master Mechanic`
- Short description (≤ 80 chars): _e.g. "Diagnose your car with Hank, your AI master tech."_
- Full description (≤ 4000 chars): write a real one — describe Hank, supplies hub, garage history, work orders.
- Feature graphic: 1024×500 PNG
- Phone screenshots: 2-8, min 320px, 16:9 to 9:16
- 7-inch tablet screenshots: optional but recommended
- Category: Auto & Vehicles
- Content rating: complete the questionnaire (no violence/gambling/etc. — should land at "Everyone")
- Target audience: 17+ (or 13+ depending on user research)
- Data safety form: declare what you collect (email, diagnosis history)
- Privacy policy URL

### App Store Connect
- App name (≤ 30 chars): `Mobile Master Mechanic`
- Subtitle (≤ 30): _e.g. "Your AI Master Mechanic"_
- Promotional text (≤ 170 chars)
- Description
- Keywords (≤ 100 chars, comma-separated)
- Support URL + Marketing URL (optional)
- App icon: pulled automatically from your `icon.png`
- Screenshots: 6.7" (iPhone 15 Pro Max), 6.1", and 12.9" iPad Pro
- Age rating questionnaire
- Export compliance: standard (no encryption beyond HTTPS)
- Pricing: free with IAP

---

## 6. Submit

After production builds finish (you'll get an email):

```cmd
eas submit --platform android --latest
eas submit --platform ios --latest
```

Both will use the credentials in `eas.json`. Android needs the service-account JSON in the project root; iOS will prompt you for App Store Connect credentials the first time.

---

## 7. Post-submit watch list

- **Apple review** typically responds in 24-48 hours. Common rejections for AI apps:
  - Missing disclaimer that AI advice isn't a replacement for a real mechanic.
  - Subscription auto-renewal language must be exact (Apple has a template).
- **Google review** is usually faster (2-24 hours). Watch for:
  - Permissions justification — they will ask why you need `READ_EXTERNAL_STORAGE`.
  - Target API level (must be 34+ as of 2025).

