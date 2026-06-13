// export default function Sidebar() {
//   return (
//     <aside>
//       Sidebar
//     </aside>
//   );
// }
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NAV_ITEMS = [
  { href: "/dashboard",   label: "Dashboard",    icon: "⬡" },
  { href: "/scan",        label: "New Scan",      icon: "◎" },
  { href: "/reports",     label: "Reports",       icon: "▦" },
  { href: "/monitoring",  label: "Monitoring",    icon: "◈" },
  { href: "/settings",    label: "Settings",      icon: "⚙" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');

        .sidebar-root {
          width: 240px;
          min-height: 100vh;
          background: #080d1e;
          border-right: 1px solid rgba(0,255,156,0.12);
          display: flex;
          flex-direction: column;
          padding: 0;
          position: relative;
          flex-shrink: 0;
          overflow: hidden;
        }

        .sidebar-root::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background:
            linear-gradient(180deg, rgba(0,255,156,0.04) 0%, transparent 60%);
          pointer-events: none;
        }

        .sidebar-brand {
          padding: 28px 24px 24px;
          border-bottom: 1px solid rgba(0,255,156,0.1);
        }

        .brand-label {
          font-family: 'Orbitron', monospace;
          font-size: 1.6rem;
          font-weight: 900;
          color: #00FF9C;
          letter-spacing: 4px;
          text-shadow: 0 0 20px rgba(0,255,156,0.5);
          line-height: 1;
          display: block;
        }

        .brand-sub {
          font-family: 'Courier New', monospace;
          font-size: 0.6rem;
          letter-spacing: 0.25em;
          color: rgba(255,255,255,0.25);
          margin-top: 6px;
          display: block;
        }

        .sidebar-status {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 10px;
        }

        .status-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #00FF9C;
          animation: pulse-dot 2s ease-in-out infinite;
        }

        @keyframes pulse-dot {
          0%,100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0,255,156,0.6); }
          50%      { opacity: 0.7; box-shadow: 0 0 0 4px rgba(0,255,156,0); }
        }

        .status-text {
          font-family: 'Courier New', monospace;
          font-size: 0.6rem;
          letter-spacing: 0.15em;
          color: #00FF9C;
        }

        .nav-section {
          padding: 20px 16px;
          flex: 1;
        }

        .nav-label {
          font-family: 'Courier New', monospace;
          font-size: 0.55rem;
          letter-spacing: 0.3em;
          color: rgba(255,255,255,0.2);
          padding: 0 8px;
          margin-bottom: 8px;
          display: block;
        }

        .nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 4px;
          text-decoration: none;
          font-family: 'Courier New', monospace;
          font-size: 0.78rem;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.45);
          margin-bottom: 2px;
          transition: color 0.2s;
          border: 1px solid transparent;
          overflow: hidden;
        }

        .nav-item:hover {
          color: #00FF9C;
          border-color: rgba(0,255,156,0.2);
          background: rgba(0,255,156,0.04);
        }

        .nav-item.active {
          color: #00FF9C;
          background: rgba(0,255,156,0.08);
          border-color: rgba(0,255,156,0.3);
        }

        .nav-item.active::before {
          content: '';
          position: absolute;
          left: 0; top: 0;
          width: 3px; height: 100%;
          background: #00FF9C;
          box-shadow: 0 0 10px rgba(0,255,156,0.8);
        }

        .nav-icon {
          font-size: 0.9rem;
          width: 16px;
          text-align: center;
          flex-shrink: 0;
        }

        .nav-arrow {
          margin-left: auto;
          font-size: 0.6rem;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .nav-item:hover .nav-arrow,
        .nav-item.active .nav-arrow {
          opacity: 1;
        }

        .sidebar-footer {
          padding: 16px;
          border-top: 1px solid rgba(0,255,156,0.08);
        }

        .system-info {
          background: rgba(0,255,156,0.04);
          border: 1px solid rgba(0,255,156,0.12);
          border-radius: 4px;
          padding: 10px 12px;
        }

        .sys-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: 'Courier New', monospace;
          font-size: 0.6rem;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.3);
          margin-bottom: 4px;
        }

        .sys-row:last-child { margin-bottom: 0; }

        .sys-val {
          color: #00FF9C;
        }

        .threat-level {
          display: flex;
          gap: 3px;
          margin-top: 8px;
        }

        .threat-bar {
          height: 3px;
          flex: 1;
          border-radius: 1px;
          background: rgba(255,255,255,0.08);
        }

        .threat-bar.filled { background: #00FF9C; }
        .threat-bar.warn   { background: #facc15; }
        .threat-bar.crit   { background: #f87171; }
      `}</style>

      <aside className="sidebar-root">
        {/* Brand */}
        <div className="sidebar-brand">
          <motion.span
            className="brand-label"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            ROOT<span style={{ color: "#fff" }}>X</span>
          </motion.span>
          <span className="brand-sub">SECURITY PLATFORM v2.4</span>
          <div className="sidebar-status">
            <div className="status-dot" />
            <span className="status-text">SYSTEM ACTIVE</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="nav-section">
          <span className="nav-label">NAVIGATION</span>
          {NAV_ITEMS.map((item, i) => {
            const isActive = pathname === item.href;
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
              >
                <Link
                  href={item.href}
                  className={`nav-item ${isActive ? "active" : ""}`}
                  onMouseEnter={() => setHovered(item.href)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  <span className="nav-arrow">›</span>
                  <AnimatePresence>
                    {hovered === item.href && !isActive && (
                      <motion.span
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        exit={{ scaleX: 0 }}
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(0,255,156,0.03)",
                          transformOrigin: "left",
                          borderRadius: 4,
                        }}
                      />
                    )}
                  </AnimatePresence>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* Footer system info */}
        <div className="sidebar-footer">
          <div className="system-info">
            <div className="sys-row">
              <span>ENGINE</span>
              <span className="sys-val">ZAP + NMAP</span>
            </div>
            <div className="sys-row">
              <span>AI MODEL</span>
              <span className="sys-val">ONLINE</span>
            </div>
            <div className="sys-row">
              <span>THREAT LVL</span>
              <span className="sys-val" style={{ color: "#facc15" }}>MEDIUM</span>
            </div>
            <div className="threat-level">
              {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                <div
                  key={n}
                  className={`threat-bar ${
                    n <= 3 ? "filled" : n <= 6 ? "warn" : ""
                  }`}
                />
              ))}
            </div>
          </div>
        </div>   

      </aside>
    </>
  );
}
  