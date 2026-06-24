const crypto = require("crypto");
const { httpGet, calculateScore } = require("./utils");
const { getBaseline } = require("./engines/baseline");

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
async function runScan(targetUrl, parsed, io) {
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
  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];
    try {
      const result = await mod.run(targetUrl, context, io, scanId);

      if (result.vulns) {
        allVulns.push(...result.vulns);
        runningScore = calculateScore(allVulns);
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
  };
}

module.exports = { runScan };
