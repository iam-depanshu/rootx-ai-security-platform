module.exports = {
  name: "header_check",
  label: "Security Headers Audit",

  async run(targetUrl, context, io, scanId) {
    const vulns = [];

    io.emit("scan:step", {
      scanId,
      module: this.name,
      label: this.label,
      status: "running",
      timestamp: new Date().toISOString(),
    });

    const headers = context.headers || {};
    const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));

    if (!h["x-frame-options"])
      vulns.push({ name: "Missing X-Frame-Options", severity: "MEDIUM", detail: "Page can be embedded in iframes enabling clickjacking.", fix: "Add: X-Frame-Options: DENY", cve: "CWE-1021" });
    if (!h["content-security-policy"])
      vulns.push({ name: "Missing Content-Security-Policy", severity: "HIGH", detail: "No CSP. Attackers can inject malicious scripts.", fix: "Add a strict Content-Security-Policy header.", cve: "CWE-79" });
    if (!h["x-content-type-options"])
      vulns.push({ name: "Missing X-Content-Type-Options", severity: "LOW", detail: "Browser may MIME-sniff responses.", fix: "Add: X-Content-Type-Options: nosniff" });
    if (!h["strict-transport-security"])
      vulns.push({ name: "Missing HSTS Header", severity: "MEDIUM", detail: "Traffic can be downgraded to HTTP.", fix: "Add: Strict-Transport-Security: max-age=31536000" });
    if (h["server"])
      vulns.push({ name: "Server Version Disclosure", severity: "LOW", detail: `Server header exposes: ${h["server"]}`, fix: "Remove Server header." });
    if (h["x-powered-by"])
      vulns.push({ name: "X-Powered-By Disclosure", severity: "LOW", detail: `Tech stack exposed: ${h["x-powered-by"]}`, fix: "Remove X-Powered-By header." });

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
