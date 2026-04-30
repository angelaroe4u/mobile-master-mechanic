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
export const RANK_REWARDS = {
  1:  { code: "FRIEND-FREETRIAL",  title: "Free Trial for a Friend",        desc: "Share this code with a friend — they get a free 24-hour trial on us." },
  2:  { code: "MONTH2-FREE",       title: "Your 2nd Month Free",            desc: "Upgrade to monthly and use this code to get your second month completely free." },
  3:  { code: "SHOP15",            title: "15% Off at CarLot Supplies",     desc: "Use this code at carlotsupplies.com for 15% off your next order." },
  4:  { code: "DAYPASS3PACK",      title: "3 Free Day Passes",              desc: "Three day passes for you to use — or share with your crew." },
  5:  { code: "VIP20",             title: "20% Off CarLot Supplies",        desc: "VIP discount — 20% off everything at carlotsupplies.com." },
  6:  { code: "PRO-KIT-FREE",      title: "Free Pro Starter Kit",           desc: "Claim a free Pro Starter Kit from carlotsupplies.com. Includes essentials for any garage." },
  7:  { code: "LOYAL3MONTHS",      title: "3 Months for the Price of 2",    desc: "Lock in 3 months of Mobile Master Mechanic for the price of 2." },
  8:  { code: "EXPERT-ANNUAL25",   title: "25% Off Annual Subscription",    desc: "Switch to annual and save 25%. Use this code at checkout." },
  9:  { code: "FOREMAN-ALLACCESS", title: "Lifetime Founding Member Rate",  desc: "Lock in 50% off your subscription for life. Foreman's privilege." },
  10: { code: "MASTER-LEGEND",     title: "Master Technician Status",       desc: "You've earned it. Free subscription for 6 months + your name on the leaderboard hall of fame." },
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
export const PART_STORES = [
  { name: "CarLot Supplies",  url: "https://carlotsupplies.com/search?q=", color: "#f59e0b", icon: "star" },
  { name: "AutoZone",         url: "https://www.autozone.com/searchresult?searchText=", color: "#ff6600", icon: "tool" },
  { name: "RockAuto",         url: "https://www.rockauto.com/en/catalog/", color: "#e63946", icon: "box" },
  { name: "Amazon",           url: "https://www.amazon.com/s?k=", color: "#ff9900", icon: "package" },
  { name: "eBay Motors",      url: "https://www.ebay.com/sch/i.html?_nkw=", color: "#0064d2", icon: "shopping-bag" },
  { name: "O'Reilly Auto",    url: "https://www.oreillyauto.com/search?q=", color: "#d62828", icon: "wrench" },
];
