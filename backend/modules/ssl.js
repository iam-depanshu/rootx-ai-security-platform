const tls = require("tls");
const url = require("url");

module.exports = {
  name: "ssl_check",
  label: "SSL/TLS Certificate Analysis",

  async run(targetUrl, context, io, scanId) {
    const vulns = [];

    io.emit("scan:step", {
      scanId,
      module: this.name,
      label: this.label,
      status: "running",
      timestamp: new Date().toISOString(),
    });

    let sslResult = { grade: "N/A", status: "HTTP ONLY", daysLeft: 0, protocol: "NONE" };

    if (context.isHttps) {
      sslResult = await new Promise((resolve) => {
        let parsedPort = 443;
        try {
          const parsed = new url.URL(targetUrl);
          if (parsed.port) {
            parsedPort = parseInt(parsed.port);
          }
        } catch (e) {
          // Fall back to default HTTPS port
        }

        const socket = tls.connect(parsedPort, context.hostname, { rejectUnauthorized: false, timeout: 5000 }, () => {
          const cert = socket.getPeerCertificate();
          const proto = socket.getProtocol();
          socket.end();
          const expiry = cert.valid_to ? new Date(cert.valid_to) : null;
          const daysLeft = expiry ? Math.floor((expiry - Date.now()) / 86400000) : 0;
          let grade = "A";
          if (!proto || proto === "TLSv1" || proto === "TLSv1.1") grade = "C";
          else if (daysLeft < 0) grade = "F";
          else if (daysLeft < 30) grade = "B";
          resolve({ grade, status: daysLeft > 0 ? "VALID" : "EXPIRED", daysLeft, protocol: proto });
        });
        socket.on("error", () => resolve({ grade: "F", status: "NO SSL", daysLeft: 0, protocol: "NONE" }));
        socket.setTimeout(5000, () => { socket.destroy(); resolve({ grade: "F", status: "TIMEOUT", daysLeft: 0, protocol: "NONE" }); });
      });

      if (sslResult.grade === "F") {
        vulns.push({
          name: "SSL Certificate Issue",
          severity: "HIGH",
          detail: `SSL: ${sslResult.status}`,
          fix: "Renew or install a valid SSL certificate.",
        });
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

    return { vulns, sslResult };
  },
};
