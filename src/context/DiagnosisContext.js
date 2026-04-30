// ─── DIAGNOSIS SESSION CONTEXT ───────────────────────────────────────────────
// Persists the active chat session in memory across navigation.
// The session survives screen unmount (e.g. going back to Home) but is cleared
// when the user explicitly starts a new diagnosis.

import React, { createContext, useContext, useState, useCallback } from "react";

const genId = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

const EMPTY_SESSION = () => ({
  id: genId(),
  startedAt: now(),
  vehicle: null,
  transcript: [],
  apiMessages: [],
  confidence: 0,
  done: false,
  diagnosis: null,
  completed: false,
  tools: [],
  keyTerms: [],
});

const DiagnosisContext = createContext(null);

export function DiagnosisProvider({ children }) {
  // null = no session started yet; object = active or paused session
  const [activeSession, setActiveSession] = useState(null);

  const startNewSession = useCallback(() => {
    const fresh = EMPTY_SESSION();
    setActiveSession(fresh);
    return fresh;
  }, []);

  const clearSession = useCallback(() => {
    setActiveSession(null);
  }, []);

  return (
    <DiagnosisContext.Provider
      value={{ activeSession, setActiveSession, startNewSession, clearSession }}
    >
      {children}
    </DiagnosisContext.Provider>
  );
}

export const useDiagnosis = () => {
  const ctx = useContext(DiagnosisContext);
  if (!ctx) throw new Error("useDiagnosis must be used inside DiagnosisProvider");
  return ctx;
};

export { EMPTY_SESSION };
