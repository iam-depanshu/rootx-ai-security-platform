"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

type ScanRecord = {
  id: string;
  target: string;
  score: number;
  status: string;
  vulnerabilities: { name: string; severity: string; detail: string }[];
  created_at: string;
};

export default function HistoryPage() {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/latest-scan')
      .then(r => r.json())
      .then(data => {
        // If we get a single scan, wrap it in an array
        if (data && data.target) setScans([data]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getStatusColor = (status: string) => {
    if (status === 'SECURE') return '#00FF9C';
    if (status === 'AT RISK') return '#facc15';
    return '#f87171';
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#00FF9C';
    if (score >= 40) return '#facc15';
    return '#f87171';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060b18' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: '32px 28px' }}>
        {/* Header */}
        <div style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: '0.85rem',
          fontWeight: 700,
          color: '#00FF9C',
          letterSpacing: '0.15em',
          marginBottom: 8,
        }}>SCAN HISTORY</div>
        <div style={{
          fontSize: '0.7rem',
          color: 'rgba(255,255,255,0.3)',
          fontFamily: "'Courier New', monospace",
          marginBottom: 28,
        }}>All previous security scans and their results</div>

        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "'Courier New', monospace", fontSize: '0.75rem' }}>
            Loading scan history...
          </div>
        ) : scans.length === 0 ? (
          <div style={{
            background: '#0a1128',
            border: '1px solid rgba(0,255,156,0.1)',
            borderRadius: 10,
            padding: '40px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>📭</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginBottom: 8 }}>
              No scans yet
            </div>
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', fontFamily: "'Courier New', monospace" }}>
              Go to Chat and ask RootX to scan a target
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {scans.map((scan, i) => (
              <div key={scan.id || i} style={{
                background: '#0a1128',
                border: '1px solid rgba(0,255,156,0.08)',
                borderRadius: 10,
                padding: '18px 22px',
              }}>
                {/* Row 1: Target + Score */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 600, marginBottom: 4 }}>
                      {scan.target}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', fontFamily: "'Courier New', monospace" }}>
                      {new Date(scan.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{
                      fontSize: '0.55rem', padding: '3px 10px', borderRadius: 4,
                      border: `1px solid ${getStatusColor(scan.status)}33`,
                      color: getStatusColor(scan.status),
                      fontFamily: "'Courier New', monospace", fontWeight: 700,
                      letterSpacing: '0.1em',
                    }}>{scan.status}</span>
                    <div style={{
                      fontFamily: "'Orbitron', monospace",
                      fontSize: '1.3rem',
                      fontWeight: 900,
                      color: getScoreColor(scan.score),
                    }}>{scan.score}</div>
                  </div>
                </div>
                {/* Row 2: Vulns summary */}
                {scan.vulnerabilities && scan.vulnerabilities.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {scan.vulnerabilities.slice(0, 5).map((v, j) => (
                      <span key={j} style={{
                        fontSize: '0.58rem', padding: '2px 8px', borderRadius: 3,
                        background: v.severity === 'CRITICAL' ? 'rgba(248,113,113,0.1)' :
                                   v.severity === 'HIGH' ? 'rgba(251,146,60,0.1)' :
                                   v.severity === 'MEDIUM' ? 'rgba(250,204,21,0.1)' : 'rgba(34,211,238,0.1)',
                        color: v.severity === 'CRITICAL' ? '#f87171' :
                               v.severity === 'HIGH' ? '#fb923c' :
                               v.severity === 'MEDIUM' ? '#facc15' : '#22d3ee',
                        fontFamily: "'Courier New', monospace",
                      }}>{v.severity} · {v.name}</span>
                    ))}
                    {scan.vulnerabilities.length > 5 && (
                      <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', fontFamily: "'Courier New', monospace" }}>
                        +{scan.vulnerabilities.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');`}</style>
    </div>
  );
}
