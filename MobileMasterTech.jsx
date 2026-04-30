/* eslint-disable */
import { useState, useEffect, useRef, useCallback } from "react";

// ─── THEME ───────────────────────────────────────────────────────────────────
const T = {
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
};

const G = {
  accent: "linear-gradient(135deg,#f59e0b,#f97316)",
  blue:   "linear-gradient(135deg,#3b82f6,#6366f1)",
  green:  "linear-gradient(135deg,#22c55e,#16a34a)",
  dark:   "linear-gradient(160deg,#0a0e1a 0%,#111827 100%)",
  card:   "linear-gradient(160deg,#1a2235 0%,#111827 100%)",
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
const genId = () => Math.random().toString(36).slice(2,10);
const now = () => new Date().toISOString();
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) +
    " " + d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
};

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "mmt_data_v1";
const loadData = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
};
const saveData = (data) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
};

// ─── MOCK SUBSCRIPTION (replace with Stripe/RevenueCat in production) ────────
const checkAccess = (sub) => {
  if (!sub) return false;
  if (sub.type === "monthly") return true;
  if (sub.type === "daypass") {
    const exp = new Date(sub.expiresAt);
    return exp > new Date();
  }
  return false;
};

// ─── HANK SYSTEM PROMPT (consumer version) ───────────────────────────────────
const buildHankSystem = (vehicle, transcript = []) => {
  const hasVehicle = vehicle?.year || vehicle?.make;
  const hasHistory = transcript.length > 0;

  return `You are Master Tech, a world-class automotive diagnostic AI with 40 years of combined diagnostic experience across all makes and models. You speak directly, professionally, and clearly — like a master mechanic who respects the customer's intelligence. You never guess; you diagnose systematically.

${hasVehicle
  ? `VEHICLE: ${vehicle.year||""} ${vehicle.make||""} ${vehicle.model||""} ${vehicle.trim||""} — ${vehicle.mileage ? parseInt(vehicle.mileage).toLocaleString()+"mi" : "mileage unknown"}, ${vehicle.transmission||"transmission unknown"}`
  : `NO VEHICLE IDENTIFIED YET. Ask the user what vehicle they're working on. Get: year, make, model, mileage, transmission. Be conversational.`}

${hasHistory ? `PREVIOUS DIAGNOSIS CONTEXT: This is a continuation. Prior findings: ${transcript.slice(-4).map(m=>m.content).join(" | ")}` : ""}

DIAGNOSTIC PROTOCOL:
- Ask focused, specific questions that narrow down the root cause
- One question at a time — don't overwhelm
- When confidence reaches 85%+, start building toward a diagnosis
- At 95%+ confidence, finalize diagnosis and generate work order
- Always think: what's the most likely cause given the symptoms?

RESPONSE FORMAT — you MUST always respond in valid JSON:
{
  "message": "Your conversational response here",
  "confidence": 0-100,
  "mood": "neutral|thinking|concerned|confident|alarmed",
  "vehicleUpdate": { "year":"","make":"","model":"","trim":"","mileage":"","transmission":"" } or null,
  "done": false,
  "diagnosis": null or {
    "title": "Primary diagnosis title",
    "summary": "Clear explanation of what's wrong and why",
    "severity": "low|medium|high|critical",
    "workOrders": [
      {
        "title": "Repair title",
        "description": "Detailed description",
        "estimatedHours": 2.5,
        "difficulty": "DIY|moderate|professional",
        "parts": [
          { "name": "Part name", "partNumber": "OEM part number if known", "estimatedCost": 45, "searchQuery": "search terms for finding this part" }
        ],
        "steps": [
          "Step 1: ...",
          "Step 2: ..."
        ],
        "estimatedTotalCost": 250,
        "urgency": "immediate|soon|monitor"
      }
    ]
  }
}`;
};

// ─── API CALL ─────────────────────────────────────────────────────────────────
const callHank = async (messages, system) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system,
      messages,
    }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  try {
    const clean = text.replace(/```json|```/g,"").trim();
    const j = clean.indexOf("{"), k = clean.lastIndexOf("}");
    if (j >= 0 && k > j) return JSON.parse(clean.slice(j, k+1));
  } catch {}
  return { message: text, confidence: 0, mood: "neutral", done: false };
};

// ─── PART SEARCH (mock — in production connect to real APIs) ─────────────────
const PART_STORES = [
  { name: "AutoZone", url: "https://www.autozone.com/searchresult?searchText=", color: "#ff6600", logo: "🔧" },
  { name: "RockAuto", url: "https://www.rockauto.com/en/catalog/", color: "#e63946", logo: "🪨" },
  { name: "Amazon", url: "https://www.amazon.com/s?k=", color: "#ff9900", logo: "📦" },
  { name: "eBay Motors", url: "https://www.ebay.com/sch/i.html?_nkw=", color: "#0064d2", logo: "🏪" },
  { name: "FCP Euro", url: "https://www.fcpeuro.com/search#q=", color: "#003087", logo: "🇪🇺" },
  { name: "O'Reilly Auto", url: "https://www.oreillyauto.com/search?q=", color: "#d62828", logo: "🔩" },
];

const getPartSearchUrl = (store, part, vehicle) => {
  const q = encodeURIComponent(`${vehicle?.year||""} ${vehicle?.make||""} ${vehicle?.model||""} ${part.searchQuery||part.name}`);
  return store.url + q;
};

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────
const Btn = ({ children, onClick, variant="accent", size="md", full, disabled, style: sx }) => {
  const bg = {
    accent: G.accent, blue: G.blue, green: G.green,
    ghost: "transparent", danger: "linear-gradient(135deg,#ef4444,#dc2626)"
  }[variant];
  const color = variant === "ghost" ? T.textM : "#000";
  const border = variant === "ghost" ? `1px solid ${T.border}` : "none";
  const textColor = ["accent","blue","green","danger"].includes(variant) ? "#fff" : color;
  const pad = size === "sm" ? "6px 14px" : "11px 22px";
  const fs = size === "sm" ? 12 : 14;
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background:bg, border, borderRadius:10, padding:pad, cursor:disabled?"not-allowed":"pointer",
        fontSize:fs, fontWeight:700, color:textColor, fontFamily:"inherit",
        width:full?"100%":"auto", opacity:disabled?0.45:1, transition:"opacity 0.2s",
        display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, ...sx }}>
      {children}
    </button>
  );
};

const Badge = ({ children, color = T.accent }) => (
  <span style={{ background:color+"22", color, border:`1px solid ${color}40`, borderRadius:20,
    padding:"2px 9px", fontSize:11, fontWeight:700 }}>{children}</span>
);

const ConfBar = ({ pct }) => (
  <div style={{ marginBottom:8 }}>
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:T.textM, marginBottom:3 }}>
      <span>Diagnostic Confidence</span>
      <span style={{ fontWeight:800, color: pct>=95?T.green:pct>=70?T.accent:T.textM }}>{pct}%</span>
    </div>
    <div style={{ height:5, background:T.border, borderRadius:3, overflow:"hidden" }}>
      <div style={{ width:`${pct}%`, height:"100%", borderRadius:3,
        background: pct>=95?G.green:pct>=70?G.accent:G.blue,
        transition:"width 0.6s ease" }} />
    </div>
  </div>
);

// ─── SCREENS ─────────────────────────────────────────────────────────────────

// ── SUBSCRIPTION GATE ────────────────────────────────────────────────────────
const SubScreen = ({ onSubscribe }) => {
  const [loading, setLoading] = useState(null);

  const handleBuy = async (type) => {
    setLoading(type);
    await new Promise(r => setTimeout(r, 1200));
    const sub = type === "monthly"
      ? { type:"monthly", startedAt: now() }
      : { type:"daypass", startedAt: now(), expiresAt: new Date(Date.now()+86400000).toISOString() };
    setLoading(null);
    onSubscribe(sub);
  };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ textAlign:"center", marginBottom:32 }}>
        <div style={{ fontSize:48, marginBottom:8 }}>🔧</div>
        <div style={{ fontSize:36, fontWeight:900, color:T.accent, fontFamily:"'Bebas Neue',sans-serif",
          letterSpacing:"0.08em", lineHeight:1 }}>MOBILE MASTER TECH</div>
        <div style={{ fontSize:13, color:T.textM, marginTop:6 }}>
          Professional-grade AI vehicle diagnostics — in your pocket
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:14, width:"100%", maxWidth:340 }}>
        {/* Day Pass */}
        <div style={{ background:T.card, border:`2px solid ${T.border}`, borderRadius:16, padding:"20px 20px" }}>
          <div style={{ fontSize:12, color:T.textM, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Day Pass</div>
          <div style={{ fontSize:34, fontWeight:900, color:T.text, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.04em" }}>$4.99</div>
          <div style={{ fontSize:11, color:T.textM, marginBottom:14 }}>Full access for 24 hours</div>
          <Btn full onClick={() => handleBuy("daypass")} disabled={loading==="daypass"}>
            {loading==="daypass" ? "Processing…" : "Get Day Pass →"}
          </Btn>
        </div>

        {/* Monthly */}
        <div style={{ background:`linear-gradient(135deg,#1a2a1a,#1a2235)`,
          border:`2px solid ${T.green}50`, borderRadius:16, padding:"20px 20px", position:"relative" }}>
          <div style={{ position:"absolute", top:-10, right:16, background:G.green, color:"#fff",
            fontSize:10, fontWeight:800, borderRadius:20, padding:"3px 12px" }}>BEST VALUE</div>
          <div style={{ fontSize:12, color:T.textM, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Monthly</div>
          <div style={{ fontSize:34, fontWeight:900, color:T.text, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.04em" }}>$19.99<span style={{ fontSize:14, color:T.textM }}>/mo</span></div>
          <div style={{ fontSize:11, color:T.textM, marginBottom:14 }}>Unlimited diagnostics · All vehicles · Cancel anytime</div>
          <Btn full variant="green" onClick={() => handleBuy("monthly")} disabled={loading==="monthly"}>
            {loading==="monthly" ? "Processing…" : "Start Monthly →"}
          </Btn>
        </div>

        <div style={{ textAlign:"center", fontSize:10, color:T.textD, lineHeight:1.6 }}>
          Diagnoses powered by Claude AI · Parts pricing via affiliate links<br/>
          No ads · No data sold · Cancel anytime
        </div>
      </div>
    </div>
  );
};

// ── HOME ─────────────────────────────────────────────────────────────────────
const HomeScreen = ({ sub, diags, onStartDiag, onViewOpen, onViewDone, onManageSub }) => {
  const openDiags = diags.filter(d => !d.completed);
  const doneDiags = diags.filter(d => d.completed);

  return (
    <div style={{ minHeight:"100vh", background:T.bg, padding:"0 0 80px" }}>
      {/* Hero */}
      <div style={{ background:`linear-gradient(160deg,#0f1b2d 0%,#0a0e1a 100%)`,
        padding:"48px 24px 32px", textAlign:"center", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontSize:11, color:T.accent, fontWeight:800, textTransform:"uppercase",
          letterSpacing:"0.14em", marginBottom:8 }}>AI Vehicle Diagnostics</div>
        <div style={{ fontSize:42, fontWeight:900, color:T.text, fontFamily:"'Bebas Neue',sans-serif",
          letterSpacing:"0.06em", lineHeight:1 }}>MOBILE</div>
        <div style={{ fontSize:42, fontWeight:900, background:G.accent,
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.06em", lineHeight:1 }}>MASTER TECH</div>
        <div style={{ fontSize:12, color:T.textM, marginTop:10 }}>
          {sub.type === "monthly" ? "✓ Monthly subscriber" : "✓ Day pass active"}
        </div>
      </div>

      <div style={{ padding:"24px 20px", display:"flex", flexDirection:"column", gap:12 }}>
        {/* Start Diagnosis */}
        <div onClick={onStartDiag}
          style={{ background:`linear-gradient(135deg,#1a1a2e,#16213e)`,
            border:`2px solid ${T.accent}50`, borderRadius:18, padding:"24px 20px",
            cursor:"pointer", display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ fontSize:40, flexShrink:0 }}>🔬</div>
          <div>
            <div style={{ fontSize:20, fontWeight:900, color:T.accent,
              fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.06em" }}>NEW DIAGNOSIS</div>
            <div style={{ fontSize:12, color:T.textM, marginTop:2 }}>
              Describe your symptoms · AI pinpoints the problem
            </div>
          </div>
          <div style={{ marginLeft:"auto", fontSize:20, color:T.accent }}>→</div>
        </div>

        {/* Open Jobs */}
        <div onClick={onViewOpen}
          style={{ background:T.card, border:`2px solid ${T.blue}40`, borderRadius:16,
            padding:"18px 20px", cursor:"pointer", display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:T.blue+"22",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>🔧</div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:T.text }}>Open Jobs</div>
            <div style={{ fontSize:11, color:T.textM }}>
              {openDiags.length} active · tap to continue
            </div>
          </div>
          {openDiags.length > 0 && (
            <div style={{ marginLeft:"auto", background:T.blue, color:"#fff",
              borderRadius:"50%", width:24, height:24, fontSize:11, fontWeight:800,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              {openDiags.length}
            </div>
          )}
        </div>

        {/* Completed */}
        <div onClick={onViewDone}
          style={{ background:T.card, border:`2px solid ${T.green}40`, borderRadius:16,
            padding:"18px 20px", cursor:"pointer", display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:T.green+"22",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>✅</div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:T.text }}>Completed Jobs</div>
            <div style={{ fontSize:11, color:T.textM }}>
              {doneDiags.length} finished · repair history
            </div>
          </div>
        </div>

        {/* Manage sub */}
        <button onClick={onManageSub}
          style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:10,
            padding:"10px 16px", cursor:"pointer", color:T.textM, fontSize:11,
            fontFamily:"inherit", textAlign:"center", marginTop:8 }}>
          Manage Subscription · {sub.type === "monthly" ? "$19.99/mo" : "Day Pass"}
        </button>
      </div>
    </div>
  );
};

// ── DIAG LIST ────────────────────────────────────────────────────────────────
const DiagList = ({ diags, onBack, onSelect, title, emptyMsg }) => (
  <div style={{ minHeight:"100vh", background:T.bg, padding:"0 0 80px" }}>
    <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`,
      padding:"16px 20px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 }}>
      <button onClick={onBack} style={{ background:"none", border:"none", color:T.accent,
        cursor:"pointer", fontSize:22, padding:0, lineHeight:1 }}>←</button>
      <div style={{ fontSize:18, fontWeight:900, color:T.text,
        fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.06em" }}>{title}</div>
    </div>
    <div style={{ padding:"16px 20px" }}>
      {diags.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 20px", color:T.textM }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
          <div style={{ fontSize:14 }}>{emptyMsg}</div>
        </div>
      ) : diags.map(d => {
        const vLabel = [d.vehicle?.year, d.vehicle?.make, d.vehicle?.model].filter(Boolean).join(" ") || "Unknown vehicle";
        const lastMsg = d.transcript?.filter(m=>m.role==="assistant").slice(-1)[0]?.content || "";
        return (
          <div key={d.id} onClick={() => onSelect(d)}
            style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14,
              padding:"14px 16px", marginBottom:10, cursor:"pointer" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800, color:T.text }}>{vLabel}</div>
                <div style={{ fontSize:10, color:T.textM, marginTop:2 }}>{fmtDate(d.startedAt)}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                <Badge color={d.confidence>=95?T.green:d.confidence>=70?T.accent:T.blue}>
                  {d.confidence||0}%
                </Badge>
                {d.completed && <Badge color={T.green}>Done</Badge>}
              </div>
            </div>
            {lastMsg && (
              <div style={{ fontSize:11, color:T.textM, marginTop:8, lineHeight:1.5,
                overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box",
                WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
                {lastMsg.slice(0,120)}{lastMsg.length>120?"…":""}
              </div>
            )}
            {d.diagnosis && (
              <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
                <Badge color={d.diagnosis.severity==="critical"?T.red:d.diagnosis.severity==="high"?T.accent:T.green}>
                  {d.diagnosis.severity?.toUpperCase()} SEVERITY
                </Badge>
                <Badge color={T.blue}>${d.diagnosis.workOrders?.reduce((s,wo)=>s+(wo.estimatedTotalCost||0),0)||0} est.</Badge>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

// ── DIAGNOSIS CHAT ────────────────────────────────────────────────────────────
const DiagChat = ({ diag: diagIn, onBack, onSave }) => {
  const [diag, setDiag] = useState(() => diagIn || {
    id: genId(), startedAt: now(), vehicle: null, transcript: [],
    apiMessages: [], confidence: 0, done: false, diagnosis: null, completed: false,
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(!!diagIn?.diagnosis);
  const [askRediag, setAskRediag] = useState(diagIn?.completed || false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [diag.transcript, loading]);

  const updateAndSave = (updated) => {
    setDiag(updated);
    onSave(updated);
  };

  const send = async (text) => {
    if (!text.trim() || loading) return;
    setInput("");
    setLoading(true);
    const userMsg = { role:"user", content: text.trim() };
    const newTranscript = [...diag.transcript, userMsg];
    const newApi = [...diag.apiMessages, userMsg];
    setDiag(d => ({ ...d, transcript: newTranscript }));

    try {
      const parsed = await callHank(newApi, buildHankSystem(diag.vehicle, diag.transcript));
      const assistantMsg = { role:"assistant", content: parsed.message || "Let me think about that…" };
      const updatedVehicle = parsed.vehicleUpdate
        ? { ...(diag.vehicle||{}), ...Object.fromEntries(Object.entries(parsed.vehicleUpdate).filter(([,v])=>v)) }
        : diag.vehicle;

      const updated = {
        ...diag,
        transcript: [...newTranscript, assistantMsg],
        apiMessages: [...newApi, assistantMsg],
        vehicle: updatedVehicle,
        confidence: parsed.confidence ?? diag.confidence,
        done: parsed.done || false,
        diagnosis: parsed.done && parsed.diagnosis ? parsed.diagnosis : diag.diagnosis,
      };
      updateAndSave(updated);
      if (parsed.done && parsed.diagnosis) setShowResult(true);
    } catch(e) {
      const errMsg = { role:"assistant", content:"Connection issue — please try again." };
      setDiag(d => ({ ...d, transcript:[...newTranscript, errMsg] }));
    }
    setLoading(false);
  };

  // Ask re-diagnose for completed diag
  if (askRediag) {
    return (
      <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ fontSize:36, marginBottom:12 }}>🔄</div>
        <div style={{ fontSize:22, fontWeight:900, color:T.text, fontFamily:"'Bebas Neue',sans-serif",
          letterSpacing:"0.06em", marginBottom:8, textAlign:"center" }}>RE-DIAGNOSE?</div>
        <div style={{ fontSize:13, color:T.textM, textAlign:"center", marginBottom:28, lineHeight:1.6 }}>
          This diagnosis was already completed. Start a new session? Your previous results will be preserved.
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", maxWidth:300 }}>
          <Btn full onClick={() => {
            setDiag(d => ({ ...d, id:genId(), startedAt:now(), transcript:[], apiMessages:[],
              confidence:0, done:false, completed:false,
              previousDiagnosis: d.diagnosis, diagnosis:null }));
            setAskRediag(false); setShowResult(false);
          }}>Yes — Start Fresh Session</Btn>
          <Btn full variant="ghost" onClick={() => { setAskRediag(false); setShowResult(true); }}>
            No — View Previous Results
          </Btn>
          <Btn full variant="ghost" onClick={onBack}>← Back</Btn>
        </div>
      </div>
    );
  }

  if (showResult && diag.diagnosis) {
    return <DiagResult diag={diag} onBack={() => setShowResult(false)} onComplete={(d) => { updateAndSave(d); onBack(); }} />;
  }

  const vLabel = [diag.vehicle?.year, diag.vehicle?.make, diag.vehicle?.model].filter(Boolean).join(" ") || null;

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column" }}>
      {/* Header */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`,
        padding:"12px 16px", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
          <button onClick={onBack} style={{ background:"none", border:"none", color:T.accent,
            cursor:"pointer", fontSize:20, padding:0 }}>←</button>
          <div style={{ fontSize:14, fontWeight:800, color:T.text }}>
            {vLabel || "New Diagnosis"}
          </div>
          <div style={{ width:28 }} />
        </div>
        <ConfBar pct={diag.confidence} />
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px", display:"flex",
        flexDirection:"column", gap:12 }}>
        {diag.transcript.length === 0 && (
          <div style={{ textAlign:"center", padding:"32px 20px" }}>
            <div style={{ fontSize:40, marginBottom:10 }}>🔧</div>
            <div style={{ fontSize:16, fontWeight:800, color:T.text, marginBottom:6 }}>Master Tech Ready</div>
            <div style={{ fontSize:12, color:T.textM, lineHeight:1.6 }}>
              Describe your vehicle and what's going on. I'll ask the right questions to pinpoint the problem.
            </div>
          </div>
        )}
        {diag.transcript.map((m, i) => (
          <div key={i} style={{ display:"flex", justifyContent: m.role==="user"?"flex-end":"flex-start", gap:8, alignItems:"flex-end" }}>
            {m.role === "assistant" && (
              <div style={{ width:32, height:32, borderRadius:"50%", background:G.accent,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:14, flexShrink:0 }}>🔧</div>
            )}
            <div style={{ maxWidth:"82%", padding:"11px 14px",
              borderRadius: m.role==="user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: m.role==="user" ? G.blue : T.card,
              border: `1px solid ${m.role==="user" ? T.blue+"40" : T.border}`,
              fontSize:13, color:T.text, lineHeight:1.6 }}>
              {m.role === "assistant" && (
                <div style={{ fontSize:9, color:T.accent, fontWeight:800,
                  textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>MASTER TECH</div>
              )}
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:G.accent,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🔧</div>
            <div style={{ padding:"11px 16px", borderRadius:"16px 16px 16px 4px",
              background:T.card, border:`1px solid ${T.border}`, display:"flex", gap:5, alignItems:"center" }}>
              {[0,0.2,0.4].map((delay,i) => (
                <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:T.accent,
                  animation:`blink 1s ease ${delay}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        {diag.confidence >= 95 && !diag.done && (
          <div onClick={() => send("Please finalize your diagnosis and generate the work order.")}
            style={{ background:`linear-gradient(135deg,#1a2a1a,#1a2235)`,
              border:`2px solid ${T.green}50`, borderRadius:14, padding:"14px 16px",
              cursor:"pointer", textAlign:"center" }}>
            <div style={{ fontSize:13, fontWeight:800, color:T.green }}>✓ 95%+ Confidence Reached</div>
            <div style={{ fontSize:11, color:T.textM, marginTop:3 }}>Tap to finalize diagnosis & generate work order</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ background:T.surface, borderTop:`1px solid ${T.border}`,
        padding:"12px 16px", display:"flex", gap:8, alignItems:"flex-end" }}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send(input); }}}
          placeholder="Describe the symptom…"
          rows={2}
          style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:12,
            padding:"10px 14px", color:T.text, fontSize:13, fontFamily:"inherit",
            outline:"none", resize:"none", lineHeight:1.5 }} />
        <button onClick={() => send(input)} disabled={!input.trim() || loading}
          style={{ background:input.trim()&&!loading ? G.accent : T.border, border:"none",
            borderRadius:12, width:44, height:44, cursor:input.trim()&&!loading?"pointer":"default",
            fontSize:18, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
          →
        </button>
      </div>
    </div>
  );
};

// ── DIAGNOSIS RESULT / VEHICLE CARD ─────────────────────────────────────────
const DiagResult = ({ diag, onBack, onComplete }) => {
  const [expandedWO, setExpandedWO] = useState(0);
  const [partSearch, setPartSearch] = useState(null);
  const [completingWO, setCompletingWO] = useState(null);
  const [actualCost, setActualCost] = useState("");
  const [completedWOs, setCompletedWOs] = useState(new Set());

  const d = diag.diagnosis;
  const v = diag.vehicle || {};
  const vLabel = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
  const totalEst = d.workOrders?.reduce((s,wo)=>s+(wo.estimatedTotalCost||0),0) || 0;
  const sevColor = { critical:T.red, high:T.accent, medium:T.blue, low:T.green }[d.severity] || T.blue;

  // Part search modal
  if (partSearch) {
    return (
      <div style={{ minHeight:"100vh", background:T.bg, padding:"0 0 40px" }}>
        <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`,
          padding:"12px 16px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 }}>
          <button onClick={() => setPartSearch(null)} style={{ background:"none", border:"none",
            color:T.accent, cursor:"pointer", fontSize:20 }}>←</button>
          <div style={{ fontSize:15, fontWeight:800, color:T.text }}>Find This Part</div>
        </div>
        <div style={{ padding:"20px 16px" }}>
          <div style={{ background:T.card, borderRadius:14, padding:"14px 16px", marginBottom:16 }}>
            <div style={{ fontSize:16, fontWeight:800, color:T.text }}>{partSearch.name}</div>
            {partSearch.partNumber && <div style={{ fontSize:11, color:T.textM, marginTop:2 }}>Part #: {partSearch.partNumber}</div>}
            <div style={{ fontSize:12, color:T.accent, fontWeight:700, marginTop:4 }}>
              Est. ${partSearch.estimatedCost}
            </div>
          </div>

          <div style={{ fontSize:12, fontWeight:700, color:T.textM, textTransform:"uppercase",
            letterSpacing:"0.08em", marginBottom:12 }}>Shop at These Retailers</div>

          {PART_STORES.map(store => (
            <a key={store.name} href={getPartSearchUrl(store, partSearch, v)} target="_blank" rel="noreferrer"
              style={{ display:"flex", alignItems:"center", gap:14, background:T.card,
                border:`1px solid ${T.border}`, borderRadius:14, padding:"14px 16px",
                marginBottom:8, textDecoration:"none", color:"inherit" }}>
              <div style={{ fontSize:24, width:36, textAlign:"center", flexShrink:0 }}>{store.logo}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:800, color:T.text }}>{store.name}</div>
                <div style={{ fontSize:11, color:T.textM }}>Tap to search →</div>
              </div>
              <div style={{ background:store.color, color:"#fff", borderRadius:8,
                padding:"4px 10px", fontSize:11, fontWeight:700 }}>Shop</div>
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:T.bg, padding:"0 0 80px" }}>
      {/* Header */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`,
        padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:10 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:T.accent,
          cursor:"pointer", fontSize:20, padding:0 }}>←</button>
        <div style={{ fontSize:14, fontWeight:800, color:T.text }}>Diagnosis Results</div>
        <div style={{ width:28 }} />
      </div>

      <div style={{ padding:"16px 16px" }}>
        {/* Vehicle card */}
        <div style={{ background:`linear-gradient(135deg,#1a2235,#111827)`,
          border:`2px solid ${sevColor}50`, borderRadius:18, padding:"18px 18px", marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:11, color:T.textM, textTransform:"uppercase", letterSpacing:"0.08em" }}>Vehicle</div>
              <div style={{ fontSize:20, fontWeight:900, color:T.text }}>{vLabel || "Unknown Vehicle"}</div>
              {v.mileage && <div style={{ fontSize:11, color:T.textM }}>{parseInt(v.mileage).toLocaleString()} miles</div>}
            </div>
            <Badge color={sevColor}>{d.severity?.toUpperCase()}</Badge>
          </div>

          <div style={{ background:T.bg, borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:800, color:T.text, marginBottom:4 }}>{d.title}</div>
            <div style={{ fontSize:12, color:T.textM, lineHeight:1.6 }}>{d.summary}</div>
          </div>

          {/* Cost + time summary */}
          <div style={{ display:"flex", gap:10 }}>
            <div style={{ flex:1, background:T.bg, borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
              <div style={{ fontSize:20, fontWeight:900, color:T.accent }}>${totalEst}</div>
              <div style={{ fontSize:9, color:T.textM, textTransform:"uppercase" }}>Est. Total</div>
            </div>
            <div style={{ flex:1, background:T.bg, borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
              <div style={{ fontSize:20, fontWeight:900, color:T.blue }}>
                {d.workOrders?.reduce((s,wo)=>s+(wo.estimatedHours||0),0).toFixed(1)}h
              </div>
              <div style={{ fontSize:9, color:T.textM, textTransform:"uppercase" }}>Est. Time</div>
            </div>
            <div style={{ flex:1, background:T.bg, borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
              <div style={{ fontSize:20, fontWeight:900, color:T.green }}>{diag.confidence}%</div>
              <div style={{ fontSize:9, color:T.textM, textTransform:"uppercase" }}>Confidence</div>
            </div>
          </div>
        </div>

        {/* Re-diagnose */}
        <Btn full variant="ghost" onClick={onBack} sx={{ marginBottom:16 }}>
          🔄 Continue / Re-Diagnose
        </Btn>

        {/* Work Orders */}
        <div style={{ fontSize:12, fontWeight:800, color:T.textM, textTransform:"uppercase",
          letterSpacing:"0.08em", marginBottom:10 }}>
          Work Orders ({d.workOrders?.length || 0})
        </div>

        {d.workOrders?.map((wo, wi) => {
          const isExpanded = expandedWO === wi;
          const isDone = completedWOs.has(wi);
          return (
            <div key={wi} style={{ background:T.card, border:`1px solid ${isDone?T.green+"50":T.border}`,
              borderRadius:16, marginBottom:10, overflow:"hidden" }}>
              {/* WO Header */}
              <div onClick={() => setExpandedWO(isExpanded ? null : wi)}
                style={{ padding:"14px 16px", cursor:"pointer", display:"flex",
                  justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:isDone?T.green:T.text }}>{wo.title}</div>
                  <div style={{ fontSize:10, color:T.textM, marginTop:3, display:"flex", gap:8 }}>
                    <span>${wo.estimatedTotalCost} est.</span>
                    <span>{wo.estimatedHours}h</span>
                    <span style={{ color: wo.difficulty==="DIY"?T.green:wo.difficulty==="professional"?T.red:T.accent }}>
                      {wo.difficulty}
                    </span>
                  </div>
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  {isDone && <Badge color={T.green}>✓ Done</Badge>}
                  <span style={{ color:T.textM, fontSize:14 }}>{isExpanded?"▲":"▼"}</span>
                </div>
              </div>

              {/* WO Detail */}
              {isExpanded && (
                <div style={{ borderTop:`1px solid ${T.border}`, padding:"14px 16px" }}>
                  <div style={{ fontSize:12, color:T.textM, marginBottom:14, lineHeight:1.6 }}>
                    {wo.description}
                  </div>

                  {/* Parts */}
                  {wo.parts?.length > 0 && (
                    <>
                      <div style={{ fontSize:11, fontWeight:800, color:T.textM,
                        textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Parts Needed</div>
                      {wo.parts.map((part, pi) => (
                        <div key={pi} onClick={() => setPartSearch(part)}
                          style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                            background:T.bg, borderRadius:10, padding:"10px 12px", marginBottom:6,
                            cursor:"pointer", border:`1px solid ${T.border}` }}>
                          <div>
                            <div style={{ fontSize:12, fontWeight:700, color:T.text }}>{part.name}</div>
                            {part.partNumber && <div style={{ fontSize:10, color:T.textM }}>#{part.partNumber}</div>}
                          </div>
                          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                            <div style={{ fontSize:13, fontWeight:800, color:T.accent }}>${part.estimatedCost}</div>
                            <div style={{ fontSize:11, color:T.blue, fontWeight:700 }}>Find →</div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Steps */}
                  {wo.steps?.length > 0 && (
                    <>
                      <div style={{ fontSize:11, fontWeight:800, color:T.textM,
                        textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8, marginTop:14 }}>Repair Steps</div>
                      {wo.steps.map((step, si) => (
                        <div key={si} style={{ display:"flex", gap:10, marginBottom:8, alignItems:"flex-start" }}>
                          <div style={{ width:22, height:22, borderRadius:"50%", background:G.blue, flexShrink:0,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:10, fontWeight:800, color:"#fff" }}>{si+1}</div>
                          <div style={{ fontSize:12, color:T.text, lineHeight:1.6, flex:1 }}>{step}</div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Complete WO */}
                  {!isDone && (
                    completingWO === wi ? (
                      <div style={{ background:T.bg, borderRadius:12, padding:"14px", marginTop:14 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:10 }}>Mark Complete</div>
                        <input value={actualCost} onChange={e => setActualCost(e.target.value)}
                          placeholder={`Actual cost (est. $${wo.estimatedTotalCost})`}
                          type="number"
                          style={{ width:"100%", background:T.card, border:`1px solid ${T.border}`,
                            borderRadius:8, padding:"9px 12px", color:T.text, fontSize:12,
                            fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:10 }} />
                        <div style={{ display:"flex", gap:8 }}>
                          <Btn size="sm" variant="green" onClick={() => {
                            setCompletedWOs(prev => new Set([...prev, wi]));
                            setCompletingWO(null);
                            setActualCost("");
                            if (completedWOs.size + 1 >= d.workOrders.length) {
                              onComplete({ ...diag, completed: true, completedAt: now(), actualCost: parseFloat(actualCost)||wo.estimatedTotalCost });
                            }
                          }}>✓ Save</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setCompletingWO(null)}>Cancel</Btn>
                        </div>
                      </div>
                    ) : (
                      <Btn size="sm" variant="green" sx={{ marginTop:14, width:"100%" }}
                        onClick={() => setCompletingWO(wi)}>
                        ✓ Mark Work Order Complete
                      </Btn>
                    )
                  )}
                  {isDone && (
                    <div style={{ background:T.green+"15", border:`1px solid ${T.green}30`,
                      borderRadius:10, padding:"10px 14px", marginTop:14, fontSize:12, color:T.green, fontWeight:700 }}>
                      ✅ Completed
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Save button */}
        {!diag.completed && (
          <Btn full variant="accent" sx={{ marginTop:8 }}
            onClick={() => onComplete({ ...diag, saved: true })}>
            💾 Save Vehicle & Work Orders
          </Btn>
        )}
      </div>
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function MobileMasterTech() {
  const [data, setData] = useState(() => {
    const d = loadData();
    return {
      sub: d.sub || null,
      diags: d.diags || [],
    };
  });

  const [screen, setScreen] = useState("home"); // home | chat | list | done
  const [activeDiag, setActiveDiag] = useState(null);

  const persist = (newData) => {
    setData(newData);
    saveData(newData);
  };

  const saveDiag = (diag) => {
    const existing = data.diags.findIndex(d => d.id === diag.id);
    const newDiags = existing >= 0
      ? data.diags.map((d,i) => i === existing ? diag : d)
      : [diag, ...data.diags];
    persist({ ...data, diags: newDiags });
  };

  if (!data.sub || !checkAccess(data.sub)) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600;700&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: ${T.bg}; color: ${T.text}; font-family: 'IBM Plex Mono', monospace; }
          @keyframes blink { 0%,100%{opacity:1}50%{opacity:0.15} }
        `}</style>
        <SubScreen onSubscribe={sub => persist({ ...data, sub })} />
      </>
    );
  }

  const openDiags = data.diags.filter(d => !d.completed);
  const doneDiags = data.diags.filter(d => d.completed);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${T.bg}; color: ${T.text}; font-family: 'IBM Plex Mono', monospace; -webkit-text-size-adjust: 100%; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${T.surface}; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }
        textarea { caret-color: ${T.accent}; }
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:0.2} }
        a { color: inherit; }
      `}</style>

      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {screen === "home" && (
          <HomeScreen sub={data.sub} diags={data.diags}
            onStartDiag={() => { setActiveDiag(null); setScreen("chat"); }}
            onViewOpen={() => setScreen("open")}
            onViewDone={() => setScreen("done")}
            onManageSub={() => persist({ ...data, sub: null })}
          />
        )}
        {screen === "chat" && (
          <DiagChat diag={activeDiag}
            onBack={() => setScreen("home")}
            onSave={(d) => { saveDiag(d); setActiveDiag(d); }}
          />
        )}
        {screen === "open" && (
          <DiagList title="Open Jobs" diags={openDiags}
            emptyMsg="No open diagnoses. Start a new one!"
            onBack={() => setScreen("home")}
            onSelect={d => { setActiveDiag(d); setScreen("chat"); }}
          />
        )}
        {screen === "done" && (
          <DiagList title="Completed Jobs" diags={doneDiags}
            emptyMsg="No completed jobs yet."
            onBack={() => setScreen("home")}
            onSelect={d => { setActiveDiag(d); setScreen("chat"); }}
          />
        )}
      </div>
    </>
  );
}
