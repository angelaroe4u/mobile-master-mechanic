# Mobile Master Mechanic — Build & Deploy Guide

**Powered by Angie's Auto Supplies**

This guide walks you through every step from your local dev environment to live on the App Store and Google Play.

---

## Phase 1: Local Development Setup

### 1.1 Install Prerequisites

On your Windows machine, open PowerShell or Command Prompt:

```bash
# Install Node.js (v18+) from https://nodejs.org
# Then install Expo CLI and EAS CLI globally:
npm install -g expo-cli eas-cli

# Verify installations:
node --version
npx expo --version
eas --version
```

### 1.2 Initialize the Project

```bash
# Navigate to your project folder
cd C:\Users\angel\OneDrive\Desktop\MobileMasterMechanic

# Install all dependencies
npm install

# Copy your images from the public/images folder into the src/assets/images folder:
# Copy all files from: C:\Users\angel\OneDrive\Desktop\MobileMasterTech\public\images\
# Into: MobileMasterMechanic\src\assets\images\
```

### 1.3 Test Locally

```bash
# Start the development server
npx expo start

# Options:
# Press 'i' for iOS simulator (Mac only)
# Press 'a' for Android emulator
# Scan the QR code with Expo Go app on your phone
```

---

## Phase 2: Firebase Setup

### 2.1 Create Firebase Project

1. Go to **https://console.firebase.google.com**
2. Click "Create a project" → name it **MobileMasterMechanic**
3. Enable Google Analytics when prompted
4. Once created, you'll see the project dashboard

### 2.2 Enable Authentication

1. In Firebase Console → **Authentication** → **Get Started**
2. Enable **Email/Password** provider
3. Optionally enable **Google Sign-In** (requires extra config)

### 2.3 Enable Cloud Firestore

