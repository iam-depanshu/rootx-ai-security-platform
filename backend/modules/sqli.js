const { httpGet } = require("../utils");

module.exports = {
  name: "sqli_test",
  label: "SQL Injection Testing",

  async run(targetUrl, context, io, scanId) {
    const vulns = [];

    io.emit("scan:step", {
      scanId,
      module: this.name,
      label: this.label,
      status: "running",
      timestamp: new Date().toISOString(),
    });

    const payloads = ["'", "' OR 1=1--"];
    const paths = ["/search?q=", "/?id=", "/login?user="];
    const errorPatterns = [/sql syntax/i, /mysql_fetch/i, /ORA-\d+/i, /sqlite.*error/i, /Warning.*mysql/i];

    outer:
    for (const path of paths.slice(0, 2)) {
      for (const payload of payloads) {
        const res = await httpGet(targetUrl, `${path}${encodeURIComponent(payload)}`, 5000);
        if (res?.data) {
          for (const pattern of errorPatterns) {
            if (pattern.test(String(res.data))) {
              vulns.push({
                name: "SQL Injection Detected",
                severity: "CRITICAL",
                detail: `SQL error at ${path}`,
                fix: "Use parameterized queries.",
                cve: "CWE-89",
                proof: `${targetUrl}${path}${payload}`,
              });
              break outer;
            }
          }
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
