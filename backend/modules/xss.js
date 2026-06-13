const { httpGet } = require("../utils");

module.exports = {
  name: "xss_test",
  label: "Cross-Site Scripting (XSS) Testing",

  async run(targetUrl, context, io, scanId) {
    const vulns = [];

    io.emit("scan:step", {
      scanId,
      module: this.name,
      label: this.label,
      status: "running",
      timestamp: new Date().toISOString(),
    });

    const payload = "<script>alert(1)</script>";
    const paths = ["/search?q=", "/?q="];

    for (const path of paths) {
      const res = await httpGet(targetUrl, `${path}${encodeURIComponent(payload)}`, 5000);
      if (res?.data && String(res.data).includes(payload)) {
        vulns.push({
          name: "Reflected XSS Vulnerability",
          severity: "HIGH",
          detail: `Unescaped input at ${path}`,
          fix: "Encode all user input before rendering.",
          cve: "CWE-79",
          proof: `${targetUrl}${path}${payload}`,
        });
        break;
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
