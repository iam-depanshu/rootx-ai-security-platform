// export default function Navbar() {
//   return (
//     <header>
//       Navbar
//     </header>
//   );
// }
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const fmt = () => {
      const now = new Date();
      setTime(
        [
          now.getHours().toString().padStart(2, "0"),
          now.getMinutes().toString().padStart(2, "0"),
          now.getSeconds().toString().padStart(2, "0"),
        ].join(":")
      );
    };
    fmt();
    const id = setInterval(fmt, 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{time}</span>;
}

const ALERTS = [
  "SQL injection probe detected on /api/login",
  "Port scan from 192.168.1.104 blocked",
  "AI scan complete — 3 critical findings",
  "SSL cert expires in 12 days",
];

export default function Navbar() {
  const [alertIdx, setAlertIdx] = useState(0);
  const [scanActive, setScanActive] = useState(false);

  useEffect(() => {
    const id = setInterval(
      () => setAlertIdx((i) => (i + 1) % ALERTS.length),
      4000
    );
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap');

        .navbar-root {
          height: 60px;
          background: #080d1e;
          border-bottom: 1px solid rgba(0,255,156,0.12);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          position: sticky;
          top: 0;
          z-index: 50;
          gap: 16px;
        }

        .navbar-root::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0;
          height: 1px; width: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(0,255,156,0.4) 40%,
            rgba(0,255,156,0.4) 60%,
            transparent
          );
        }

        .nav-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .page-title {
          font-family: 'Orbitron', monospace;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: #fff;
          white-space: nowrap;
        }

        .divider {
          width: 1px;
          height: 20px;
          background: rgba(255,255,255,0.1);
          flex-shrink: 0;
        }

        .alert-ticker {
          font-family: 'Courier New', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.05em;
          color: rgba(255,255,255,0.35);
          overflow: hidden;
          max-width: 300px;
        }

        .alert-dot {
          display: inline-block;
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #facc15;
          margin-right: 6px;
          vertical-align: middle;
          animation: blink-dot 1.4s ease-in-out infinite;
        }

        @keyframes blink-dot {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.2; }
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .clock-chip {
          font-family: 'Courier New', monospace;
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          color: rgba(0,255,156,0.6);
          background: rgba(0,255,156,0.06);
          border: 1px solid rgba(0,255,156,0.15);
          border-radius: 3px;
          padding: 4px 10px;
          white-space: nowrap;
        }

        .ai-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'Courier New', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          color: #00FF9C;
          background: rgba(0,255,156,0.06);
          border: 1px solid rgba(0,255,156,0.25);
          border-radius: 3px;
          padding: 4px 10px;
        }

        .ai-ring {
          width: 8px; height: 8px;
          border-radius: 50%;
          border: 1.5px solid #00FF9C;
          animation: ai-spin 2s linear infinite;
        }

        @keyframes ai-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); border-color: #00FF9C transparent; }
        }

        .scan-btn {
          font-family: 'Orbitron', monospace;
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: #050816;
          background: #00FF9C;
          border: none;
          border-radius: 3px;
          padding: 6px 14px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .scan-btn:hover {
          background: #fff;
          box-shadow: 0 0 20px rgba(0,255,156,0.5);
        }

        .scan-btn.scanning {
          background: rgba(0,255,156,0.15);
          color: #00FF9C;
          border: 1px solid rgba(0,255,156,0.4);
          animation: scan-pulse 1s ease-in-out infinite;
        }

        @keyframes scan-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(0,255,156,0.4); }
          50%      { box-shadow: 0 0 0 6px rgba(0,255,156,0); }
        }

        .avatar {
          width: 32px; height: 32px;
          border-radius: 50%;
          border: 1.5px solid rgba(0,255,156,0.4);
          background: rgba(0,255,156,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Orbitron', monospace;
          font-size: 0.65rem;
          font-weight: 700;
          color: #00FF9C;
          cursor: pointer;
          flex-shrink: 0;
        }
      `}</style>

      <header className="navbar-root">
        {/* Left */}
        <div className="nav-left">
          <span className="page-title">SECURITY DASHBOARD</span>
          <div className="divider" />
          <div className="alert-ticker">
            <span className="alert-dot" />
            <AnimatePresence mode="wait">
              <motion.span
                key={alertIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
                style={{ display: "inline" }}
              >
                {ALERTS[alertIdx]}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Right */}
        <div className="nav-right">
          <div className="clock-chip">
            <LiveClock />
          </div>

          <div className="ai-chip">
            <div className="ai-ring" />
            AI ACTIVE
          </div>

          <button
            className={`scan-btn ${scanActive ? "scanning" : ""}`}
            onClick={() => {
              setScanActive(true);
              setTimeout(() => setScanActive(false), 4000);
            }}
          >
            {scanActive ? "◎ SCANNING..." : "⚡ NEW SCAN"}
          </button>

          <div className="avatar">RX</div>
        </div>
      </header>
    </>
  );
}