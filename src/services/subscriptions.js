// ─── SUBSCRIPTION SERVICE (RevenueCat) ───────────────────────────────────────
// Handles in-app purchases via RevenueCat. Wires the existing
// SubscriptionScreen contract (getOfferings / purchasePackage /
// restorePurchases / checkSubscriptionAccess) to the real RevenueCat SDK.
//
// PRODUCT / OFFERING SETUP (out-of-band, in dashboards):
//   Google Play Console → Monetize → Products:
//     • In-app products → "mmm_24hour_pass" (consumable, $4.99)
//     • Subscriptions:
//         - "mmm_weekly"  ($x/week)
//         - "mmm_monthly" ($19.99/mo)
//         - "mmm_yearly"  ($x/year)
//   RevenueCat dashboard → Products: import those four product IDs
//   RevenueCat dashboard → Entitlements: create "Mobile Master Mechanic Pro"
//     and attach all four products to it
//   RevenueCat dashboard → Offerings → Current: package up the four products
//     under identifiers like "$rc_monthly", "$rc_weekly", "$rc_annual",
//     "day_pass" so SubscriptionScreen can show them.

import Purchases, { LOG_LEVEL } from "react-native-purchases";
import { Platform } from "react-native";
import { trackSubscription } from "./firebase";

const ENTITLEMENT_ID = "Mobile Master Mechanic Pro";

// API keys
// Android: production key from RevenueCat dashboard (Mobile Master Mechanic Play Store app)
// iOS: still using test key — swap when iOS app is set up in RevenueCat
const REVCAT_API_KEY_ANDROID = "goog_KLrPTQLBsmNJrPuRNMAeaqhJiyw";
const REVCAT_API_KEY_IOS = "test_EVHrgEDqXJmICrIwPpJDelOkjyB"; // TODO: replace with real iOS key

let _configured = false;

// ─── INITIALIZATION ─────────────────────────────────────────────────────────
// Called once on app start (from App.js useEffect). Idempotent — calling it
// again with the same user is a no-op. Calling it with a NEW user will
// re-identify so RevenueCat associates the purchase with the new user.
export const initPurchases = async (userId) => {
  try {
    if (!_configured) {
      Purchases.setLogLevel(LOG_LEVEL.WARN);
      const apiKey = Platform.OS === "android" ? REVCAT_API_KEY_ANDROID : REVCAT_API_KEY_IOS;
      Purchases.configure({ apiKey, appUserID: userId || null });
      _configured = true;
      console.log("[purchases] configured for", Platform.OS, "user:", userId || "(anonymous)");
    } else if (userId) {
      // Already configured — re-identify if user changed
      const info = await Purchases.getCustomerInfo();
      if (info.originalAppUserId !== userId) {
        await Purchases.logIn(userId);
      }
    }
  } catch (e) {
    console.warn("[purchases] init failed:", e?.message ?? e);
  }
};

export const logOutPurchases = async () => {
  try {
    if (_configured) await Purchases.logOut();
  } catch (e) {
    console.warn("[purchases] logOut failed:", e?.message ?? e);
  }
};

// ─── OFFERINGS ──────────────────────────────────────────────────────────────
// Returns an array of Package objects from the current offering. Each Package
// has: { identifier, packageType, product: { title, priceString, description, ... } }
export const getOfferings = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    if (!offerings.current) {
      console.warn("[purchases] no current offering configured in RevenueCat dashboard");
      return [];
    }
    return offerings.current.availablePackages;
  } catch (e) {
    console.warn("[purchases] getOfferings failed:", e?.message ?? e);
    return [];
  }
};

// ─── PURCHASE ───────────────────────────────────────────────────────────────
// Returns { success, customerInfo, productIdentifier, cancelled?, error? }.
// success === true ONLY if the entitlement is active after the purchase.
export const purchasePackage = async (pkg) => {
  try {
    const result = await Purchases.purchasePackage(pkg);
    const customerInfo = result.customerInfo;
    const isPro = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
    if (isPro) {
      // Best-effort analytics — never block the purchase
      try { await trackSubscription(pkg?.identifier || "unknown"); } catch (_) {}
    }
    return {
      success: isPro,
      customerInfo,
      productIdentifier: result.productIdentifier,
    };
  } catch (e) {
    if (e?.userCancelled) {
      return { success: false, cancelled: true };
    }
    console.warn("[purchases] purchasePackage failed:", e?.message ?? e);
    return { success: false, error: e?.message ?? String(e) };
  }
};

// ─── RESTORE ─────────────────────────────────────────────────────────────────
// Returns true if any active entitlement is found after restoring.
export const restorePurchases = async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
  } catch (e) {
    console.warn("[purchases] restorePurchases failed:", e?.message ?? e);
    return false;
  }
};

// ─── ENTITLEMENT CHECK ──────────────────────────────────────────────────────
// Returns the canonical { hasAccess, type, expiresAt, isActive, willRenew }
// shape used elsewhere in the app (App.js gates on this).
export const checkSubscriptionAccess = async () => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const ent = customerInfo.entitlements.active[ENTITLEMENT_ID];
    return {
      hasAccess: !!ent,
      type: ent?.productIdentifier || null,
      expiresAt: ent?.expirationDate || null,
      isActive: !!ent,
      willRenew: ent?.willRenew ?? null,
      customerInfo,
    };
  } catch (e) {
    console.warn("[purchases] checkSubscriptionAccess failed:", e?.message ?? e);
    return { hasAccess: false, type: null, expiresAt: null, isActive: false };
  }
};

// ─── REVENUE CAT UI: PAYWALL + CUSTOMER CENTER ──────────────────────────────
// Lazy-require so the app doesn't crash if react-native-purchases-ui isn't
// fully available (e.g., during very first render before native init).

export const presentPaywall = async (offeringIdentifier) => {
  try {
    const RevenueCatUI = require("react-native-purchases-ui").default;
    const result = offeringIdentifier
      ? await RevenueCatUI.presentPaywall({ offeringIdentifier })
      : await RevenueCatUI.presentPaywall();
    return result; // "PURCHASED" | "RESTORED" | "NOT_PRESENTED" | "ERROR" | "CANCELLED"
  } catch (e) {
    console.warn("[purchases] presentPaywall failed:", e?.message ?? e);
    return "ERROR";
  }
};

// Only opens the paywall if the user doesn't already have the entitlement.
// Useful for gating actions like "Start a Diagnosis" without paying twice.
export const presentPaywallIfNeeded = async () => {
  try {
    const RevenueCatUI = require("react-native-purchases-ui").default;
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: ENTITLEMENT_ID,
    });
    return result;
  } catch (e) {
    console.warn("[purchases] presentPaywallIfNeeded failed:", e?.message ?? e);
    return "ERROR";
  }
};

// Customer Center — the RevenueCat-managed "manage your subscription" UI.
// Wire this to a "Manage Subscription" row in Settings.
export const presentCustomerCenter = async () => {
  try {
    const RevenueCatUI = require("react-native-purchases-ui").default;
    await RevenueCatUI.presentCustomerCenter();
  } catch (e) {
    console.warn("[purchases] presentCustomerCenter failed:", e?.message ?? e);
  }
};

// ─── FREE TRIAL TRACKING (LEGACY — kept for App.js compat) ──────────────────
export const checkFreeTrialEligible = async (userProfile) => {
  return !userProfile?.freeTrialUsed;
};

export const markFreeTrialUsed = async (u