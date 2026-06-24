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
      /(169\.254\.169\.254)/,          // AWS metadata
      /(metadata\.google\.internal)/i, // GCP metadata
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
    this.requests = new Map();   // ip -> [timestamps]
    this.blocked = new Map();    // ip -> { until, reason }
    this.strikes = new Map();    // ip -> attack count
    this.RATE_LIMIT = 60;        // max requests per minute
    this.BURST_LIMIT = 15;       // max requests per 5 seconds
    this.STRIKE_LIMIT = 3;       // attacks before auto-block
    this.BLOCK_DURATION = 15 * 60 * 1000; // 15 min block
  }

  /** Record a request from an IP */
  recordRequest(ip) {
    const now = Date.now();
    if (!this.requests.has(ip)) this.requests.set(ip, []);
    const timestamps = this.requests.get(ip);
    timestamps.push(now);
    // Keep only last 60 seconds
    const cutoff = now - 60000;
    this.requests.set(ip, timestamps.filter(t => t > cutoff));
  }

  /** Record an attack strike from an IP */
  recordStrike(ip) {
    const strikes = (this.strikes.get(ip) || 0) + 1;
    this.strikes.set(ip, strikes);
    if (strikes >= this.STRIKE_LIMIT) {
      this.blockIP(ip, "AUTO_BLOCKED: Too many attack attempts");
    }
    return strikes;
  }

  /** Block an IP */
  blockIP(ip, reason) {
    this.blocked.set(ip, { until: Date.now() + this.BLOCK_DURATION, reason });
  }

  /** Check if an IP is blocked */
  isBlocked(ip) {
    const block = this.blocked.get(ip);
    if (!block) return null;
    if (Date.now() > block.until) {
      this.blocked.delete(ip);
      return null;
    }
    return block;
  }

  /** Check rate limits */
  checkRateLimit(ip) {
    const now = Date.now();
    const timestamps = this.requests.get(ip) || [];

    // Per-minute rate limit
    if (timestamps.length > this.RATE_LIMIT) {
      return { blocked: true, reason: "RATE_LIMIT: Too many requests per minute" };
    }

    // Burst detection (5-second window)
    const burstWindow = timestamps.filter(t => t > now - 5000);
    if (burstWindow.length > this.BURST_LIMIT) {
      return { blocked: true, reason: "BURST_DETECTED: Too many requests per second" };
    }

    return { blocked: false };
  }

  /** Get all currently blocked IPs */
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

  /** Cleanup stale data every 5 minutes */
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

