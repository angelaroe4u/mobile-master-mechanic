// ─── SUBSCRIPTION SERVICE (DEV MODE) ─────────────────────────────────────────
// Currently running with mock data for Expo Go development.
// RevenueCat will be integrated in the EAS production build.
//
// PRODUCTION SETUP (when building with EAS):
// 1. Create account at https://app.revenuecat.com
// 2. Create project "MobileMasterMechanic"
// 3. Add products: com.angiesautosupplies.mmm.monthly ($19.99) and .daypass ($4.99)
// 4. Replace this file with the full RevenueCat implementation
// 5. Add react-native-purchases back to package.json

import { trackSubscription } from "./firebase";

const PRODUCT_IDS = {
  monthly: "com.angiesautosupplies.mmm.monthly",
  daypass: "com.angiesautosupplies.mmm.daypass",
};

const MOCK_OFFERINGS = [
  {
    identifier: PRODUCT_IDS.monthly,
    product: {
      title: "Monthly Pro",
      priceString: "$19.99/mo",
      description: "Unlimited AI diagnostics, work orders, and history",
    },
  },
  {
    identifier: PRODUCT_IDS.daypass,
    product: {
      title: "Day Pass",
      priceString: "$4.99",
      description: "24-hour unlimited access",
    },
  },
];

export const initPurchases = async (userId) => {
  console.log("[DEV] initPurchases for:", userId);
};

export const checkSubscriptionAccess = async () => {
  return { hasAccess: true, type: "monthly", expiresAt: null, isActive: true };
};

export const getOfferings = async () => {
  return MOCK_OFFERINGS;
};

export const purchasePackage = async (pkg) => {
  console.log("[DEV] purchasePackage:", pkg?.identifier);
  await trackSubscription("monthly");
  return { success: true, customerInfo: {} };
};

export const restorePurchases = async () => {
  console.log("[DEV] restorePurchases");
  return true;
};

export const checkFreeTrialEligible = async (userProfile) => {
  return !userProfile?.freeTrialUsed;
};

export const markFreeTrialUsed = async (updateUserProfile, uid) => {
  await updateUserProfile(uid, { freeTrialUsed: true });
};
