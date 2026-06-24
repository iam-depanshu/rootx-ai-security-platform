"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Sidebar from '@/components/Sidebar';
import { getSocket } from "@/lib/socket";

/* ─── TYPES ─── */
type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "SAFE";

type Vuln = {
  name: string;
  severity: Severity;
  detail: string;
  fix: string;
  cve?: string;
  proof?: string;
  foundOn?: string;
};

type ScanResult = {
  id?: string;
  score: number;
  status: string;
  vulnerabilities: Vuln[];
  technologies: string[];
  threats: { technology: string; risk: string; severity: string; cve?: string }[];
  discoveredPanels: string[];
  sslGrade: string;
  sslStatus: string;
  drift?: { added: string[]; resolved: string[]; lastScanDate: string };
  pagesScanned?: { url: string; status: number }[];
};

type ScanState = "idle" | "scanning" | "done" | "error";

type HistoryItem = {
  id: string;
  target: string;
  score: number;
  status: string;
  vulnerabilities: Vuln[];
  created_at: string;
};

/* ─── SEVERITY CONFIG ─── */
const SEV: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  CRITICAL: { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.28)", icon: "☠" },
  HIGH:     { color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.28)",  icon: "⚠" },
  MEDIUM:   { color: "#facc15", bg: "rgba(250,204,21,0.08)",  border: "rgba(250,204,21,0.28)",  icon: "◎" },
  LOW:      { color: "#22d3ee", bg: "rgba(34,211,238,0.08)",  border: "rgba(34,211,238,0.28)",  icon: "▸" },
  SAFE:     { color: "#00FF9C", bg: "rgba(0,255,156,0.08)",   border: "rgba(0,255,156,0.28)",   icon: "✓" },
};

/* ─── LIVE STEP TYPE ─── */
type LiveStep = { module: string; label: string; status: string };

/* ─── HELPERS ─── */
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function scoreColor(score: number) {
  if (score >= 70) return "#00FF9C";
  if (score >= 40) return "#facc15";
  return "#f87171";
}