/* ═══════════════════════════════════════════
   SHIELD ENGINE — Main Analysis & Blocking
═══════════════════════════════════════════ */

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

    // Cleanup timer
    this._cleanupInterval = setInterval(() => {
      this.ipTracker.cleanup();
      // Keep only last 1000 attack logs
      if (this.attackLog.length > 1000) {
        this.attackLog = this.attackLog.slice(-500);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Analyze a single input string against all attack signatures.
   * Returns array of detected threats.
   */
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
          break; // One match per attack type is enough
        }
      }
    }

    return threats;
  }

  /**
   * Analyze an entire HTTP request (URL, headers, body, query params).
   * Returns { safe, threats, blocked, action }
   */
  analyzeRequest(req) {
    this.stats.totalRequests++;

    const ip = req.ip || req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";

    // 1. Check if IP is already blocked
    const ipBlock = this.ipTracker.isBlocked(ip);
    if (ipBlock) {
      this.stats.totalBlocked++;
      return {
        safe: false,
        blocked: true,
        action: "BLOCKED",
        reason: ipBlock.reason,
        ip,
        threats: [],
      };
    }

    // 2. Record request and check rate limits
    this.ipTracker.recordRequest(ip);
    const rateCheck = this.ipTracker.checkRateLimit(ip);
    if (rateCheck.blocked) {
      this.ipTracker.blockIP(ip, rateCheck.reason);
      this.stats.totalBlocked++;
      this._logAttack(ip, "RATE_LIMIT", "MEDIUM", rateCheck.reason, req);
      return {
        safe: false,
        blocked: true,
        action: "RATE_LIMITED",
        reason: rateCheck.reason,
        ip,
        threats: [{ type: "RATE_LIMIT", severity: "MEDIUM" }],
      };
    }

    // 3. Collect all inputs to analyze
    const inputs = [];

    // URL path
    if (req.url) {
      try { inputs.push(decodeURIComponent(req.url)); }
      catch { inputs.push(req.url); }
    }

    // Query parameters
    if (req.query) {
      for (const [key, val] of Object.entries(req.query)) {
        inputs.push(String(key));
        inputs.push(String(val));
      }
    }

    // Request body
    if (req.body) {
      if (typeof req.body === "string") {
        inputs.push(req.body);
      } else {
        const flatBody = this._flattenObject(req.body);
        for (const [key, val] of Object.entries(flatBody)) {
          inputs.push(String(key));
          inputs.push(String(val));
        }
      }
    }

    // Headers (selected dangerous ones)
    const dangerousHeaders = ["referer", "user-agent", "x-forwarded-for", "x-forwarded-host", "cookie"];
    for (const h of dangerousHeaders) {
      if (req.headers?.[h]) inputs.push(String(req.headers[h]));
    }

    // 4. Analyze all inputs
    const allThreats = [];
    for (const input of inputs) {
      const threats = this.analyzeInput(input);
      allThreats.push(...threats);
    }

    // 5. Determine action
    if (allThreats.length > 0) {
      const hasCritical = allThreats.some(t => t.severity === "CRITICAL");
      const strikes = this.ipTracker.recordStrike(ip);

      for (const t of allThreats) {
        this.stats.attacksByType[t.type] = (this.stats.attacksByType[t.type] || 0) + 1;
        this._logAttack(ip, t.type, t.severity, t.matched, req);
      }

      if (hasCritical || strikes >= 2) {
        this.stats.totalBlocked++;
        return {
          safe: false,
          blocked: true,
          action: "BLOCKED",
          reason: `Attack detected: ${allThreats.map(t => t.type).join(", ")}`,
          ip,
          threats: allThreats,
        };
      }

      // First non-critical offense: warn but allow
      return {
        safe: false,
        blocked: false,
        action: "WARNED",
        reason: `Suspicious activity: ${allThreats.map(t => t.type).join(", ")}`,
        ip,
        threats: allThreats,
      };
    }

    // 6. Clean request
    return { safe: true, blocked: false, action: "ALLOWED", ip, threats: [] };
  }

  /** Get attack statistics */
  getStats() {
    return {
      ...this.stats,
      blockedIPs: this.ipTracker.getBlockedIPs().length,
      blockedIPList: this.ipTracker.getBlockedIPs(),
      recentAttacks: this.attackLog.slice(-20),
    };
  }

  /** Get attack log */
  getAttackLog(limit = 50) {
    return this.attackLog.slice(-limit);
  }

  /** Manually block an IP */
  blockIP(ip, reason = "MANUAL_BLOCK") {
    this.ipTracker.blockIP(ip, reason);
  }

  /** Manually unblock an IP */
  unblockIP(ip) {
    this.ipTracker.blocked.delete(ip);
  }

  /** Flatten nested object for deep inspection */
  _flattenObject(obj, prefix = "", result = {}) {
    if (!obj || typeof obj !== "object") {
      result[prefix] = obj;
      return result;
    }
    for (const [key, val] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        this._flattenObject(val, newKey, result);
      } else if (Array.isArray(val)) {
        val.forEach((v, i) => {
          if (typeof v === "object") this._flattenObject(v, `${newKey}[${i}]`, result);
          else result[`${newKey}[${i}]`] = v;
        });
      } else {
        result[newKey] = val;
      }
    }
    return result;
  }

  /** Log an attack event */
  _logAttack(ip, type, severity, detail, req) {
    this.attackLog.push({
      timestamp: new Date().toISOString(),
      ip,
      type,
      severity,
      detail: String(detail).substring(0, 200),
      path: req?.url || req?.path || "unknown",
      method: req?.method || "unknown",
      userAgent: (req?.headers?.["user-agent"] || "").substring(0, 100),
    });
  }

  /** Cleanup on shutdown */
  destroy() {
    if (this._cleanupInterval) clearInterval(this._cleanupInterval);
  }
}

/* ═══════════════════════════════════════════
   EXPORTS
═══════════════════════════════════════════ */

// Singleton instance
const shield = new ShieldEngine();

module.exports = {
  shield,
  ShieldEngine,
  IPTracker,
  ATTACK_SIGNATURES,
};
