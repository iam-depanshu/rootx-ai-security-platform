module.exports = {
  name: "cookie_check",
  label: "Cookie Security Analysis",

  async run(targetUrl, context, io, scanId) {
    const vulns = [];

    io.emit("scan:step", {
      scanId,
      module: this.name,
      label: this.label,
      status: "running",
      timestamp: new Date().toISOString(),
    });

    const setCookieHeader = (context.headers || {})["set-cookie"];
    if (setCookieHeader) {
      const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
      for (const cookie of cookies) {
        const lower = cookie.toLowerCase();
        const name = cookie.split("=")[0].trim();
        if (!lower.includes("httponly"))
          vulns.push({ name: `Cookie Missing HttpOnly: ${name}`, severity: "MEDIUM", detail: "Cookie accessible via JS. XSS can steal session.", fix: "Set HttpOnly flag on all session cookies." });
        if (!lower.includes("secure"))
          vulns.push({ name: `Cookie Missing Secure Flag: ${name}`, severity: "MEDIUM", detail: "Cookie sent over HTTP.", fix: "Set Secure flag on all cookies." });
        if (!lower.includes("samesite"))
          vulns.push({ name: `Cookie Missing SameSite: ${name}`, severity: "LOW", detail: "CSRF attacks possible.", fix: "Set SameSite=Strict or Lax." });
      }
    }

    io.emit("scan:step", {
      scanId,
      module: this.name,
      label: `${this.label} — ${vulns.length} issues found`,
      status: "done",
      vulnsFound: vulns.length,
      timestamp: new Date().toISOString(),
    });

    for (const vuln of vulns) {
      io.emit("scan:vuln", { scanId, ...vuln });
    }

    return { vulns };
  },
};
