const crypto = require("crypto");
const { httpGet, calculateScore } = require("./utils");
const { getBaseline } = require("./engines/baseline");
const { lookupCVEs } = require("./modules/cve-lookup");
const { scanForSecrets } = require("./modules/secrets-scanner");
const { recordMitreCoverage } = require("./modules/mitre-map");
const { crawl } = require("./modules/crawler");
const { loadPlugins } = require("./engines/plugin-loader");
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

// Page-level checks run once per discovered page
const pageLevelModules = [
  require("./modules/headers"),
  require("./modules/cookies"),
  require("./modules/sensitive-files"),
  require("./modules/admin-panels"),
];

// Site-level checks run once against the main target
const siteLevelModules = [
  require("./modules/ssl"),
  require("./modules/sqli"),
  require("./modules/xss"),
  require("./modules/tech-detect"),
];

const allModules = [...pageLevelModules, ...siteLevelModules];

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
    totalModules: allModules.length,
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

  /* ── 2.5 Crawl the site ── */
  io.emit("scan:step", {
    scanId,
    module: "crawler",
    label: "Crawling site to discover pages...",
    status: "running",
    timestamp: new Date().toISOString(),
  });

  const pages = await crawl(targetUrl, 20);

  io.emit("scan:step", {
    scanId,
    module: "crawler",
    label: `Crawling done — ${pages.length} pages discovered`,
    status: "done",
    timestamp: new Date().toISOString(),
  });

  /* ── 3. Run per-page modules ── */
  let moduleProgress = 0;
  const totalTasks = pageLevelModules.length * pages.length + siteLevelModules.length;
  const moduleResults = {};

  for (const page of pages) {
    if (page.status === 0) continue;

    io.emit("scan:step", {
      scanId,
      module: "page-scan",
      label: `Scanning page: ${page.url}`,
      status: "running",
      timestamp: new Date().toISOString(),
    });

    for (const mod of pageLevelModules) {
      try {
        const pageContext = {
          ...context,
          body: page.html,
          headers: {},
        };
        const result = await mod.run(page.url, pageContext, io, scanId);
        moduleResults[`${mod.name}-${page.url}`] = result;

        // Tag all findings with the page URL they were found on
        if (result.vulns) {
          const tagged = result.vulns.map(v => ({ ...v, foundOn: page.url }));
          allVulns.push(...tagged);
          runningScore = calculateScore(allVulns);
        }

        // Track tech/warnings from module results that carry them
        if (!context.pageTech) context.pageTech = [];
        if (result.technologies) context.pageTech.push(...result.technologies);
        if (result.panels) context.panels = [...new Set([...(context.panels || []), ...result.panels])];

        const comment = await getProactiveComment(mod.name, result);
        if (comment) {
          io.emit("scan:comment", { sessionId: scanId, module: mod.name, comment });
        }

        moduleProgress++;
        io.emit("scan:progress", {
          scanId,
          progress: Math.round((moduleProgress / totalTasks) * 100),
          score: runningScore,
        });
      } catch (err) {
        console.error(`[ROOTX] Page module ${mod.name} error on ${page.url}:`, err.message);
      }
    }

    if (context.pageTech) context.technologies = [...new Set([...(context.technologies || []), ...context.pageTech])];
  }

  /* ── 3.5 Run site-level modules ── */
  for (const mod of siteLevelModules) {
    try {
      const result = await mod.run(targetUrl, context, io, scanId);
      moduleResults[mod.name] = result;

      if (result.vulns) {
        allVulns.push(...result.vulns);
        runningScore = calculateScore(allVulns);
      }

      const comment = await getProactiveComment(mod.name, result);
      if (comment) {
        io.emit("scan:comment", { sessionId: scanId, module: mod.name, comment });
      }

      moduleProgress++;
      io.emit("scan:progress", {
        scanId,
        progress: Math.round((moduleProgress / totalTasks) * 100),
        score: runningScore,
      });

      if (result.panels) context.panels = result.panels;
      if (result.technologies) context.technologies = result.technologies;
      if (result.sslResult) context.sslResult = result.sslResult;
    } catch (err) {
      console.error(`[ROOTX] Site module ${mod.name} error:`, err.message);
    }
  }

  /* ── 3.55 Plugins ── */
  const plugins = loadPlugins();
  for (const plugin of plugins) {
    try {
      const pluginResult = await plugin.run(targetUrl);
      if (pluginResult?.vulnerabilities?.length) {
        const tagged = pluginResult.vulnerabilities.map(v => ({ ...v, foundOn: targetUrl }));
        allVulns.push(...tagged);
      }
      moduleProgress++;
      io.emit("scan:progress", {
        scanId,
        progress: Math.round((moduleProgress / totalTasks) * 100),
        score: runningScore,
      });
    } catch (err) {
      console.error(`[ROOTX] Plugin ${plugin.name} error:`, err.message);
    }
  }

  /* ── 3.6 Deduplicate findings ── */
  const seen = new Set();
  const dedupedVulns = allVulns.filter(v => {
    const key = `${v.type || v.name}-${v.foundOn || targetUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  allVulns.length = 0;
  allVulns.push(...dedupedVulns);

  /* ── 3.5 CVE lookup ── */
  let cveResults = [];
  if (context.technologies?.length) {
    const results = await Promise.all(
      context.technologies.map(t => lookupCVEs(t, null))
    );
    cveResults = context.technologies.map((t, i) => ({ tech: t, cves: results[i] }));
  }

  /* ── 3.55 MITRE ATT&CK ── */
  // Build a module-name-keyed map (strip per-page composite keys)
  const mitreResults = {};
  for (const [key, val] of Object.entries(moduleResults)) {
    const modName = key.includes("-") ? key.split("-")[0] : key;
    if (!mitreResults[modName]) mitreResults[modName] = { vulns: [] };
    if (val?.vulns) mitreResults[modName].vulns.push(...val.vulns);
  }
  await recordMitreCoverage(null, mitreResults, supabase);

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
    pagesScanned: pages.map(p => ({ url: p.url, status: p.status })),
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
