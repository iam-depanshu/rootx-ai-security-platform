"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Finding = {
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  message: string;
  data?: Record<string, string>;
};

type LogEntry = {
  requestId: string;
  timestamp: string;
  method: string;
  path: string;
  bodyPreview: string;
  findings: Finding[];
  response: {
    statusCode: number;
    findings: Finding[];
  } | null;
};

type StolenItem = {
  time: string;
  type: string;
  email?: string;
  password?: string;
  endpoint: string;
};

type MITMData = {
  active: boolean;
  target: string;
  requestCount: number;
  credentialsStolenCount: number;
  stolenData: StolenItem[];
  log: LogEntry[];
};

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "#f87171",
  HIGH:     "#fb923c",
  MEDIUM:   "#facc15",
};

export default function MITMPage() {
  const [data, setData]         = useState<MITMData | null>(null);
  const [proxyRunning, setProxyRunning] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [filter, setFilter]     = useState<"ALL" | "CRITICAL" | "HIGH">("ALL");
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Poll MITM proxy log every 2s */
  async function fetchLog() {
    try {
      const res = await fetch("http://localhost:8081/api/log");
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setProxyRunning(true);
      }
    } catch {
      setProxyRunning(false);
    }
  }

  useEffect(() => {
    fetchLog();
    intervalRef.current = setInterval(fetchLog, 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const filtered = (data?.log ?? []).filter(e => {
    if (filter === "ALL") return true;
    return e.findings?.some(f => f.severity === filter) ||
           e.response?.findings?.some(f => f.severity === filter);
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');
        * { box-sizing: border-box; }
        .mitm { min-height: 100vh; background: #060b18; color: #e2e8f0; font-family: 'Courier New', monospace; padding: 32px 24px; max-width: 1100px; margin: 0 auto; }
        .page-title { font-family: 'Orbitron', monospace; font-size: 1.1rem; font-weight: 900; color: #f87171; letter-spacing: .2em; margin-bottom: 4px; }
        .page-sub { font-size: .7rem; color: rgba(255,255,255,.3); letter-spacing: .08em; margin-bottom: 28px; line-height: 1.6; }
        .status-bar { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px; font-size: .72rem; letter-spacing: .06em; }
        .status-on  { background: rgba(248,113,113,.08); border: 1px solid rgba(248,113,113,.3); color: #f87171; }
        .status-off { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); color: rgba(255,255,255,.3); }
        .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dot-on  { background: #f87171; animation: blink 1s infinite; }
        .dot-off { background: rgba(255,255,255,.2); }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        .steps-box { background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.07); border-radius: 8px; padding: 20px 24px; margin-bottom: 24px; }
        .steps-title { font-size: .7rem; color: rgba(0,255,156,.7); letter-spacing: .15em; margin-bottom: 14px; }
        .step { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; font-size: .73rem; line-height: 1.5; }
        .step-num { width: 22px; height: 22px; border-radius: 50%; background: rgba(0,255,156,.1); border: 1px solid rgba(0,255,156,.3); color: #00FF9C; font-size: .62rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
        .step-code { background: rgba(0,0,0,.4); border: 1px solid rgba(255,255,255,.08); border-radius: 4px; padding: 8px 12px; font-family: 'Courier New', monospace; font-size: .7rem; color: #00FF9C; margin-top: 6px; }
        .stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 24px; }
        .stat { background: rgba(255,255,255,.02); border: 1px solid rgba(255,255,255,.06); border-radius: 6px; padding: 12px; text-align: center; }
        .stat-val { font-family: 'Orbitron', monospace; font-size: 1.5rem; font-weight: 700; display: block; }
        .stat-lbl { font-size: .55rem; letter-spacing: .1em; color: rgba(255,255,255,.25); margin-top: 4px; display: block; }
        .stolen-box { background: rgba(248,113,113,.07); border: 1px solid rgba(248,113,113,.3); border-radius: 8px; padding: 18px 20px; margin-bottom: 24px; }
        .stolen-title { font-family: 'Orbitron', monospace; font-size: .72rem; color: #f87171; letter-spacing: .15em; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .cred-row { background: rgba(248,113,113,.06); border: 1px solid rgba(248,113,113,.15); border-radius: 5px; padding: 10px 14px; margin-bottom: 6px; display: flex; gap: 16px; flex-wrap: wrap; align-items: center; font-size: .73rem; }
        .cred-email { color: #fb923c; }
        .cred-pass  { color: #f87171; font-weight: bold; font-size: .8rem; }
        .cred-time  { color: rgba(255,255,255,.25); font-size: .62rem; margin-left: auto; }
        .filters { display: flex; gap: 6px; margin-bottom: 14px; }
        .fbtn { font-family: 'Courier New', monospace; font-size: .6rem; letter-spacing: .08em; padding: 4px 10px; border-radius: 3px; border: 1px solid rgba(255,255,255,.08); background: transparent; color: rgba(255,255,255,.3); cursor: pointer; transition: all .15s; }
        .fbtn.active { border-color: #f87171; color: #f87171; background: rgba(248,113,113,.07); }
        .log-title { font-size: .72rem; color: rgba(0,255,156,.6); letter-spacing: .15em; margin-bottom: 10px; }
        .log-list { display: flex; flex-direction: column; gap: 6px; max-height: 500px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(248,113,113,.15) transparent; }
        .entry { border-radius: 5px; border: 1px solid rgba(255,255,255,.05); padding: 10px 14px; transition: all .15s; }
        .entry:hover { border-color: rgba(255,255,255,.1); }
        .entry.crit { border-color: rgba(248,113,113,.3); background: rgba(248,113,113,.05); }
        .entry.high { border-color: rgba(251,146,60,.25); background: rgba(251,146,60,.04); }
        .entry-top { display: grid; grid-template-columns: 50px 1fr 50px 80px; gap: 10px; align-items: center; }
        .method { font-size: .6rem; padding: 2px 6px; border-radius: 3px; background: rgba(0,255,156,.08); color: #00FF9C; border: 1px solid rgba(0,255,156,.2); text-align: center; }
        .epath { font-size: .72rem; color: #e2e8f0; word-break: break-all; }
        .estatus { font-size: .7rem; text-align: right; font-weight: bold; }
        .etime { font-size: .58rem; color: rgba(255,255,255,.2); text-align: right; }
        .finding-row { margin-top: 6px; font-size: .65rem; padding: 4px 8px; border-radius: 3px; display: flex; gap: 6px; align-items: center; }
        .empty { text-align: center; padding: 40px; color: rgba(255,255,255,.15); font-size: .75rem; letter-spacing: .1em; line-height: 2; }
      `}</style>

      <div className="mitm">
        <div className="page-title">☠ MITM ATTACK INTERCEPTOR</div>
        <div className="page-sub">
          Man-in-the-Middle proxy — intercepts ALL traffic between browser and Juice Shop.<br />
          Captures credentials, tokens, cookies in real time — exactly what a real attacker sees.
        </div>

        {/* Status */}
        <div className={`status-bar ${proxyRunning ? "status-on" : "status-off"}`}>
          <div className={`dot ${proxyRunning ? "dot-on" : "dot-off"}`} />
          {proxyRunning
            ? "● MITM PROXY ACTIVE — Traffic is being intercepted"
            : "○ MITM Proxy not running — Follow setup steps below"}
        </div>

        {/* Setup steps */}
        {!proxyRunning && (
          <div className="steps-box">
            <div className="steps-title">▸ HOW TO START MITM PROXY</div>
            <div className="step">
              <div className="step-num">1</div>
              <div>
                <div style={{ color: "#e2e8f0" }}>Open a <strong>new terminal</strong> in VS Code (keep npm run dev running)</div>
              </div>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <div>
                <div style={{ color: "#e2e8f0" }}>Navigate to your frontend folder and install the proxy package</div>
                <div className="step-code">cd D:\RootX\frontend{"\n"}npm install http-proxy</div>
              </div>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <div>
                <div style={{ color: "#e2e8f0" }}>Copy <code style={{color:"#00FF9C"}}>mitm-proxy.js</code> to <code style={{color:"#00FF9C"}}>D:\RootX\frontend\</code> then run:</div>
                <div className="step-code">node mitm-proxy.js</div>
              </div>
            </div>
            <div className="step">
              <div className="step-num">4</div>
              <div>
                <div style={{ color: "#e2e8f0" }}>Open browser → go to <strong style={{color:"#00FF9C"}}>http://localhost:8080</strong></div>
                <div style={{ color: "rgba(255,255,255,.4)", fontSize: ".68rem", marginTop: 4 }}>
                  This is Juice Shop running THROUGH the MITM proxy. Every action is intercepted.
                </div>
              </div>
            </div>
            <div className="step">
              <div className="step-num">5</div>
              <div>
                <div style={{ color: "#e2e8f0" }}>Log into Juice Shop on port 8080 — watch credentials get stolen live on this page</div>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {proxyRunning && data && (
          <>
            <div className="stats">
              <div className="stat">
                <span className="stat-val" style={{ color: "#00FF9C" }}>{data.requestCount}</span>
                <span className="stat-lbl">INTERCEPTED</span>
              </div>
              <div className="stat">
                <span className="stat-val" style={{ color: "#f87171" }}>{data.credentialsStolenCount}</span>
                <span className="stat-lbl">CREDENTIALS STOLEN</span>
              </div>
              <div className="stat">
                <span className="stat-val" style={{ color: "#fb923c" }}>
                  {data.log.filter(e => e.findings?.length > 0).length}
                </span>
                <span className="stat-lbl">SENSITIVE FINDINGS</span>
              </div>
              <div className="stat">
                <span className="stat-val" style={{ color: "#facc15" }}>
                  {data.log.filter(e => e.response?.statusCode === 200).length}
                </span>
                <span className="stat-lbl">200 OK RESPONSES</span>
              </div>
            </div>

            {/* Stolen credentials */}
            {data.stolenData.length > 0 && (
              <motion.div
                className="stolen-box"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="stolen-title">
                  ☠ STOLEN CREDENTIALS — ATTACKER NOW HAS THIS
                </div>
                {data.stolenData.map((s, i) => (
                  <div key={i} className="cred-row">
                    <span style={{ color: "rgba(255,255,255,.3)", fontSize: ".6rem" }}>EMAIL</span>
                    <span className="cred-email">{s.email}</span>
                    <span style={{ color: "rgba(255,255,255,.3)", fontSize: ".6rem" }}>PASSWORD</span>
                    <span className="cred-pass">{s.password}</span>
                    <span className="cred-time">{new Date(s.time).toLocaleTimeString()}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Filters */}
            <div className="filters">
              {(["ALL", "CRITICAL", "HIGH"] as const).map(f => (
                <button
                  key={f}
                  className={`fbtn ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
              <span style={{ fontSize: ".6rem", color: "rgba(255,255,255,.2)", marginLeft: 8, alignSelf: "center" }}>
                {filtered.length} requests
              </span>
            </div>

            {/* Log */}
            <div className="log-title">▸ LIVE INTERCEPT LOG</div>
            <div className="log-list">
              <AnimatePresence>
                {filtered.length === 0 ? (
                  <div className="empty">
                    No traffic yet.<br />
                    Go to http://localhost:8080 and use Juice Shop.<br />
                    Every request will appear here.
                  </div>
                ) : (
                  filtered.map((e, i) => {
                    const allFindings = [
                      ...(e.findings ?? []),
                      ...(e.response?.findings ?? []),
                    ];
                    const hasCrit = allFindings.some(f => f.severity === "CRITICAL");
                    const hasHigh = allFindings.some(f => f.severity === "HIGH");
                    const statusCode = e.response?.statusCode;
                    const statusColor = statusCode === 200 ? "#00FF9C" : statusCode && statusCode >= 400 ? "#f87171" : "#facc15";

                    return (
                      <motion.div
                        key={e.requestId}
                        className={`entry ${hasCrit ? "crit" : hasHigh ? "high" : ""}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      >
                        <div className="entry-top">
                          <span className="method">{e.method}</span>
                          <span className="epath">{e.path}</span>
                          <span className="estatus" style={{ color: statusColor }}>
                            {statusCode ?? "..."}
                          </span>
                          <span className="etime">
                            {new Date(e.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        {allFindings.map((f, fi) => (
                          <div
                            key={fi}
                            className="finding-row"
                            style={{
                              background: `${SEV_COLOR[f.severity]}0f`,
                              border: `1px solid ${SEV_COLOR[f.severity]}30`,
                              color: SEV_COLOR[f.severity],
                            }}
                          >
                            <span>{f.severity === "CRITICAL" ? "☠" : "⚠"}</span>
                            <span>{f.message}</span>
                          </div>
                        ))}
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </>
  );
}