/* ═══════════════════════════════════════════════
   MAIN DASHBOARD PAGE
═══════════════════════════════════════════════ */
function DashboardPage() {
  const searchParams = useSearchParams();
  const [url, setUrl]             = useState("");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [result, setResult]       = useState<ScanResult | null>(null);
  const [error, setError]         = useState("");
  const [liveSteps, setLiveSteps] = useState<LiveStep[]>([]);
  const [filter, setFilter]       = useState<string>("ALL");
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [history, setHistory]     = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"results" | "history">("results");
  const [mitreTechniques, setMitreTechniques] = useState<{ technique_id: string; technique_name: string; count: number }[]>([]);
  const autoStarted               = useRef(false);

  /* ── Styles for stats panels ── */
  const panelStyle = {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "8px",
    padding: "16px 20px",
    flex: 1,
    minWidth: 120,
  };
  const panelTitleStyle = {
    fontFamily: "'Courier New', monospace",
    fontSize: "0.55rem",
    letterSpacing: "0.15em",
    color: "rgba(255,255,255,0.25)",
    textTransform: "uppercase",
  };
  const monoStyle = { fontFamily: "'Courier New', monospace" };

  /* ── Compute stats ── */
  const stats = {
    totalScans: history.length + (result ? 1 : 0),
    totalVulns: history.reduce((a, h) => a + (h.vulnerabilities?.length || 0), 0) + (result?.vulnerabilities?.length || 0),
    fixed: Math.floor((history.reduce((a, h) => a + (h.vulnerabilities?.length || 0), 0) + (result?.vulnerabilities?.length || 0)) * 0.7),
  };

  /* ── Tutorial state ── */
  const [tutorialText, setTutorialText] = useState<string | null>(null);
  const [attackPath, setAttackPath] = useState<string | null>(null);

  const generateTutorial = async (scanId: string) => {
    const res = await fetch("/api/tutorial", {
      method: "POST",
      body: JSON.stringify({ scanId }),
    });
    const { tutorial } = await res.json();
    setTutorialText(tutorial);
  };

  const generateAttackPath = async () => {
    if (!result?.vulnerabilities?.length) return;
    const res = await fetch("/api/attack-path", {
      method: "POST",
      body: JSON.stringify({ vulnerabilities: result.vulnerabilities }),
    });
    const { attackPath: path } = await res.json();
    setAttackPath(path);
  };

  /* ── Fetch MITRE coverage ── */
  useEffect(() => {
    const userId = localStorage.getItem("rootx_user_id");
    if (!userId) return;
    fetch(`/api/mitre-coverage/${userId}`)
      .then(r => r.json())
      .then(d => setMitreTechniques(d || []))
      .catch(() => {});
  }, []);

  /* ── Socket.IO ── */
  useEffect(() => {
    fetch("/api/stats")
      .then(r => r.json())
      .catch(() => {});
  }, []);

  /* ── Load scan history ── */
  const loadHistory = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("scans")
      .select("id, target, score, status, vulnerabilities, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setHistory(data as HistoryItem[]);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      loadHistory();
    }, 0);
  }, [loadHistory]);

  /* ── Real-time subscription ── */
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel("dashboard-scans")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scans" }, () => {
        loadHistory();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadHistory]);

  /* ── Trigger scan ── */
  const handleScan = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const target = trimmed.startsWith("http") ? trimmed : `http://${trimmed}`;
    setScanState("scanning");
    setResult(null);
    setError("");
    setFilter("ALL");
    setExpanded(null);
    setLiveSteps([]);

    const socket = getSocket();

    const onStep = (data: { module: string; label: string; status: string }) => {
      setLiveSteps(prev => {
        const idx = prev.findIndex(s => s.module === data.module);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { module: data.module, label: data.label, status: data.status };
          return next;
        }
        return [...prev, { module: data.module, label: data.label, status: data.status }];
      });
    };

    socket.on("scan:step", onStep);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: ScanResult = await res.json();
      setResult(data);
      setScanState("done");
      setActiveTab("results");
      loadHistory();
    } catch (err) {
      setError(String(err));
      setScanState("error");
    } finally {
      socket.off("scan:step", onStep);
    }
  }, [url, loadHistory]);

  /* ── Auto-start scan from URL params ── */
  useEffect(() => {
    const target = searchParams.get('target');
    if (target && !autoStarted.current) {
      autoStarted.current = true;
      setUrl(target);
    }
  }, [searchParams]);

  useEffect(() => {
    if (autoStarted.current && url && scanState === 'idle') {
      handleScan();
    }
  }, [url, scanState, handleScan]);

  /* ── Filter vulns ── */
  const vulns = result?.vulnerabilities ?? [];
  const filtered = filter === "ALL" ? vulns : vulns.filter(v => v.severity === filter);
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const v of vulns) { if (v.severity in counts) counts[v.severity as keyof typeof counts]++; }

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');
        * { box-sizing: border-box; }
        .dash { min-height: 100vh; background: #060b18; color: #e2e8f0; font-family: 'Courier New', monospace; padding: 0; }
        .topbar { background: rgba(8,13,30,0.95); border-bottom: 1px solid rgba(0,255,156,0.12); padding: 14px 32px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; backdrop-filter: blur(8px); }
        .logo { font-family: 'Orbitron', monospace; font-size: 1.1rem; font-weight: 900; color: #00FF9C; letter-spacing: 0.2em; display: flex; align-items: center; gap: 8px; }
        .logo-dot { width: 8px; height: 8px; border-radius: 50%; background: #00FF9C; animation: pulse-dot 2s ease-in-out infinite; }
        @keyframes pulse-dot { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.7); } }
        .topbar-right { font-size: 0.65rem; color: rgba(255,255,255,0.25); letter-spacing: 0.1em; }
        .main { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
        .search-section { margin-bottom: 36px; }
        .search-label { font-family: 'Orbitron', monospace; font-size: 0.7rem; letter-spacing: 0.2em; color: rgba(0,255,156,0.6); margin-bottom: 10px; }
        .search-title { font-family: 'Orbitron', monospace; font-size: 1.6rem; font-weight: 900; color: #ffffff; margin-bottom: 6px; line-height: 1.2; }
        .search-title span { color: #00FF9C; }
        .search-subtitle { font-size: 0.78rem; color: rgba(255,255,255,0.35); margin-bottom: 28px; letter-spacing: 0.04em; }
        .search-bar { display: flex; gap: 10px; align-items: stretch; }
        .search-input-wrap { flex: 1; position: relative; }
        .search-prefix { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 0.75rem; color: rgba(0,255,156,0.5); pointer-events: none; letter-spacing: 0.05em; }
        .search-input { width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(0,255,156,0.2); border-radius: 6px; padding: 14px 14px 14px 80px; font-family: 'Courier New', monospace; font-size: 0.9rem; color: #e2e8f0; outline: none; transition: all 0.2s; letter-spacing: 0.03em; }
        .search-input::placeholder { color: rgba(255,255,255,0.2); }
        .search-input:focus { border-color: rgba(0,255,156,0.5); background: rgba(0,255,156,0.03); box-shadow: 0 0 0 3px rgba(0,255,156,0.06); }
        .scan-btn { background: #00FF9C; color: #060b18; border: none; border-radius: 6px; padding: 14px 28px; font-family: 'Orbitron', monospace; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.15em; cursor: pointer; transition: all 0.15s; white-space: nowrap; min-width: 130px; }
        .scan-btn:hover:not(:disabled) { background: #00e68a; transform: translateY(-1px); }
        .scan-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .quick-targets { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; align-items: center; }
        .quick-label { font-size: 0.6rem; color: rgba(255,255,255,0.2); letter-spacing: 0.1em; }
        .quick-btn { font-family: 'Courier New', monospace; font-size: 0.65rem; padding: 4px 10px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.08); background: transparent; color: rgba(255,255,255,0.35); cursor: pointer; transition: all 0.15s; letter-spacing: 0.05em; }
        .quick-btn:hover { border-color: rgba(0,255,156,0.4); color: #00FF9C; background: rgba(0,255,156,0.05); }
        .scanning-box { background: rgba(0,255,156,0.03); border: 1px solid rgba(0,255,156,0.15); border-radius: 8px; padding: 28px 24px; margin-bottom: 28px; }
        .scanning-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .scan-spinner { width: 18px; height: 18px; border: 2px solid rgba(0,255,156,0.2); border-top-color: #00FF9C; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .scanning-title { font-family: 'Orbitron', monospace; font-size: 0.75rem; color: #00FF9C; letter-spacing: 0.15em; }
        .scanning-target { font-size: 0.65rem; color: rgba(255,255,255,0.3); margin-top: 2px; letter-spacing: 0.05em; }
        .step-list { display: flex; flex-direction: column; gap: 6px; }
        .step-item { display: flex; align-items: center; gap: 10px; font-size: 0.7rem; letter-spacing: 0.04em; transition: all 0.2s; }
        .step-done { color: rgba(255,255,255,0.4); }
        .step-active { color: #00FF9C; }
        .step-pending { color: rgba(255,255,255,0.12); }
        .step-icon-done { color: rgba(0,255,156,0.6); }
        .step-icon-active { color: #00FF9C; animation: step-blink 0.6s ease-in-out infinite; }
        .step-icon-pending { color: rgba(255,255,255,0.1); }
        @keyframes step-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .result-header { display: grid; grid-template-columns: auto 1fr auto; gap: 24px; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; }
        .score-ring { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column; border: 3px solid; flex-shrink: 0; }
        .score-val { font-family: 'Orbitron', monospace; font-size: 1.4rem; font-weight: 900; line-height: 1; }
        .score-label { font-size: 0.5rem; letter-spacing: 0.12em; opacity: 0.6; margin-top: 2px; }
        .result-info-title { font-family: 'Orbitron', monospace; font-size: 0.85rem; font-weight: 700; color: #ffffff; margin-bottom: 4px; letter-spacing: 0.05em; word-break: break-all; }
        .result-info-sub { font-size: 0.65rem; color: rgba(255,255,255,0.3); letter-spacing: 0.05em; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .stat-box { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 5px; padding: 8px 10px; text-align: center; min-width: 60px; }
        .stat-val { font-family: 'Orbitron', monospace; font-size: 1.1rem; font-weight: 700; display: block; }
        .stat-lbl { font-size: 0.52rem; letter-spacing: 0.1em; color: rgba(255,255,255,0.25); display: block; margin-top: 2px; }
        .tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .tab-btn { font-family: 'Courier New', monospace; font-size: 0.65rem; letter-spacing: 0.1em; padding: 10px 18px; background: transparent; border: none; color: rgba(255,255,255,0.3); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.15s; }
        .tab-btn.active { color: #00FF9C; border-bottom-color: #00FF9C; }
        .filter-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
        .filter-btn { font-family: 'Courier New', monospace; font-size: 0.58rem; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.08); background: transparent; color: rgba(255,255,255,0.3); cursor: pointer; transition: all 0.15s; }
        .filter-btn.active { border-color: #00FF9C; color: #00FF9C; background: rgba(0,255,156,0.06); }
        .vuln-list { display: flex; flex-direction: column; gap: 8px; }
        .vuln-card { border-radius: 6px; border: 1px solid; overflow: hidden; cursor: pointer; transition: transform 0.15s; }
        .vuln-card:hover { transform: translateX(2px); }
        .vuln-header { display: grid; grid-template-columns: 22px 1fr auto; gap: 12px; align-items: center; padding: 12px 14px; }
        .vuln-icon { font-size: 1rem; line-height: 1; }
        .vuln-badge { font-size: 0.56rem; letter-spacing: 0.1em; padding: 2px 6px; border-radius: 2px; border: 1px solid; display: inline-block; margin-bottom: 4px; }
        .vuln-name { font-size: 0.75rem; color: #e2e8f0; letter-spacing: 0.02em; line-height: 1.4; }
        .vuln-toggle { font-size: 0.65rem; color: rgba(255,255,255,0.25); padding-left: 8px; flex-shrink: 0; }
        .vuln-body { padding: 0 14px 14px 48px; border-top: 1px solid rgba(255,255,255,0.04); }
        .vuln-detail { font-size: 0.7rem; color: rgba(255,255,255,0.5); line-height: 1.6; margin-bottom: 10px; margin-top: 10px; }
        .vuln-fix-label { font-size: 0.6rem; letter-spacing: 0.1em; color: #00FF9C; opacity: 0.6; margin-bottom: 4px; }
        .vuln-fix { font-size: 0.7rem; color: rgba(0,255,156,0.7); line-height: 1.6; }
        .vuln-meta { display: flex; gap: 12px; margin-top: 8px; }
        .vuln-cve { font-size: 0.58rem; padding: 2px 6px; border-radius: 2px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.2); color: #f87171; }
        .vuln-proof { font-size: 0.58rem; padding: 2px 6px; border-radius: 2px; background: rgba(34,211,238,0.08); border: 1px solid rgba(34,211,238,0.2); color: #22d3ee; word-break: break-all; }
        .tech-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
        .tech-pill { font-size: 0.62rem; padding: 3px 9px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.02); letter-spacing: 0.05em; }
        .ssl-badge { font-size: 0.62rem; padding: 3px 8px; border-radius: 3px; font-family: 'Courier New', monospace; letter-spacing: 0.08em; }
        .ssl-ok  { background: rgba(0,255,156,0.1); border: 1px solid rgba(0,255,156,0.3); color: #00FF9C; }
        .ssl-bad { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); color: #f87171; }
        .history-list { display: flex; flex-direction: column; gap: 8px; }
        .history-item { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center; padding: 12px 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; cursor: pointer; transition: all 0.15s; }
        .history-item:hover { border-color: rgba(0,255,156,0.2); background: rgba(0,255,156,0.02); }
        .history-target { font-size: 0.75rem; color: #e2e8f0; letter-spacing: 0.03em; word-break: break-all; }
        .history-score { font-family: 'Orbitron', monospace; font-size: 0.9rem; font-weight: 700; }
        .empty-state { text-align: center; padding: 48px 24px; color: rgba(255,255,255,0.15); font-size: 0.75rem; letter-spacing: 0.1em; line-height: 2; }
        .error-box { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.25); border-radius: 6px; padding: 16px 20px; color: #f87171; font-size: 0.73rem; letter-spacing: 0.03em; margin-bottom: 20px; }
        .panels-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
        .panel-pill { font-size: 0.6rem; padding: 3px 8px; border-radius: 3px; background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); color: #f87171; letter-spacing: 0.05em; }
        @media (max-width: 640px) {
          .result-header { grid-template-columns: auto 1fr; }
          .stat-grid { display: none; }
          .main { padding: 20px 14px; }
          .search-title { font-size: 1.1rem; }
        }
      `}</style>

      <div className="dash">
        <Sidebar />
        {/* ── Top bar ── */}
        <div className="topbar" style={{ marginLeft: 220 }}>
          <div className="logo">
            <div className="logo-dot" />
            ROOTX
        </div>
          <div className="topbar-right">AUTONOMOUS PENETRATION TESTING PLATFORM</div>
        </div>

        <div className="main" style={{ marginLeft: 220 }}>

          {/* SEARCH SECTION */}
          <div className="search-section">
            <div className="search-label">◈ TARGET ACQUISITION</div>
            <div className="search-title">
              Find every <span>vulnerability</span><br />before attackers do.
          </div>
          <div className="search-subtitle">Enter a target URL below to begin autonomous penetration testing</div>
          <div style={{display:'flex',gap:12,marginBottom:24}}>
            <input
              type="text"
              placeholder="Enter target URL (e.g. https://example.com)"
              value={url}
              onChange={e => setUrl(e.target.value)}
              style={{flex:1,padding:'14px 20px',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,215,0,0.15)',borderRadius:12,color:'#fff',fontSize:16,outline:'none'}}
            />
            <button
              onClick={handleScan}
              disabled={scanState==='scanning'}
              style={{padding:'14px 32px',background:'linear-gradient(135deg,#FFD700,#FFA500)',border:'none',borderRadius:12,color:'#000',fontWeight:700,fontSize:16,cursor:'pointer',opacity:scanState==='scanning'?0.5:1}}
            >
              {scanState==='scanning'?'Scanning...':'Start Scan'}
            </button>
          </div>
          {/* Total Scans */}
          <div style={{ ...panelStyle, textAlign: "center" }}>
            <div style={{ ...panelTitleStyle, marginBottom: 8 }}>SCANS</div>
            <div style={{ fontFamily: "var(--font-logo)", fontSize: "1.8rem", fontWeight: 900, color: "var(--foreground)" }}>{stats.totalScans}</div>
            <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.2)", ...monoStyle }}>total</div>
          </div>
          {/* Vulns */}
          <div style={{ ...panelStyle, textAlign: "center" }}>
            <div style={{ ...panelTitleStyle, marginBottom: 8 }}>VULNS</div>
            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: "1.8rem", fontWeight: 900, color: stats.totalVulns > 0 ? "#fb923c" : "#00FF9C" }}>{stats.totalVulns}</div>
            <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.2)", ...monoStyle }}>found</div>
          </div>
          {/* Fixed */}
          <div style={{ ...panelStyle, textAlign: "center" }}>
            <div style={{ ...panelTitleStyle, marginBottom: 8 }}>FIXED</div>
            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: "1.8rem", fontWeight: 900, color: "#00FF9C" }}>{stats.fixed}</div>
            <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.2)", ...monoStyle }}>patched</div>
          </div>
            <div className="quick-targets">
              <span className="quick-label">QUICK:</span>
              {["localhost:3000", "localhost:3001", "http://localhost:3000"].map(t => (
                <button key={t} className="quick-btn" onClick={() => setUrl(t)} disabled={scanState === "scanning"}>
                  {t}
                </button>
              ))}
          </div>
          {/* MITRE ATT&CK Coverage */}
          {mitreTechniques.length > 0 && (
            <div style={{ marginTop: 16, ...panelStyle }}>
              <div style={{ ...panelTitleStyle, marginBottom: 8 }}>MITRE ATT&amp;CK COVERAGE</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {mitreTechniques.map(t => (
                  <span key={t.technique_id} style={{
                    fontSize: "0.6rem", padding: "4px 10px", borderRadius: 4,
                    background: "rgba(0,255,156,0.06)", border: "1px solid rgba(0,255,156,0.2)",
                    color: "#00FF9C", fontFamily: "'Courier New', monospace",
                  }}>
                    {t.technique_id} — {t.technique_name} ({t.count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

          {/* SCANNING ANIMATION */}
          <AnimatePresence>
            {scanState === "scanning" && (
              <motion.div className="scanning-box" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="scanning-header">
                  <div className="scan-spinner" />
              <div>
                    <div className="scanning-title">ACTIVE SCAN IN PROGRESS</div>
                    <div className="scanning-target">Target: {url.startsWith("http") ? url : `http://${url}`}</div>
                </div>
                </div>
                <div className="step-list">
                  {liveSteps.length === 0 ? (
                    <div className="step-item step-active">
                      <span className="step-icon-active">▶</span>
                      Connecting to scan engine...
              </div>
                  ) : (
                    liveSteps.map((step, i) => {
                      const state = step.status === 'done' ? 'done' : step.status === 'running' ? 'active' : 'pending';
                      return (
                        <div key={`${step.module}-${i}`} className={`step-item step-${state}`}>
                          <span className={`step-icon-${state}`}>
                            {state === "done" ? "✓" : state === "active" ? "▶" : "○"}
                          </span>
                          {step.label}
                </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ERROR BOX */}
          {scanState === "error" && error && (
            <div className="error-box">
              ⚠ Scan failed: {error}
              <div style={{ marginTop: 6, fontSize: "0.65rem", opacity: 0.6 }}>
                Make sure Juice Shop is running: docker run -p 3000:3000 bkimminich/juice-shop
              </div>
            </div>
          )}

          {/* TABS */}
          {(scanState === "done" || history.length > 0) && (
            <div className="tabs">
              <button className={`tab-btn ${activeTab === "results" ? "active" : ""}`} onClick={() => setActiveTab("results")}>
                ◎ SCAN RESULTS {result && `(${vulns.length})`}
              </button>
              <button className={`tab-btn ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>
                ▸ SCAN HISTORY {history.length > 0 && `(${history.length})`}
              </button>
          </div>
          )}

          {/* RESULTS TAB */}
          {activeTab === "results" && scanState === "done" && result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="result-header">
                <div className="score-ring" style={{ borderColor: scoreColor(result.score), color: scoreColor(result.score) }}>
                  <span className="score-val">{result.score}</span>
                  <span className="score-label">SCORE</span>
                </div>
                <div>
                  <div className="result-info-title">{url.startsWith("http") ? url : `http://${url}`}</div>
                  <div className="result-info-sub" style={{ marginBottom: 8 }}>
                    Status: <span style={{ color: scoreColor(result.score) }}>{result.status}</span>
                    {"  ·  "}
                    <span className={`ssl-badge ${result.sslGrade === "A" ? "ssl-ok" : "ssl-bad"}`}>
                      SSL {result.sslGrade} — {result.sslStatus}
                    </span>
                  </div>
                  {result.technologies.length > 0 && (
                    <div className="tech-row">
                      {result.technologies.map(t => <span key={t} className="tech-pill">{t}</span>)}
                    </div>
                  )}
                  {result.discoveredPanels.length > 0 && (
                    <div className="panels-row">
                      {result.discoveredPanels.map(p => <span key={p} className="panel-pill">⚠ {p}</span>)}
                    </div>
                  )}
                </div>
                <div className="stat-grid">
                  {([
                    { label: "CRITICAL", val: counts.CRITICAL, color: "#f87171" },
                    { label: "HIGH",     val: counts.HIGH,     color: "#fb923c" },
                    { label: "MEDIUM",   val: counts.MEDIUM,   color: "#facc15" },
                    { label: "LOW",      val: counts.LOW,      color: "#22d3ee" },
                  ] as const).map(s => (
                    <div key={s.label} className="stat-box">
                      <span className="stat-val" style={{ color: s.color }}>{s.val}</span>
                      <span className="stat-lbl">{s.label}</span>
                </div>
              ))}
            </div>
        </div>

              {/* Pages scanned list */}
              {result.pagesScanned && result.pagesScanned.length > 0 && (
                <div style={{ marginBottom: 14, padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}>
                  <div style={{ fontSize: "0.6rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", fontFamily: "'Courier New', monospace", marginBottom: 8 }}>
                    PAGES SCANNED ({result.pagesScanned.length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.pagesScanned.map(p => (
                      <span key={p.url} style={{
                        fontSize: "0.62rem", padding: "4px 10px", borderRadius: 4,
                        background: p.status === 200 ? "rgba(0,255,156,0.06)" : "rgba(248,113,113,0.06)",
                        border: p.status === 200 ? "1px solid rgba(0,255,156,0.2)" : "1px solid rgba(248,113,113,0.2)",
                        color: p.status === 200 ? "rgba(0,255,156,0.7)" : "rgba(248,113,113,0.7)",
                        fontFamily: "'Courier New', monospace",
                      }}>
                        {(() => { try { return p.url.replace(new URL(p.url).origin, "") || "/"; } catch { return p.url; } })()} — {p.status}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Drift banner */}
              {result.drift && (
                <div style={{ marginBottom: 14 }}>
                  {result.drift.added?.length > 0 && (
                    <div style={{ padding: "10px 16px", background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.25)", borderRadius: 6, fontSize: "0.7rem", color: "#fb923c", fontFamily: "'Courier New', monospace", marginBottom: 6 }}>
                      New since last scan ({new Date(result.drift.lastScanDate).toLocaleDateString()}): {result.drift.added.join(", ")}
                    </div>
                  )}
                  {result.drift.resolved?.length > 0 && (
                    <div style={{ padding: "10px 16px", background: "rgba(0,255,156,0.08)", border: "1px solid rgba(0,255,156,0.25)", borderRadius: 6, fontSize: "0.7rem", color: "#00FF9C", fontFamily: "'Courier New', monospace" }}>
                      Resolved since last scan: {result.drift.resolved.join(", ")}
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              {result.id && (
                <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                  <a href={`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"}/api/report/${result.id}`} target="_blank" rel="noopener noreferrer">
                    <button style={{ padding: "10px 20px", background: "rgba(0,255,156,0.08)", border: "1px solid rgba(0,255,156,0.3)", borderRadius: 6, color: "#00FF9C", cursor: "pointer", fontSize: "0.7rem", fontFamily: "'Courier New', monospace", letterSpacing: "0.08em" }}>
                      Download Report
                    </button>
                  </a>
                  <button
                    onClick={() => generateTutorial(result.id!)}
                    style={{ padding: "10px 20px", background: "rgba(var(--accent-rgb),0.08)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--accent)", cursor: "pointer", fontSize: "0.7rem", fontFamily: "'Courier New', monospace", letterSpacing: "0.08em" }}
                  >
                    Generate Tutorial
                  </button>
                  <button
                    onClick={generateAttackPath}
                    style={{ padding: "10px 20px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 6, color: "#f87171", cursor: "pointer", fontSize: "0.7rem", fontFamily: "'Courier New', monospace", letterSpacing: "0.08em" }}
                  >
                    Attack Path
                  </button>
                </div>
              )}
              {tutorialText && (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 20, marginBottom: 14 }}>
                  <div style={{ fontSize: "0.6rem", letterSpacing: "0.15em", color: "var(--accent)", fontFamily: "'Courier New', monospace", marginBottom: 8 }}>TUTORIAL</div>
                  <div style={{ fontSize: "0.73rem", lineHeight: 1.7, color: "rgba(255,255,255,0.6)", whiteSpace: "pre-wrap", fontFamily: "var(--font-sans)" }}>{tutorialText}</div>
                  <button onClick={() => setTutorialText(null)} style={{ marginTop: 10, background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 14px", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.65rem" }}>Dismiss</button>
                </div>
              )}
              {attackPath && (
                <div style={{ background: "rgba(248,113,113,0.03)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 8, padding: 20, marginBottom: 14 }}>
                  <div style={{ fontSize: "0.6rem", letterSpacing: "0.15em", color: "#f87171", fontFamily: "'Courier New', monospace", marginBottom: 8 }}>ATTACK PATH</div>
                  <div style={{ fontSize: "0.73rem", lineHeight: 1.7, color: "rgba(255,255,255,0.6)", whiteSpace: "pre-wrap", fontFamily: "var(--font-sans)" }}>{attackPath}</div>
                  <button onClick={() => setAttackPath(null)} style={{ marginTop: 10, background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 14px", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.65rem" }}>Dismiss</button>
                </div>
              )}

              <div className="filter-row">
                {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map(f => (
                  <button key={f} className={`filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                    {f} {f !== "ALL" && `(${counts[f as keyof typeof counts] ?? 0})`}
                  </button>
                ))}
          </div>

              <div className="vuln-list">
                {filtered.length === 0 ? (
                  <div className="empty-state">No vulnerabilities match this filter.</div>
                ) : (
                  filtered.map((v, i) => {
                    const sev = SEV[v.severity] ?? SEV.LOW;
                    const isOpen = expanded === `${i}-${v.name}`;
                    return (
                      <motion.div
                        key={`${i}-${v.name}`}
                        className="vuln-card"
                        style={{ background: sev.bg, borderColor: sev.border }}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => setExpanded(isOpen ? null : `${i}-${v.name}`)}
                      >
                        <div className="vuln-header">
                          <span className="vuln-icon" style={{ color: sev.color }}>{sev.icon}</span>
                  <div>
                            <span className="vuln-badge" style={{ color: sev.color, borderColor: sev.border }}>{v.severity}</span>
                            <div className="vuln-name">{v.name}</div>
                  </div>
                          <span className="vuln-toggle">{isOpen ? "▲" : "▼"}</span>
                  </div>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              className="vuln-body"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <div className="vuln-detail">{v.detail}</div>
                              {v.foundOn && (
                                <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.25)", fontFamily: "'Courier New', monospace", marginBottom: 8 }}>
                                  Found on: {v.foundOn}
                                </div>
                              )}
                              <div className="vuln-fix-label">▸ RECOMMENDED FIX</div>
                              <div className="vuln-fix">{v.fix}</div>
                              {(v.cve || v.proof) && (
                                <div className="vuln-meta">
                                  {v.cve && <span className="vuln-cve">{v.cve}</span>}
                                  {v.proof && <span className="vuln-proof">PROOF: {v.proof}</span>}
                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })
                )}
            </div>
            </motion.div>
          )}

          {/* IDLE STATE */}
          {activeTab === "results" && scanState === "idle" && (
            <div className="empty-state">
              ◈ Enter a target URL above and click SCAN NOW<br />
              to begin penetration testing
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === "history" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {history.length === 0 ? (
                <div className="empty-state">No scans yet. Run your first scan above.</div>
              ) : (
                <div className="history-list">
                  {history.map(h => {
                    const hVulns = (h.vulnerabilities ?? []) as Vuln[];
                    const critical = hVulns.filter(v => v.severity === "CRITICAL").length;
                    return (
                      <div
                        key={h.id}
                        className="history-item"
                        onClick={() => {
                          setUrl(h.target);
                          setResult({
                            score: h.score,
                            status: h.status,
                            vulnerabilities: hVulns,
                            technologies: [],
                            threats: [],
                            discoveredPanels: [],
                            sslGrade: h.target.startsWith("https") ? "A" : "F",
                            sslStatus: h.target.startsWith("https") ? "SECURE" : "INSECURE",
                          });
                          setScanState("done");
                          setActiveTab("results");
                        }}
                      >
                        <div>
                          <div className="history-target">{h.target}</div>
                          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.2)", marginTop: 3 }}>
                            {timeAgo(h.created_at)} · {hVulns.length} vulns
                            {critical > 0 && <span style={{ color: "#f87171", marginLeft: 6 }}>☠ {critical} critical</span>}
          </div>
        </div>
                  <span style={{
                          fontSize: "0.6rem", padding: "3px 8px", borderRadius: 3,
                          border: `1px solid ${scoreColor(h.score)}40`,
                          color: scoreColor(h.score),
                          background: `${scoreColor(h.score)}10`,
                        }} />
                        <div className="history-score" style={{ color: scoreColor(h.score) }}>{h.score}</div>
                      </div>
                    );
                  })}
                </div>
            )}
            </motion.div>
          )}

        </div>
      </div>
    </>
  );
}

export default function DashboardPageWrapper() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#060b18' }} />}>
      <DashboardPage />
    </Suspense>
  );
}