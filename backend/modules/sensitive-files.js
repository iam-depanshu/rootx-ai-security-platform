const { httpGet } = require("../utils");

module.exports = {
  name: "sensitive_files",
  label: "Sensitive File Exposure Check",

  async run(targetUrl, context, io, scanId) {
    const vulns = [];

    io.emit("scan:step", {
      scanId,
      module: this.name,
      label: this.label,
      status: "running",
      timestamp: new Date().toISOString(),
    });

    const files = ["/.env", "/.git/config", "/config.php", "/wp-config.php", "/phpinfo.php", "/.htaccess", "/backup.zip", "/db.sql", "/actuator/env"];
    for (const file of files) {
      const res = await httpGet(targetUrl, file, 4000);
      if (res?.status === 200 && res.data) {
        const body = String(res.data).toLowerCase();
        if (body.includes("password") || body.includes("secret") || body.includes("db_") || body.length > 100) {
          vulns.push({
            name: `Sensitive File Exposed: ${file}`,
            severity: "CRITICAL",
            detail: `${file} is publicly accessible.`,
            fix: `Block access to ${file} in web server config.`,
            proof: `${targetUrl}${file}`,
          });
        }
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
