// type SecurityCardProps = {
//   title: string;
//   value: string;
//   color: string;
// };

// export default function SecurityCard({
//   title,
//   value,
//   color,
// }: SecurityCardProps) {
//   return (
//     <div className="bg-[#0B1120] border border-[#00FF9C]/10 rounded-xl p-6 hover:border-[#00FF9C]/40 transition duration-300">

//       <h3 className="text-gray-400 text-sm mb-3">
//         {title}
//       </h3>

//       <p className={`text-4xl font-bold ${color}`}>
//         {value}
//       </p>

//     </div>
//   );
// }
"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

type SecurityCardProps = {
  title: string;
  value: string;
  color?: string;
  icon?: string;
  trend?: "up" | "down" | "stable";
  trendVal?: string;
  subtext?: string;
  animate?: boolean;
  numericValue?: number;
};

function AnimatedNumber({ to }: { to: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.floor(v));
  const [val, setVal] = useState(0);

  useEffect(() => {
    const unsub = rounded.on("change", setVal);
    const ctrl = animate(count, to, { duration: 2, ease: "easeOut", delay: 0.4 });
    return () => { ctrl.stop(); unsub(); };
  }, [count, rounded, to]);

  return <span>{val}</span>;
}

const ACCENT_MAP: Record<string, string> = {
  green:  "#00FF9C",
  red:    "#f87171",
  cyan:   "#22d3ee",
  yellow: "#facc15",
  purple: "#a78bfa",
};

export default function SecurityCard({
  title,
  value,
  color = "green",
  icon = "◈",
  trend,
  trendVal,
  subtext,
  animate: doAnimate = false,
  numericValue,
}: SecurityCardProps) {
  const accent = ACCENT_MAP[color] ?? color;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');

        .sec-card {
          position: relative;
          background: #0a1128;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 6px;
          padding: 20px 22px;
          overflow: hidden;
          transition: border-color 0.25s, transform 0.2s;
          cursor: default;
        }

        .sec-card:hover {
          transform: translateY(-2px);
        }

        .sec-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 1px;
          background: linear-gradient(
            90deg, transparent, var(--card-accent), transparent
          );
          opacity: 0.6;
        }

        .sec-card::after {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 3px; height: 100%;
          background: var(--card-accent);
          box-shadow: 0 0 12px var(--card-accent);
        }

        .card-corner {
          position: absolute;
          bottom: 10px; right: 10px;
          width: 18px; height: 18px;
          border-right: 1px solid;
          border-bottom: 1px solid;
          opacity: 0.2;
          border-color: var(--card-accent);
        }

        .card-corner-tl {
          position: absolute;
          top: 10px; right: 10px;
          width: 10px; height: 10px;
          border-top: 1px solid;
          border-right: 1px solid;
          opacity: 0.15;
          border-color: var(--card-accent);
        }

        .card-glow {
          position: absolute;
          top: -30px; right: -30px;
          width: 120px; height: 120px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--card-accent) 0%, transparent 70%);
          opacity: 0.06;
          pointer-events: none;
        }

        .card-icon {
          font-size: 1rem;
          color: var(--card-accent);
          margin-bottom: 10px;
          opacity: 0.8;
          display: block;
        }

        .card-title {
          font-family: 'Courier New', monospace;
          font-size: 0.62rem;
          letter-spacing: 0.2em;
          color: rgba(255,255,255,0.35);
          text-transform: uppercase;
          margin-bottom: 10px;
          display: block;
        }

        .card-value {
          font-family: 'Orbitron', monospace;
          font-size: 2rem;
          font-weight: 900;
          color: var(--card-accent);
          text-shadow: 0 0 20px color-mix(in srgb, var(--card-accent) 50%, transparent);
          line-height: 1;
          display: block;
        }

        .card-trend {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 10px;
          font-family: 'Courier New', monospace;
          font-size: 0.62rem;
          letter-spacing: 0.08em;
        }

        .card-subtext {
          margin-top: 8px;
          font-family: 'Courier New', monospace;
          font-size: 0.6rem;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.2);
        }

        .mini-bars {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 20px;
          margin-top: 10px;
        }

        .mini-bar {
          flex: 1;
          border-radius: 1px;
          opacity: 0.35;
          background: var(--card-accent);
          transition: opacity 0.3s;
        }

        .mini-bar.active { opacity: 0.9; }
      `}</style>

      <motion.div
        className="sec-card"
        style={{ "--card-accent": accent } as React.CSSProperties}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        whileHover={{
          borderColor: `${accent}44`,
          boxShadow: `0 0 24px ${accent}18`,
        }}
      >
        <div className="card-glow" />
        <div className="card-corner" />
        <div className="card-corner-tl" />

        <span className="card-icon">{icon}</span>
        <span className="card-title">{title}</span>

        <span className="card-value">
          {doAnimate && numericValue !== undefined ? (
            <AnimatedNumber to={numericValue} />
          ) : (
            value
          )}
        </span>

        {trend && trendVal && (
          <div className="card-trend">
            <span style={{
              color: trend === "up"
                ? "#f87171"
                : trend === "down"
                ? "#00FF9C"
                : "#facc15",
            }}>
              {trend === "up" ? "▲" : trend === "down" ? "▼" : "●"}
            </span>
            <span style={{
              color: trend === "up" ? "#f87171" : trend === "down" ? "#00FF9C" : "#facc15"
            }}>
              {trendVal}
            </span>
            <span style={{ color: "rgba(255,255,255,0.25)" }}>vs last scan</span>
          </div>
        )}

        {subtext && <p className="card-subtext">{subtext}</p>}

        {/* Mini sparkline bars */}
        <div className="mini-bars">
          {[40, 65, 45, 80, 55, 70, 90, 60, 85, 100].map((h, i) => (
            <div
              key={i}
              className={`mini-bar ${i === 9 ? "active" : ""}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </motion.div>
    </>
  );
}