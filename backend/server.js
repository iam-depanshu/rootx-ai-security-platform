const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const { parseTarget } = require("./utils");
const { runScan } = require("./orchestrator");

const app = express();
const server = http.createServer(app);

/* ─── SUPABASE (optional - won't crash if missing) ─── */
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    const { createClient } = require("@supabase/supabase-js");
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    console.log("[ROOTX] Supabase connected");
  } else {
    console.log("[ROOTX] Supabase not configured - running without DB");
  }
} catch (e) {
  console.log("[ROOTX] Supabase failed - running without DB:", e.message);
}

async function dbInsert(table, data) {
  if (!supabase) return null;
  try {
    const { data: result } = await supabase.from(table).insert(data).select().single();
    return result;
  } catch (e) {
    console.error(`[DB] Insert error on ${table}:`, e.message);
    return null;
  }
}

/* ─── SOCKET.IO ─── */
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

/* ═══════════════════════════════════════════
   MAIN SCAN ENDPOINT
═══════════════════════════════════════════ */
app.post("/api/scan", async (req, res) => {
  const { target } = req.body;
  if (!target) return res.status(400).json({ error: "No target provided" });

  const parsed = parseTarget(target);
  if (!parsed) return res.status(400).json({ error: "Invalid URL" });

  const targetUrl = `${parsed.protocol}//${parsed.host}`;
  console.log(`[ROOTX] Scanning: ${targetUrl}`);

  try {
    const result = await runScan(targetUrl, parsed, io);

    // Save to Supabase (if connected)
    await dbInsert("scans", {
      target: targetUrl,
      score: result.score,
      status: result.status,
      vulnerabilities: result.vulnerabilities,
      technologies: result.technologies,
      ssl_grade: result.sslResult.grade,
      ssl_status: result.sslResult.status,
      discovered_panels: result.panels,
      created_at: new Date().toISOString(),
    });

    console.log(`[ROOTX] Done: ${targetUrl} | Score: ${result.score} | Vulns: ${result.vulnerabilities.length}`);

    return res.json({
      score: result.score,
      status: result.status,
      vulnerabilities: result.vulnerabilities,
      technologies: result.technologies,
      threats: [],
      discoveredPanels: result.panels,
      sslGrade: result.sslResult.grade,
      sslStatus: result.sslResult.status,
    });
  } catch (err) {
    console.error("[ROOTX] Scan error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/* ─── OTHER ENDPOINTS ─── */
app.get("/api/latest-scan", async (req, res) => {
  if (!supabase) return res.json({});
  const { data } = await supabase.from("scans").select("*").order("created_at", { ascending: false }).limit(1).single();
  return res.json(data || {});
});

app.get("/api/stats", async (req, res) => {
  if (!supabase) return res.json({ totalScans: 0, avgScore: 0, totalVulns: 0 });
  const { data: scans } = await supabase.from("scans").select("score, vulnerabilities");
  const total = scans?.length || 0;
  const avg = total > 0 ? Math.round(scans.reduce((a, s) => a + s.score, 0) / total) : 0;
  const vulns = scans?.reduce((a, s) => a + (s.vulnerabilities?.length || 0), 0) || 0;
  return res.json({ totalScans: total, avgScore: avg, totalVulns: vulns });
});

app.get("/api/attacks", async (req, res) => {
  if (!supabase) return res.json([]);
  const { data } = await supabase.from("attack_alerts").select("*").order("timestamp", { ascending: false }).limit(50);
  return res.json(data || []);
});

const PORT = process.env.PORT || 4000;

app.get("/health", (req, res) => res.json({ status: "OK", service: "RootX", port: PORT }));

/* ─── SOCKET.IO ─── */
io.on("connection", (socket) => {
  console.log(`[ROOTX] Client connected: ${socket.id}`);
  socket.on("disconnect", () => console.log(`[ROOTX] Client disconnected: ${socket.id}`));
});

/* ─── START ─── */
server.listen(PORT, () => {
  console.log(`
  ██████╗  ██████╗  ██████╗ ████████╗██╗  ██╗
  ██╔══██╗██╔═══██╗██╔═══██╗╚══██╔══╝╚██╗██╔╝
  ██████╔╝██║   ██║██║   ██║   ██║    ╚███╔╝ 
  ██╔══██╗██║   ██║██║   ██║   ██║    ██╔██╗ 
  ██║  ██║╚██████╔╝╚██████╔╝   ██║   ██╔╝ ██╗
  ╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝   ╚═╝  ╚═╝
  🔍 Running on port ${PORT}
  `);
});