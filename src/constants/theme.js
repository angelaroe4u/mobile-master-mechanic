// ─── THEME ──────────────────────────────────────────────────────────────────
// Mobile Master Mechanic — Light & Dark automotive themes
// Powered by Angie's Auto Supplies

// ── DARK PALETTE (default) ──
export const DARK_COLORS = {
  bg:       "#0a0e1a",
  surface:  "#111827",
  card:     "#1a2235",
  border:   "#2a3550",
  accent:   "#f59e0b",
  blue:     "#3b82f6",
  green:    "#22c55e",
  red:      "#ef4444",
  purple:   "#8b5cf6",
  text:     "#f1f5f9",
  textM:    "#94a3b8",
  textD:    "#475569",
  white:    "#ffffff",
  black:    "#000000",
};

// ── LIGHT PALETTE ──
export const LIGHT_COLORS = {
  bg:       "#f5f6fa",
  surface:  "#ffffff",
  card:     "#ffffff",
  border:   "#dce1ea",
  accent:   "#d97706",
  blue:     "#2563eb",
  green:    "#16a34a",
  red:      "#dc2626",
  purple:   "#7c3aed",
  text:     "#1a1a2e",
  textM:    "#475569",
  textD:    "#94a3b8",
  white:    "#ffffff",
  black:    "#000000",
};

// Default export — dark. Screens that support dynamic theming use useColors() hook.
export const COLORS = DARK_COLORS;

export const DARK_GRADIENTS = {
  accent: ["#f59e0b", "#f97316"],
  blue:   ["#3b82f6", "#6366f1"],
  green:  ["#22c55e", "#16a34a"],
  dark:   ["#0a0e1a", "#111827"],
  card:   ["#1a2235", "#111827"],
  danger: ["#ef4444", "#dc2626"],
};

export const LIGHT_GRADIENTS = {
  accent: ["#f59e0b", "#fb923c"],
  blue:   ["#3b82f6", "#818cf8"],
  green:  ["#22c55e", "#4ade80"],
  dark:   ["#f5f6fa", "#e2e8f0"],
  card:   ["#ffffff", "#f8fafc"],
  danger: ["#ef4444", "#f87171"],
};

export const GRADIENTS = DARK_GRADIENTS;

export const FONTS = {
  heading:    "BlackOpsOne_400Regular",  // Grunge/industrial mechanic-shop vibe
  headingAlt: "BebasNeue_400Regular",    // Secondary heading (cleaner)
  body:       "IBMPlexMono_400Regular",
  bodyBold:   "IBMPlexMono_700Bold",
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  round: 999,
};

// ─── GAMIFICATION LEVELS & REWARDS ─────────────────────────────────────────
// Reward titles are vague on purpose — the actual reward is a surprise pop-up.
export const RANKS = [
  { level: 1,  title: "Lube Tech",            minPoints: 0,    color: "#94a3b8", rewardDesc: "A gift for a friend"                },
  { level: 2,  title: "Oil Change Specialist", minPoints: 50,   color: "#64748b", rewardDesc: "A month on us"                      },
  { level: 3,  title: "Brake Technician",      minPoints: 150,  color: "#3b82f6", rewardDesc: "Shop credit"                        },
  { level: 4,  title: "Suspension Tech",       minPoints: 300,  color: "#6366f1", rewardDesc: "Upgrade reward"                     },
  { level: 5,  title: "Engine Specialist",     minPoints: 500,  color: "#8b5cf6", rewardDesc: "VIP discount"                       },
  { level: 6,  title: "Electrical Tech",       minPoints: 800,  color: "#22c55e", rewardDesc: "Pro kit bonus"                      },
  { level: 7,  title: "Transmission Expert",   minPoints: 1200, color: "#16a34a", rewardDesc: "Loyalty perk"                       },
  { level: 8,  title: "Diagnostic Pro",        minPoints: 1800, color: "#f59e0b", rewardDesc: "Expert exclusive"                   },
  { level: 9,  title: "Shop Foreman",          minPoints: 2500, color: "#f97316", rewardDesc: "Foreman's privilege"                 },
  { level: 10, title: "Master Technician",     minPoints: 3500, color: "#ef4444", rewardDesc: "Master status — legendary reward"   },
];

