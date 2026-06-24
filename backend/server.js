const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const { parseTarget } = require("./utils");
const { runScan } = require("./orchestrator");
const { processMessage } = require("./engines/agent");
const { firewall, registerShieldRoutes } = require("./middleware/firewall");
const { isValidTarget, sanitizeChatMessage } = require("./utils/sanitize");
const { generateReportPDF } = require("./modules/report-generator");

const app = express();
const server = http.createServer(app);

/* ─── SUPABASE (optional - won't crash if missing) ─── */
let supabase = null;
try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    const { createClient } = require("@supabase/supabase-js");
    supabase = createClient(supabaseUrl, supabaseKey);
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

async function updateUserStats(userId) {
  if (!supabase || !userId) return;
  try {
    const { data } = await supabase.from("user_stats").select("*").eq("user_id", userId).single();
    const newCount = (data?.scan_count || 0) + 1;
    const skillLevel = newCount > 20 ? "advanced" : newCount > 5 ? "intermediate" : "beginner";
    await supabase.from("user_stats").upsert({
      user_id: userId,
      scan_count: newCount,
      skill_level: skillLevel,
      updated_at: new Date(),
    });
  } catch (e) {
    console.warn("[STATS] Update failed:", e.message);
  }
}

/* ─── SOCKET.IO ─── */
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Attach socket.io instance to app locals for the firewall middleware to use
app.locals.io = io;

app.use(cors());
app.use(express.json());

// Apply Firewall middleware to protect all routes
app.use(firewall);

// Register Shield/Firewall management routes
registerShieldRoutes(app);

/* ═══════════════════════════════════════════
   MAIN SCAN ENDPOINT
   ═══════════════════════════════════════════ */
app.post("/api/scan", async (req, res) => {
  const { target, userId } = req.body;
  if (!target) return res.status(400).json({ error: "No target provided" });

  // Ethical guardrail — check allowed domains
  if (supabase && userId) {
    try {
      const targetDomain = new URL(target.startsWith("http") ? target : `http://${target}`).hostname;
      const { data: allowed } = await supabase
        .from("allowed_domains")
        .select("domain")
        .eq("user_id", userId);
      const isAllowed = !allowed?.length || allowed.some(a => targetDomain.includes(a.domain));
      if (!isAllowed) {
        return res.status(403).json({
          error: `${targetDomain} is not in your allowed scan list. Add it first or confirm you have permission to test this target.`,
        });
      }
    } catch (e) {
      // If URL parsing fails or table missing, allow the scan to proceed
      console.warn("[GUARDRAIL] Domain check skipped:", e.message);
    }
  }

  const parsed = parseTarget(target);
  if (!parsed) return res.status(400).json({ error: "Invalid URL" });

  // SSRF protection — block internal/private IPs
  const targetUrl_check = `${parsed.protocol}//${parsed.host}`;
  if (!isValidTarget(targetUrl_check)) {
    return res.status(400).json({ error: "Target blocked: internal/private IP addresses are not allowed" });
  }

  const targetUrl = `${parsed.protocol}//${parsed.host}`;
  console.log(`[ROOTX] Scanning: ${targetUrl}`);

  try {
    const result = await runScan(targetUrl, parsed, io, supabase);

    // Save to Supabase (if connected)
    const savedScan = await dbInsert("scans", {
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

    // Update user stats for skill-adaptive coaching
    if (req.body.userId) {
      updateUserStats(req.body.userId);
    }

    console.log(`[ROOTX] Done: ${targetUrl} | Score: ${result.score} | Vulns: ${result.vulnerabilities.length}`);

    return res.json({
      id: savedScan?.id || result.scanId,
      score: result.score,
      status: result.status,
      vulnerabilities: result.vulnerabilities,
      technologies: result.technologies,
      threats: [],
      discoveredPanels: result.panels,
      sslGrade: result.sslResult.grade,
      sslStatus: result.sslResult.status,
      drift: result.drift,
    });
  } catch (err) {
    console.error("[ROOTX] Scan error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/* ─── SCAN BY ID ─── */
app.get("/api/scan/:scanId", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Database not connected" });
  const { data: scan, error } = await supabase
    .from("scans")
    .select("*")
    .eq("id", req.params.scanId)
    .single();
  if (error || !scan) return res.status(404).json({ error: "Scan not found" });
  res.json(scan);
});

/* ─── REPORT PDF ─── */
app.get("/api/report/:scanId", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Database not connected" });
  const { data: scan, error } = await supabase
    .from("scans")
    .select("*")
    .eq("id", req.params.scanId)
    .single();
  if (error || !scan) return res.status(404).json({ error: "Scan not found" });
  generateReportPDF(scan, res);
});

/* ─── AI CHAT ROUTE ─── */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, userId } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });
    // Look up user skill level
    let skillLevel = "beginner";
    if (supabase && userId) {
      try {
        const { data: stats } = await supabase.from("user_stats").select("skill_level").eq("user_id", userId).single();
        skillLevel = stats?.skill_level || "beginner";
      } catch {}
    }
    // Sanitize against prompt injection
    const safeMessage = sanitizeChatMessage(message);
    const result = await processMessage(safeMessage, history || [], { io, skillLevel, scanFn: async (url) => {
      const parsed = parseTarget(url);
      if (!parsed) throw new Error("Invalid URL to scan");
      const targetUrl = `${parsed.protocol}//${parsed.host}`;
      return await runScan(targetUrl, parsed, io, supabase);
    }});
    return res.json(result);
  } catch (err) {
    console.error("[ROOTX] Chat error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/* ─── ATTACK PATH ─── */
app.post("/api/attack-path", async (req, res) => {
  try {
    const { vulnerabilities } = req.body;
    if (!vulnerabilities?.length) return res.status(400).json({ error: "Vulnerabilities required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "AI not configured" });

    const fetch = require("node-fetch");
    const prompt = `Given these findings: ${JSON.stringify(vulnerabilities)}, describe the most likely attack path a real attacker would take, step by step, in order of escalation (recon → initial access → escalation → impact). Keep it to 5-7 short numbered steps.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      return res.status(500).json({ error: `Gemini error: ${err}` });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No attack path generated.";
    res.json({ attackPath: text });
  } catch (err) {
    console.error("[ATTACK PATH] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ─── MITRE COVERAGE ─── */
app.get("/api/mitre-coverage/:userId", async (req, res) => {
  if (!supabase) return res.json([]);
  const { data } = await supabase.from("mitre_coverage").select("*").eq("user_id", req.params.userId);
  res.json(data || []);
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
  const avg = total > 0 ? Math.round((scans?.reduce((a, s) => a + s.score, 0) || 0) / total) : 0;
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