const crypto = require("crypto");
const { httpGet, calculateScore } = require("./utils");
const { getBaseline } = require("./engines/baseline");
const { lookupCVEs } = require("./modules/cve-lookup");
const { scanForSecrets } = require("./modules/secrets-scanner");
const { recordMitreCoverage } = require("./modules/mitre-map");
const fetch = require("node-fetch");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

async function getProactiveComment(moduleName, result) {
  if (!GEMINI_API_KEY || !result?.vulns?.length) return null;
  try {
    const prompt = `In one short sentence, comment on this finding like a helpful security copilot watching live: module=${moduleName}, findings=${JSON.stringify(result.vulns)}`;
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 100 },
        }),
      }
    );
    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
    return null;
  }
}

const modules = [
  require("./modules/ssl"),
  require("./modules/headers"),
  require("./modules/cookies"),
  require("./modules/sqli"),
  require("./modules/xss"),
  require("./modules/sensitive-files"),
  require("./modules/admin-panels"),
  require("./modules/tech-detect"),
];

/**
 * Run all scan modules sequentially against a target.
 *
 * @param {string} targetUrl  - Fully qualified origin, e.g. "https://example.com"
 * @param {URL}    parsed     - The parsed URL object
 * @param {Server} io         - Socket.IO server instance
 * @returns {object}          - Aggregated scan results
 */
async function runScan(targetUrl, parsed, io, supabase) {
  const scanId = crypto.randomUUID();
  const startTime = Date.now();

  io.emit("scan:start", {
    scanId,
    target: targetUrl,
    timestamp: new Date().toISOString(),
    totalModules: modules.length,
  });

  /* ── 1. Connect to target ── */
  io.emit("scan:step", {
    scanId,
    module: "init",
    label: "Connecting to target...",
    status: "running",
    timestamp: new Date().toISOString(),
  });

  const homeRes = await httpGet(targetUrl, "/", 10000);

  if (!homeRes) {
    io.emit("scan:step", {
      scanId,
      module: "init",
      label: "Target unreachable",
      status: "done",
      timestamp: new Date().toISOString(),
    });

    io.emit("scan:complete", {
      scanId,
      target: targetUrl,
      score: 0,
      status: "UNREACHABLE",
      vulnCount: 1,
      duration: Date.now() - startTime,
    });

    return {
      scanId,
      score: 0,
      status: "UNREACHABLE",
      vulnerabilities: [
        { name: "Host Unreachable", severity: "CRITICAL", detail: "Target did not respond.", fix: "Check if target is running." },
      ],
      technologies: [],
      panels: [],
      sslResult: { grade: "F", status: "UNKNOWN" },
    };
  }

  io.emit("scan:step", {
    scanId,
    module: "init",
    label: "Target connected",
    status: "done",
    timestamp: new Date().toISOString(),
  });

  /* ── 1.5 Establish baseline for false-positive filtering ── */
  io.emit("scan:step", {
    scanId,
    module: "baseline",
    label: "Establishing false-positive baseline...",
    status: "running",
    timestamp: new Date().toISOString(),
  });

  const baseline = await getBaseline(targetUrl);

  io.emit("scan:step", {
    scanId,
    module: "baseline",
    label: "Baseline established",
    status: "done",
    timestamp: new Date().toISOString(),
  });

  /* ── 2. Build shared context ── */
  const context = {
    headers: homeRes.headers || {},
    body: String(homeRes.data || ""),
    isHttps: parsed.protocol === "https:",
    hostname: parsed.hostname,
    baseline,
  };

  const allVulns = [];
  let runningScore = 100;

  /* ── 3. Run each module ── */
  const moduleResults = {};
  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];
    try {
      const result = await mod.run(targetUrl, context, io, scanId);
      moduleResults[mod.name] = result;

      if (result.vulns) {
        allVulns.push(...result.vulns);
        runningScore = calculateScore(allVulns);
      }

      // Proactive copilot comment
      const comment = await getProactiveComment(mod.name, result);
      if (comment) {
        io.emit("scan:comment", { sessionId: scanId, module: mod.name, comment });
      }

      io.emit("scan:progress", {
        scanId,
        progress: Math.round(((i + 1) / modules.length) * 100),
        score: runningScore,
      });

      // Collect extra data into context for the final response
      if (result.panels) context.panels = result.panels;
      if (result.technologies) context.technologies = result.technologies;
      if (result.sslResult) context.sslResult = result.sslResult;
    } catch (err) {
      console.error(`[ROOTX] Module ${mod.name} error:`, err.message);
    }
  }

  /* ── 3.5 CVE lookup ── */
  let cveResults = [];
  if (context.technologies?.length) {
    const results = await Promise.all(
      context.technologies.map(t => lookupCVEs(t, null))
    );
    cveResults = context.technologies.map((t, i) => ({ tech: t, cves: results[i] }));
  }

  /* ── 3.55 MITRE ATT&CK ── */
  await recordMitreCoverage(null, moduleResults, supabase);

  /* ── 3.6 Secrets scanning ── */
  const secrets = scanForSecrets(context.body || "");
  if (secrets.length && supabase) {
    for (const s of secrets) {
      try {
        await supabase.from("secrets_vault").insert({ scan_id: scanId, type: s.type, redacted_preview: s.redactedPreview });
      } catch {}
    }
  }

  /* ── 3.7 Drift tracking ── */
  const drift = await getDriftSummary(targetUrl, allVulns, null, supabase);

  /* ── 4. Final results ── */
  const score = calculateScore(allVulns);
  const status = score >= 70 ? "SECURE" : score >= 40 ? "AT RISK" : "CRITICAL";

  io.emit("scan:complete", {
    scanId,
    target: targetUrl,
    score,
    status,
    vulnCount: allVulns.length,
    duration: Date.now() - startTime,
  });

  return {
    scanId,
    score,
    status,
    vulnerabilities: allVulns,
    technologies: context.technologies || [],
    panels: context.panels || [],
    sslResult: context.sslResult || { grade: "N/A", status: "HTTP ONLY" },
    drift,
  };
}

async function getDriftSummary(target, newVulns, userId, supabase) {
  if (!supabase) return null;
  try {
    const { data: lastScan } = await supabase
      .from("scans")
      .select("vulnerabilities, created_at")
      .eq("target", target)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!lastScan) return null;

    const oldTypes = new Set((lastScan.vulnerabilities || []).map(v => v.type || v.name));
    const newTypes = new Set(newVulns.map(v => v.type || v.name));
    const added = [...newTypes].filter(t => !oldTypes.has(t));
    const resolved = [...oldTypes].filter(t => !newTypes.has(t));

    return { added, resolved, lastScanDate: lastScan.created_at };
  } catch {
    return null;
  }
}

module.exports = { runScan, getDriftSummary };
