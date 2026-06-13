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

export default function ActivityFeed() {
  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    const generateEvent = (): ThreatEvent => {
      const attackPool: ThreatEvent[] = [
        {
          id: crypto.randomUUID(),
          type: "SQLi",
          severity: "CRITICAL",
          title: "SQL Injection Attempt",
          source: "185.220.101.4",
          target: "/login",
          timestamp: new Date().toISOString(),
          detail:
            "' OR 1=1 -- payload detected in authentication request",
        },
        {
          id: crypto.randomUUID(),
          type: "XSS",
          severity: "HIGH",
          title: "Cross Site Scripting",
          source: "45.83.64.12",
          target: "/search",
          timestamp: new Date().toISOString(),
          detail:
            "<script>alert(1)</script> reflected payload identified",
        },
        {
          id: crypto.randomUUID(),
          type: "MITM",
          severity: "CRITICAL",
          title: "MITM Traffic Interception",
          source: "192.168.1.14",
          target: "Gateway Router",
          timestamp: new Date().toISOString(),
          detail:
            "ARP spoofing pattern detected during packet routing",
        },
        {
          id: crypto.randomUUID(),
          type: "PORT",
          severity: "MEDIUM",
          title: "Exposed Admin Panel",
          source: "91.210.45.77",
          target: "/admin",
          timestamp: new Date().toISOString(),
          detail:
            "Administrative endpoint publicly reachable",
        },
        {
          id: crypto.randomUUID(),
          type: "AUTH",
          severity: "HIGH",
          title: "Credential Brute Force",
          source: "103.44.21.9",
          target: "/auth",
          timestamp: new Date().toISOString(),
          detail:
            "Multiple failed authentication attempts detected",
        },
      ];

      return attackPool[
        Math.floor(Math.random() * attackPool.length)
      ];
    };

    const bootEvents = Array.from({ length: 5 }, () =>
      generateEvent()
    );

    setEvents(bootEvents);
    setLoading(false);

    const interval = setInterval(() => {
      const next = generateEvent();

      setEvents((prev) => [next, ...prev.slice(0, 7)]);
    }, 5000);

    return () => clearInterval(interval);
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
              {loading
                ? "◎ Loading telemetry..."
                : "No matching threat events"}
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