// ─── FIREBASE SERVICE (DEV MODE) ─────────────────────────────────────────────
// Running with mock data for Expo Go development.
// Real Firebase will be wired in during EAS build setup.

const mockUser = {
  uid: "dev-user-001",
  email: "angelaroe4u@gmail.com",
  displayName: "Angela",
};

const mockProfile = {
  name: "Angela",
  email: "angelaroe4u@gmail.com",
  points: 75,
  rank: 2,
  rankTitle: "Oil Change Specialist",
  diagnosesCount: 3,
  freeTrialUsed: false,
  acceptedTerms: true,
  acceptedPrivacy: true,
};

export const signUpWithEmail = async (email, password) => {
  console.log("[DEV] signUpWithEmail:", email);
  return mockUser;
};

export const signInWithEmail = async (email, password) => {
  console.log("[DEV] signInWithEmail:", email);
  return mockUser;
};

export const signOut = async () => {
  console.log("[DEV] signOut");
};

export const getCurrentUser = () => mockUser;

export const onAuthStateChanged = (callback) => {
  setTimeout(() => callback(mockUser), 100);
  return () => {};
};

export const createUserProfile = async (uid, data) => {
  console.log("[DEV] createUserProfile:", uid);
};

export const getUserProfile = async (uid) => {
  return mockProfile;
};

export const updateUserProfile = async (uid, data) => {
  console.log("[DEV] updateUserProfile:", data);
  Object.assign(mockProfile, data);
};

export const acceptTerms = async (uid) => {
  console.log("[DEV] acceptTerms");
  mockProfile.acceptedTerms = true;
  mockProfile.acceptedPrivacy = true;
};

export const logEvent = async (name, params = {}) => {
  console.log("[DEV] analytics:", name, params);
};

export const logScreenView = async (screenName) => {
  console.log("[DEV] screenView:", screenName);
};

export const trackDiagnosis = async (diagId, vehicle, severity) => {
  console.log("[DEV] trackDiagnosis:", diagId, severity);
};

export const trackSuppliesClick = async (category, source) => {
  console.log("[DEV] trackSuppliesClick:", category);
};

export const trackSubscription = async (type) => {
  console.log("[DEV] trackSubscription:", type);
};
