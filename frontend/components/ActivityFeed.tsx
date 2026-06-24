"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ThreatEvent = {
  id: string;
  type: "SQLi" | "XSS" | "MITM" | "PORT" | "AUTH";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  source: string;
  target: string;
  timestamp: string;
  detail: string;
};

const severityStyles = {
  LOW: {
    color: "#00FF9C",
    border: "rgba(0,255,156,0.2)",
  },
  MEDIUM: {
    color: "#facc15",
    border: "rgba(250,204,21,0.2)",
  },
  HIGH: {
    color: "#fb923c",
    border: "rgba(251,146,60,0.2)",
  },
  CRITICAL: {
    color: "#ff3b3b",
    border: "rgba(255,59,59,0.2)",
  },
};

const seedPool: ThreatEvent[] = [
  {
    id: "seed-1",
    type: "SQLi",
    severity: "CRITICAL",
    title: "SQL Injection Attempt",
    source: "185.220.101.4",
    target: "/login",
    timestamp: "2026-06-21T22:00:00.000Z",
    detail: "' OR 1=1 -- payload detected in authentication request",
  },
  {
    id: "seed-2",
    type: "XSS",
    severity: "HIGH",
    title: "Cross Site Scripting",
    source: "45.83.64.12",
    target: "/search",
    timestamp: "2026-06-21T21:59:00.000Z",
    detail: "<script>alert(1)</script> reflected payload identified",
  },
];

export default function ActivityFeed() {
  const [events, setEvents] = useState<ThreatEvent[]>(seedPool);

  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    let active = true;

    const fetchNextEvent = async () => {
      try {
        const res = await fetch("/api/monitor");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (data && data.success && data.attack) {
          const a = data.attack;
          // Map short types
          let mappedType: "SQLi" | "XSS" | "MITM" | "PORT" | "AUTH" = "SQLi";
          const lowerType = a.type.toLowerCase();
          if (lowerType.includes("sql")) mappedType = "SQLi";
          else if (lowerType.includes("xss") || lowerType.includes("script")) mappedType = "XSS";
          else if (lowerType.includes("mitm") || lowerType.includes("spoof")) mappedType = "MITM";
          else if (lowerType.includes("port") || lowerType.includes("panel") || lowerType.includes("admin")) mappedType = "PORT";
          else if (lowerType.includes("auth") || lowerType.includes("brute") || lowerType.includes("credential")) mappedType = "AUTH";

          const nextEvent: ThreatEvent = {
            id: crypto.randomUUID(),
            type: mappedType,
            severity: (a.severity || "MEDIUM").toUpperCase() as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            title: a.type,
            source: a.ip || "Unknown IP",
            target: a.path || "/",
            timestamp: data.timestamp || new Date().toISOString(),
            detail: a.payload || "Suspicious threat traffic detected",
          };

          if (active) {
            setEvents((prev) => {
              // Avoid exact duplicate payloads at the top
              if (prev.length > 0 && prev[0].detail === nextEvent.detail && prev[0].source === nextEvent.source) {
                return prev;
              }
              return [nextEvent, ...prev.slice(0, 7)];
            });
          }
        }
      } catch (err) {
        console.error("Error fetching telemetry event:", err);
      }
    };

    const interval = setInterval(fetchNextEvent, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "ALL") return events;

    return events.filter(
      (item) => item.severity === filter
    );
  }, [events, filter]);

  return (
    <div className="af-wrap">
      {/* Header */}
      <div className="af-top">
        <div>
          <p className="af-kicker">
            ROOTX TELEMETRY
          </p>

          <h2 className="af-title">
            LIVE THREAT ACTIVITY
          </h2>
        </div>

        <div className="af-filter-row">
          {[
            "ALL",
            "LOW",
            "MEDIUM",
            "HIGH",
            "CRITICAL",
          ].map((level) => (
            <button
              key={level}
              className={`af-filter ${
                filter === level ? "active" : ""
              }`}
              onClick={() => setFilter(level)}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="af-list">
        <AnimatePresence>
          {filtered.length === 0 ? (
            <div className="af-empty">
              No matching threat events
            </div>
          ) : (
            filtered.map((item, index) => {
              const sev =
                severityStyles[item.severity];

              return (
                <motion.div
                  key={`${item.id}-${index}`}
                  initial={{
                    opacity: 0,
                    y: 12,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    y: -12,
                  }}
                  transition={{
                    duration: 0.3,
                  }}
                  className="af-card"
                  style={{
                    borderColor: sev.border,
                  }}
                >
                  <div className="af-card-top">
                    <div>
                      <span
                        className="af-severity"
                        style={{
                          color: sev.color,
                        }}
                      >
                        {item.severity}
                      </span>

                      <h3 className="af-event-title">
                        {item.title}
                      </h3>
                    </div>

                    <span className="af-time">
                      {new Date(
                        item.timestamp
                      ).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="af-meta">
                    <p>
                      <span>SOURCE:</span>{" "}
                      {item.source}
                    </p>

                    <p>
                      <span>TARGET:</span>{" "}
                      {item.target}
                    </p>

                    <p>
                      <span>TYPE:</span>{" "}
                      {item.type}
                    </p>
                  </div>

                  <div className="af-detail">
                    {item.detail}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        .af-wrap {
          width: 100%;
          border: 1px solid rgba(0, 255, 156, 0.08);
          background: #050816;
          border-radius: 22px;
          padding: 24px;
          margin-top: 24px;
        }

        .af-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 22px;
          flex-wrap: wrap;
        }

        .af-kicker {
          color: #00ff9c;
          font-size: 0.7rem;
          letter-spacing: 0.18em;
          margin-bottom: 8px;
        }

        .af-title {
          color: white;
          font-size: 1.4rem;
          font-weight: 700;
        }

        .af-filter-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .af-filter {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.7);
          padding: 8px 14px;
          border-radius: 999px;
          cursor: pointer;
          font-size: 0.7rem;
          transition: 0.2s ease;
        }

        .af-filter:hover {
          border-color: #00ff9c;
          color: #00ff9c;
        }

        .af-filter.active {
          background: rgba(0,255,156,0.12);
          border-color: #00ff9c;
          color: #00ff9c;
        }

        .af-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .af-card {
          border: 1px solid;
          background: rgba(255,255,255,0.02);
          border-radius: 18px;
          padding: 18px;
        }

        .af-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 14px;
          gap: 14px;
        }

        .af-severity {
          font-size: 0.68rem;
          letter-spacing: 0.14em;
          font-weight: 700;
        }

        .af-event-title {
          color: white;
          font-size: 1rem;
          margin-top: 6px;
        }

        .af-time {
          color: rgba(255,255,255,0.45);
          font-size: 0.75rem;
        }

        .af-meta {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(180px, 1fr)
          );
          gap: 12px;
          margin-bottom: 14px;
        }

        .af-meta p {
          color: rgba(255,255,255,0.8);
          font-size: 0.8rem;
        }

        .af-meta span {
          color: #00ff9c;
        }

        .af-detail {
          color: rgba(255,255,255,0.65);
          font-size: 0.82rem;
          line-height: 1.7;
        }

        .af-empty {
          color: rgba(255,255,255,0.5);
          padding: 24px;
          text-align: center;
        }

        @media (max-width: 768px) {
          .af-wrap {
            padding: 18px;
          }

          .af-card-top {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}