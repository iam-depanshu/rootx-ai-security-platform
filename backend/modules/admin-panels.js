const { httpGet } = require("../utils");

module.exports = {
  name: "admin_panels",
  label: "Admin Panel Discovery",

  async run(targetUrl, context, io, scanId) {
    const vulns = [];
    const panels = [];

    io.emit("scan:step", {
      scanId,
      module: this.name,
      label: this.label,
      status: "running",
      timestamp: new Date().toISOString(),
    });

    const paths = ["/admin", "/wp-admin", "/administrator", "/manager", "/phpmyadmin", "/cpanel"];
    for (const path of paths) {
      const res = await httpGet(targetUrl, path, 4000);
      if (res && [200, 401, 403].includes(res.status)) {
        panels.push(`${targetUrl}${path} [${res.status}]`);
      }
    }

    if (panels.length > 0) {
      vulns.push({
        name: "Exposed Admin Panel",
        severity: "HIGH",
        detail: `Found: ${panels.join(", ")}`,
        fix: "Restrict admin access by IP or add MFA.",
      });
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

    return { vulns, panels };
  },
};