1. Go to **Firestore Database** → **Create Database**
2. Start in **test mode** (we'll add security rules later)
3. Choose a region close to your users (e.g., `us-central1`)

### 2.4 Add Apps

**For iOS:**
1. Click the iOS icon in Project Overview
2. Bundle ID: `com.angiesautosupplies.mobilemastermechanic`
3. Download `GoogleService-Info.plist`
4. Place it in your project root: `MobileMasterMechanic/GoogleService-Info.plist`

**For Android:**
1. Click the Android icon
2. Package name: `com.angiesautosupplies.mobilemastermechanic`
3. Download `google-services.json`
4. Place it in your project root: `MobileMasterMechanic/google-services.json`

### 2.5 Deploy Firestore Security Rules

In Firebase Console → Firestore → Rules, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /diagnoses/{diagId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    match /feedback/{docId} {
      allow create: if request.auth != null;
    }
    match /bugReports/{docId} {
      allow create: if request.auth != null;
    }
  }
}
```

---

## Phase 3: Backend API Server

Your app calls Claude AI for diagnostics. **Never expose your Anthropic API key in the app.** Set up a simple backend:

### 3.1 Create a Backend Server

Create a new folder `server/` and add `server.js`:

```javascript
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(require('./firebase-service-account.json'))
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Middleware: verify Firebase auth token
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Diagnosis endpoint
app.post('/api/diagnose', authenticate, async (req, res) => {
  try {
    const { model, max_tokens, system, messages } = req.body;
    const response = await anthropic.messages.create({
      model, max_tokens, system, messages,
    });
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log('MMM API server running');
});
```

### 3.2 Deploy the Backend

**Option A: Deploy to Railway (easiest)**
1. Go to https://railway.app → Sign up
2. Connect your GitHub repo
3. Add environment variable: `ANTHROPIC_API_KEY=your-key-here`
4. Railway gives you a URL like `https://your-app.railway.app`
5. Update `src/services/api.js` with this URL

**Option B: Deploy to Google Cloud Run, AWS, or Vercel**

---

## Phase 4: RevenueCat Setup (In-App Purchases)

### 4.1 Create RevenueCat Account

1. Go to **https://app.revenuecat.com** → Sign up
2. Create a new project: **MobileMasterMechanic**

### 4.2 Create Products (after App Store accounts are set up)

**In App Store Connect:**
1. Go to your app → Subscriptions
2. Create subscription group: "Mobile Master Mechanic"
3. Add product: `com.angiesautosupplies.mmm.monthly` — $19.99/month
4. Add non-renewing subscription: `com.angiesautosupplies.mmm.daypass` — $4.99

**In Google Play Console:**
1. Go to your app → Monetization → Products → Subscriptions
2. Create matching products with the same IDs

### 4.3 Connect to RevenueCat

1. In RevenueCat Dashboard → **Apps** → Add your iOS and Android apps
2. Add App Store Connect API key (for iOS)
3. Add Google Play service credentials (for Android)
4. Create **Entitlement**: `pro_access`
5. Create **Offering**: `default` with both products
6. Copy your **API keys** (one for iOS, one for Android)
7. Update `src/services/subscriptions.js` with your keys

---

## Phase 5: Apple Developer Account

### 5.1 Enroll

1. Go to **https://developer.apple.com/programs/**
2. Click "Enroll" → Sign in with your Apple ID
3. Pay **$99/year** annual fee
4. Enrollment takes 24-48 hours to process

### 5.2 Create App ID

1. Go to **Certificates, Identifiers & Profiles**
2. **Identifiers** → Click "+" → **App IDs**
3. Bundle ID: `com.angiesautosupplies.mobilemastermechanic`
4. Enable capabilities: Push Notifications, In-App Purchase

### 5.3 Create App in App Store Connect

1. Go to **https://appstoreconnect.apple.com**
2. **My Apps** → "+" → **New App**
3. Fill in:
   - Platform: iOS
   - Name: **Mobile Master Mechanic**
   - Primary Language: English (U.S.)
   - Bundle ID: select the one you created
   - SKU: `mobilemastermechanic`

### 5.4 App Store Listing

Prepare these assets:
- **App Icon**: 1024x1024 PNG (use your appicon.png, scaled up)
- **Screenshots**: iPhone 6.7" (1290x2796), iPhone 6.5" (1284x2778), iPad 12.9" (2048x2732)
- **App Description**: See below
- **Keywords**: mechanic, diagnostic, car repair, auto, AI, OBD2, vehicle
- **Support URL**: https://mobilemastermechanic.com/support
- **Privacy Policy URL**: https://mobilemastermechanic.com/privacy

**Suggested App Description:**
```
Mobile Master Mechanic puts a master mechanic in your pocket. Meet Hank — your AI diagnostic expert with 40+ years of experience across every make and model.

DIAGNOSE LIKE A PRO
• Describe your symptoms and Hank asks the right questions
• Get professional-grade diagnoses with confidence ratings
• Receive detailed work orders with parts lists and repair steps

FIND PARTS FAST
• Search 6+ major parts retailers instantly
• Get estimated costs for every repair
• Professional supplies from carlotsupplies.com

TRACK YOUR WORK
• Save diagnoses and repair history
• Mark work orders complete
• Share diagnoses with friends and fellow mechanics

LEVEL UP
• Earn points for completed diagnoses and repairs
• Progress through 10 ranks from Lube Tech to Master Technician
• Compete on the leaderboard

FIRST DIAGNOSIS FREE — Try Hank for yourself, then subscribe for unlimited access.

Powered by Angie's Auto Supplies.
```

---

## Phase 6: Google Play Developer Account

### 6.1 Enroll

1. Go to **https://play.google.com/console/**
2. Create a developer account
3. Pay **$25 one-time fee**
4. Complete identity verification

### 6.2 Create App

1. Click **Create app**
2. App name: **Mobile Master Mechanic**
3. Default language: English (United States)
4. App: not a game
5. Free

### 6.3 Store Listing

- **Short description** (80 chars): "AI mechanic in your pocket. Diagnose any car problem like a pro."
- **Full description**: Use the same text as the App Store listing
- **Graphics**: Feature graphic (1024x500), Screenshots, App icon (512x512)
- **Content rating**: Complete the content rating questionnaire
- **Privacy policy**: Link to your privacy policy page

---

## Phase 7: Build & Submit

### 7.1 Link to EAS

```bash
# Login to your Expo account
eas login

# Link your project
eas init --id YOUR_EAS_PROJECT_ID

# Update eas.json with your Apple and Google credentials
```

### 7.2 Build for iOS

```bash
# Development build (for testing)
eas build --platform ios --profile development

# Production build (for App Store)
eas build --platform ios --profile production
```

EAS will ask for your Apple Developer credentials on first build.

### 7.3 Build for Android

```bash
# Development build
eas build --platform android --profile development

# Production build
eas build --platform android --profile production
```

### 7.4 Submit to App Store

```bash
eas submit --platform ios --latest
```

Or upload manually via Transporter app on Mac.

### 7.5 Submit to Google Play

```bash
eas submit --platform android --latest
```

Or upload the .aab file manually in Google Play Console.

---

## Phase 8: Analytics & Tracking (Feature #14)

### 8.1 Firebase Analytics (automatic)

Firebase Analytics tracks automatically:
- Screen views, session duration, user retention
- In-app purchases (when connected to RevenueCat)
- Custom events (we've coded these in firebase.js)

### 8.2 Custom Events We Track

| Event | Description |
|-------|-------------|
| `diagnosis_completed` | User completes a full diagnosis |
| `supplies_click` | User clicks a carlotsupplies.com link |
| `subscription_started` | User subscribes (monthly or day pass) |

### 8.3 RevenueCat Dashboard

RevenueCat provides revenue tracking, subscriber analytics, cohort analysis, and churn metrics — all in their dashboard.

---

## Phase 9: Post-Launch Checklist

- [ ] Test the complete user flow: Sign up → Terms → Subscribe → Diagnose → Complete
- [ ] Verify in-app purchases work in sandbox/test mode
- [ ] Test social sharing on Facebook, Instagram, SMS
- [ ] Confirm carlotsupplies.com links work correctly
- [ ] Verify analytics events fire in Firebase Console
- [ ] Monitor RevenueCat for subscription data
- [ ] Set up Firebase Crashlytics for crash reporting
- [ ] Create a support email auto-responder for support@mobilemastermechanic.com
- [ ] Publish Terms of Use and Privacy Policy on mobilemastermechanic.com

---

## Feature Checklist (Your 14 Requirements)

| # | Feature | Status | Location |
|---|---------|--------|----------|
| 1 | App Name & Icon | ✅ | `app.json`, `appicon.png` |
| 2 | Angie's branding | ✅ | Footer, Settings, About |
| 3 | Supplies recommendations | ✅ | `SupplyTip.js`, `hankPrompt.js` |
| 4 | Post-job follow-up | ✅ | `DiagResultScreen.js` (Alert) |
| 5 | Help Center resources | ✅ | `SuppliesHubScreen.js` |
| 6 | Diagnostic flow (tools) | ✅ | `hankPrompt.js` (tool awareness) |
| 7 | Contextual help (YouTube, glossary) | ✅ | `GlossaryModal.js`, YouTube links |
| 8 | Social sharing | ✅ | `DiagResultScreen.js` (Share API) |
| 9 | Gamification & leaderboard | ✅ | `RankBadge.js`, `LeaderboardScreen.js` |
| 10 | UI/UX with Hank images | ✅ | `HankAvatar.js`, all screens |
| 11 | Freemium pricing | ✅ | `subscriptions.js`, `SubscriptionScreen.js` |
| 12 | Terms & Privacy | ✅ | `TermsScreen.js`, Settings links |
| 13 | Contact & support | ✅ | `SettingsScreen.js` |
| 14 | Analytics & tracking | ✅ | `firebase.js`, custom events |

---

## Project Structure

```
MobileMasterMechanic/
├── App.js                          # Entry point
├── app.json                        # Expo config
├── eas.json                        # EAS Build config
├── package.json                    # Dependencies
├── src/
│   ├── assets/images/              # All your Hank images, icons, backgrounds
│   ├── components/
│   │   ├── Badge.js
│   │   ├── Button.js
│   │   ├── ConfidenceBar.js
│   │   ├── GlossaryModal.js        # Feature #7
│   │   ├── HankAvatar.js           # Dynamic Hank mood images
│   │   ├── RankBadge.js            # Feature #9
│   │   └── SupplyTip.js            # Feature #3
│   ├── constants/
│   │   ├── hankPrompt.js           # Enhanced Hank AI prompt
│   │   └── theme.js                # Colors, fonts, ranks, config
│   ├── navigation/
│   │   └── AppNavigator.js         # React Navigation setup
│   ├── screens/
│   │   ├── AuthScreen.js           # Sign up / Sign in
│   │   ├── DiagChatScreen.js       # Main diagnostic chat
│   │   ├── DiagListScreen.js       # Open/completed jobs list
│   │   ├── DiagResultScreen.js     # Diagnosis results + work orders
│   │   ├── HomeScreen.js           # Home dashboard
│   │   ├── LeaderboardScreen.js    # Feature #9
│   │   ├── SettingsScreen.js       # Features #2, #5, #12, #13
│   │   ├── SubscriptionScreen.js   # Feature #11
│   │   ├── SuppliesHubScreen.js    # Features #3, #5
│   │   └── TermsScreen.js          # Feature #12
│   └── services/
│       ├── api.js                  # Claude AI communication
│       ├── firebase.js             # Auth, Firestore, Analytics
│       ├── firestore.js            # Data operations
│       ├── gamification.js         # Feature #9
│       └── subscriptions.js        # RevenueCat (Feature #11)
└── docs/
    └── BUILD_AND_DEPLOY_GUIDE.md   # This file
```

---

## Need Help?

For each external service, here are the key docs:

- **Expo / EAS**: https://docs.expo.dev
- **Firebase**: https://firebase.google.com/docs
- **RevenueCat**: https://docs.revenuecat.com
- **Apple Developer**: https://developer.apple.com/documentation
- **Google Play**: https://developer.android.com/distribute

Angela, work through each phase in order. Phase 1-2 can be done in a day, Phase 3-4 in another day, and Phases 5-7 depend on account approval timelines (Apple can take 24-48 hours). The whole process typically takes 1-2 weeks from start to live on both stores.
