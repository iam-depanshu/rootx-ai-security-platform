"use client";

import { useEffect, useState } from "react";

type AttackLog = {
  ip: string;
  path: string;
  payload: string;
  type: string;
  severity: string;
  time: string;
};

export default function AttackMonitor() {
  const [logs, setLogs] = useState<AttackLog[]>([]);

  const loadLogs = async () => {
    try {
      const res = await fetch("/api/monitor");

      const data = await res.json();

      if (data.attack) {
        setLogs((prev) => [
          {
            ...data.attack,
            time: data.timestamp,
          },
          ...prev.slice(0, 4),
        ]);
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    loadLogs();

    const interval = setInterval(() => {
      loadLogs();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#0B1120] border border-red-500/10 rounded-xl p-6 mt-8">
      <h2 className="text-2xl font-bold text-red-400 mb-6">
        Live Attack Detection
      </h2>

      <div className="space-y-4">
        {logs.length === 0 && (
          <div className="text-gray-500">
            Waiting for attack activity...
          </div>
        )}

        {logs.map((log, index) => (
          <div
            key={index}
            className="border border-red-500/10 rounded-lg p-4 bg-[#050816]"
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-sm font-bold ${
                  log.severity === "CRITICAL"
                    ? "text-red-500"
                    : log.severity === "HIGH"
                    ? "text-orange-400"
                    : "text-yellow-400"
                }`}
              >
                {log.type}
              </span>

              <span className="text-gray-500 text-sm">
                {new Date(log.time).toLocaleTimeString()}
              </span>
            </div>

            <p className="mt-2 text-gray-300">
              <span className="text-[#00FF9C]">IP:</span>{" "}
              {log.ip}
            </p>

            <p className="mt-1 text-gray-300">
              <span className="text-[#00FF9C]">PATH:</span>{" "}
              {log.path}
            </p>

            <p className="mt-1 text-gray-300 break-all">
              <span className="text-[#00FF9C]">PAYLOAD:</span>{" "}
              {log.payload}
            </p>

            <p className="mt-1 text-gray-300">
              <span className="text-[#00FF9C]">SEVERITY:</span>{" "}
              {log.severity}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}