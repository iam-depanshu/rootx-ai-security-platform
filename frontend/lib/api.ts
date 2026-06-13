// frontend/lib/api.ts
// All API calls from frontend components go through this module.
// Components import named functions — never write raw fetch() in components.

/* ── Types ──────────────────────────────────────── */

export interface Vulnerability {
  name: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  detail: string;
  fix: string;
  cve?: string;
  proof?: string;
}

export interface ScanResult {
  id?: string;
  scanId?: string;
  target: string;
  score: number;
  status: "SAFE" | "AT RISK" | "CRITICAL";
  vulnerabilities: Vulnerability[];
  technologies: string[];
  threats: { technology: string; risk: string; severity: string; cve?: string }[];
  sslGrade: "A" | "F";
  sslStatus: "SECURE" | "INSECURE";
  scannedAt: string;
}

export interface StatsResult {
  totalScans: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgScore: number;
  statusBreakdown: { SAFE: number; AT_RISK: number; CRITICAL: number };
  lastScan: string | null;
  recentScans: ScanResult[];
}

export interface MitmLog {
  active: boolean;
  target: string;
  count: number;
  log: {
    id: number;
    time: string;
    method: string;
    path: string;
    headers: Record<string, string>;
    body: string | null;
    intercepted: boolean;
  }[];
}

export interface CompareResult {
  scanA: { id: string; target: string; score: number; status: string; scannedAt: string };
  scanB: { id: string; target: string; score: number; status: string; scannedAt: string };
  scoreDelta: number;
  newVulns: Vulnerability[];
  fixedVulns: Vulnerability[];
  persisting: Vulnerability[];
  summary: string;
}

/* ── API helpers ─────────────────────────────────── */

// POST /api/scan — trigger a full vulnerability scan
// Returns scanId for Socket.io room subscription
export async function startScan(target: string): Promise<ScanResult & { scanId: string }> {
  const res = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Scan failed");
  return res.json();
}

// GET /api/latest-scan — most recent scan for the dashboard
export async function getLatestScan(): Promise<ScanResult | null> {
  try {
    const res = await fetch("/api/latest-scan");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// GET /api/stats — dashboard summary cards
export async function getStats(): Promise<StatsResult | null> {
  try {
    const res = await fetch("/api/stats");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// GET /api/report?scanId=xxx — full report JSON
export async function getReport(scanId: string): Promise<ScanResult | null> {
  try {
    const res = await fetch(`/api/report?scanId=${scanId}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// GET /api/report?scanId=xxx&pdf=true — trigger PDF download
export function downloadPDF(scanId: string) {
  const a = document.createElement("a");
  a.href = `/api/report?scanId=${scanId}&pdf=true`;
  a.download = `rootx-report-${scanId}.pdf`;
  a.click();
}

// POST /api/report { action: "email" } — send email report
export async function emailReport(scanId: string, emailTo?: string) {
  const res = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "email", scanId, emailTo }),
  });
  return res.json();
}

// POST /api/report { action: "compare" } — diff two scans
export async function compareScans(scanIdA: string, scanIdB: string): Promise<CompareResult> {
  const res = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "compare", scanIdA, scanIdB }),
  });
  if (!res.ok) throw new Error("Compare failed");
  return res.json();
}

// GET /api/monitor — fetch MITM intercepted request log
export async function getMitmLog(): Promise<MitmLog | null> {
  try {
    const res = await fetch("/api/monitor");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// POST /api/monitor { action: "start", target } — start MITM proxy
export async function startMitm(target = "http://localhost:3001") {
  const res = await fetch("/api/monitor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", target }),
  });
  return res.json();
}

// POST /api/monitor { action: "stop" } — stop MITM proxy
export async function stopMitm() {
  const res = await fetch("/api/monitor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "stop" }),
  });
  return res.json();
}

// POST /api/monitor { action: "clear" } — clear intercepted log
export async function clearMitmLog() {
  await fetch("/api/monitor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "clear" }),
  });
}

// POST /api/ai/explain — streams AI explanation of a vulnerability
// Returns an async generator of text chunks
export async function* explainVulnerability(
  vulnerability: Vulnerability,
  target: string
): AsyncGenerator<string> {
  const res = await fetch("/api/ai/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vulnerability, target }),
  });

  if (!res.body) {
    yield vulnerability.fix || "No explanation available.";
    return;
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (line.startsWith("data: ")) {
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") return;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.text) yield parsed.text;
        } catch { /* skip */ }
      }
    }
  }
}