// Actual reward content per level (shown in pop-up, saved to settings)
//
// Reward `type` field:
//   "shopify"     — real promo code redeemable at carlotsupplies.com (tap to copy)
//   "share"       — shareable invite link / code for a friend
//   "bonus_chats" — auto-applies N free Hank diagnoses (in-app, no code needed)
//   "bonus_passes" — auto-applies N free 24-hour Pro passes (in-app)
//   "bonus_months" — auto-applies N free months of Pro access (in-app)
//
// "value" is meaningful for bonus_chats/passes/months. The `code` on shopify
// rewards is the literal coupon. Bonus-type rewards get auto-applied to the
// user's account on grant — there is no code to type.
export const RANK_REWARDS = {
  1:  { type: "share",        code: "FRIEND-FREETRIAL",  title: "Free Trial for a Friend",      desc: "Share Mobile Master Mechanic with a friend — first 2 diagnoses are on us." },
  2:  { type: "bonus_chats",  value: 5,                   title: "5 Bonus Diagnoses",            desc: "5 extra Hank diagnoses on us — already added to your account." },
  3:  { type: "shopify",      code: "SHOP15",             title: "15% Off at CarLot Supplies",   desc: "Use this code at carlotsupplies.com for 15% off your next order." },
  4:  { type: "bonus_passes", value: 3,                   title: "3 Bonus 24-Hour Passes",       desc: "Three 24-hour Pro passes — auto-applied. Use them whenever you need Hank." },
  5:  { type: "shopify",      code: "VIP20",              title: "20% Off at CarLot Supplies",   desc: "VIP discount — 20% off everything at carlotsupplies.com." },
  6:  { type: "shopify",      code: "PRO-KIT-FREE",       title: "Free Pro Starter Kit",         desc: "Claim a free Pro Starter Kit from carlotsupplies.com. Includes essentials for any garage." },
  7:  { type: "bonus_chats",  value: 15,                  title: "15 Bonus Diagnoses",           desc: "15 extra Hank diagnoses — auto-applied to your account." },
  8:  { type: "shopify",      code: "EXPERT-ANNUAL25",    title: "25% Off Annual at CarLot",     desc: "25% off any annual purchase at carlotsupplies.com. Use this code at checkout." },
  9:  { type: "bonus_months", value: 1,                   title: "Foreman's Free Month",         desc: "1 free month of Pro access — auto-applied. Foreman's privilege." },
  10: { type: "bonus_months", value: 6,                   title: "Master Technician Status",     desc: "You've earned it. 6 months of Pro on the house — auto-applied." },
};

export const POINTS = {
  diagnosisStarted: 5,
  diagnosisCompleted: 25,
  workOrderCompleted: 15,
  feedbackGiven: 10,
  socialShare: 5,
};

// ─── EXTERNAL LINKS ─────────────────────────────────────────────────────────
export const LINKS = {
  carLotSupplies: "https://carlotsupplies.com",
  termsOfUse: "https://mobilemastermechanic.com/terms",
  privacyPolicy: "https://mobilemastermechanic.com/privacy",
  supportEmail: "customerservice@carlotsupplies.com",
  ownerEmail: "angela@carlotsupplies.com",
  mailingAddress: "Angie's Auto Supplies Inc.\n4250 Salem Dallas Hwy NW\nSalem, OR 97304",
  phone: "(503) 880-9564",
  businessHours: "Mon-Fri: 9AM-5PM",
};

// ─── LEGAL / BUSINESS ENTITY ────────────────────────────────────────────────
export const LEGAL = {
  companyName: "Angie's Auto Supplies Inc.",
  tradeName: "Angie's Auto Supplies",
  appName: "Mobile Master Mechanic",
  stateOfIncorporation: "Oregon",
  governingLaw: "State of Oregon",
  venue: "Marion County, Oregon",
  address: "4250 Salem Dallas Hwy NW, Salem, OR 97304",
  phone: "(503) 880-9564",
  email: "customerservice@carlotsupplies.com",
  ownerEmail: "angela@carlotsupplies.com",
  website: "carlotsupplies.com",
  appWebsite: "mobilemastermechanic.com",
  subscriptionDayPass: "$4.99",
  subscriptionMonthly: "$19.99",
  termsLastUpdated: "April 12, 2026",
  privacyLastUpdated: "April 12, 2026",
};


// ─── PART STORES ────────────────────────────────────────────────────────────
// Each entry's `url` is appended with an encoded query of the form
// "<part name> <year> <make> <model> <trim>" (built in DiagResultScreen's
// buildPartQuery). carlotsupplies.com is intentionally NOT in this list —
// CarLot Supplies is an auto-supplies business, not a parts retailer.
export const PART_STORES = [
  { name: "AutoZone",            url: "https://www.autozone.com/searchresult?searchText=",                    color: "#ff6600", icon: "tool" },
  { name: "O'Reilly Auto Parts", url: "https://www.oreillyauto.com/search?q=",                                color: "#d62828", icon: "wrench" },
  { name: "Advance Auto Parts",  url: "https://shop.advanceautoparts.com/find?searchTerm=",                   color: "#e10600", icon: "tool" },
  { name: "NAPA Auto Parts",     url: "https://www.napaonline.com/en/search?text=",                           color: "#003896", icon: "wrench" },
  { name: "RockAuto",            url: "https://www.google.com/search?q=site%3Arockauto.com+",                 color: "#e63946", icon: "box" },
  { name: "Amazon",              url: "https://www.amazon.com/s?k=",                                          color: "#ff9900", icon: "package" },
  { name: "eBay Motors",         url: "https://www.ebay.com/sch/i.html?_sacat=6000&_nkw=",                    color: "#0064d2", icon: "shopping-bag" },
];
