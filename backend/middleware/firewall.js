/**
 * RootX Firewall Middleware
 * 
 * Express middleware that uses the Shield Engine to analyze and block
 * every incoming request. Detects 12+ attack types in real-time.
 * 
 * Usage:
 *   const { firewall } = require('./middleware/firewall');
 *   app.use(firewall);
 */

const { shield } = require("../engines/shield");

/**
 * Express middleware — analyzes every request and blocks attacks.
 */
function firewall(req, res, next) {
  // Skip health check and static endpoints
  if (req.path === "/health" || req.path === "/api/health" || req.path === "/favicon.ico") {
    return next();
  }

  // Skip firewall for internal scan/chat endpoints (they contain URLs and payloads by design)
  if (req.path === "/api/scan" || req.path === "/api/chat") {
    return next();
  }

  const result = shield.analyzeRequest(req);

  // Attach shield result to request for downstream use
  req.shieldResult = result;

  if (result.blocked) {
    console.log(
      `[SHIELD] \x1b[31mBLOCKED\x1b[0m ${result.ip} → ${req.method} ${req.path} | ${result.reason}`
    );

    // Emit attack event via Socket.IO if available
    if (req.app?.locals?.io) {
      req.app.locals.io.emit("shield:attack", {
        ip: result.ip,
        method: req.method,
        path: req.path,
        threats: result.threats,
        action: result.action,
        reason: result.reason,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(403).json({
      error: "BLOCKED",
      message: "Request blocked by RootX Shield",
      reason: result.reason,
      threats: result.threats.map(t => t.type),
    });
  }

  if (result.action === "WARNED") {
    console.log(
      `[SHIELD] \x1b[33mWARNED\x1b[0m ${result.ip} → ${req.method} ${req.path} | ${result.reason}`
    );

    // Emit warning event
    if (req.app?.locals?.io) {
      req.app.locals.io.emit("shield:warning", {
        ip: result.ip,
        method: req.method,
        path: req.path,
        threats: result.threats,
        reason: result.reason,
        timestamp: new Date().toISOString(),
      });
    }
  }

  next();
}

/**
 * Create API endpoints for Shield management.
 * Call this with your Express app to add shield routes.
 */
function registerShieldRoutes(app) {
  // Simple admin auth middleware for shield management
  const adminAuth = (req, res, next) => {
    const key = req.headers['x-admin-key'];
    const expected = process.env.ADMIN_KEY || 'rootx-admin';
    if (key !== expected) return res.status(403).json({ error: 'Forbidden: invalid admin key' });
    next();
  };

  // Get attack statistics
  app.get("/api/shield/stats", (req, res) => {
    res.json(shield.getStats());
  });

  // Get attack log
  app.get("/api/shield/log", (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json(shield.getAttackLog(limit));
  });

  // Get blocked IPs
  app.get("/api/shield/blocked", (req, res) => {
    res.json(shield.ipTracker.getBlockedIPs());
  });

  // Manually block an IP
  app.post("/api/shield/block", adminAuth, (req, res) => {
    const { ip, reason } = req.body;
    if (!ip) return res.status(400).json({ error: "IP required" });
    shield.blockIP(ip, reason || "MANUAL_BLOCK");
    console.log(`[SHIELD] Manually blocked IP: ${ip}`);
    res.json({ ok: true, message: `IP ${ip} blocked` });
  });

  // Manually unblock an IP
  app.post("/api/shield/unblock", adminAuth, (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: "IP required" });
    shield.unblockIP(ip);
    console.log(`[SHIELD] Unblocked IP: ${ip}`);
    res.json({ ok: true, message: `IP ${ip} unblocked` });
  });

  // Test endpoint — analyze a payload without blocking
  app.post("/api/shield/test", (req, res) => {
    const { payload } = req.body;
    if (!payload) return res.status(400).json({ error: "Payload required" });
    const threats = shield.analyzeInput(payload);
    res.json({
      safe: threats.length === 0,
      threats,
      message: threats.length === 0
        ? "No attacks detected"
        : `Detected ${threats.length} threat(s): ${threats.map(t => t.type).join(", ")}`,
    });
  });
}

module.exports = { firewall, registerShieldRoutes };
