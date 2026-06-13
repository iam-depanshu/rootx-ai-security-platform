module.exports = {
  name: "tech_detect",
  label: "Technology Stack Detection",

  async run(targetUrl, context, io, scanId) {
    io.emit("scan:step", {
      scanId,
      module: this.name,
      label: this.label,
      status: "running",
      timestamp: new Date().toISOString(),
    });

    const headers = context.headers || {};
    const body = context.body || "";

    const techs = [];
    const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
    const b = body.toLowerCase();

    if (h["x-powered-by"]?.includes("PHP") || b.includes("<?php")) techs.push("PHP");
    if (h["x-powered-by"]?.includes("Express") || h["x-powered-by"]?.includes("Node")) techs.push("Node.js");
    if (h["server"]?.includes("nginx")) techs.push("Nginx");
    if (h["server"]?.includes("Apache")) techs.push("Apache");
    if (b.includes("wp-content")) techs.push("WordPress");
    if (b.includes("react") || b.includes("__next")) techs.push("React/Next.js");
    if (b.includes("jquery")) techs.push("jQuery");
    if (b.includes("angular")) techs.push("Angular");
    if (b.includes("vue")) techs.push("Vue.js");

    const technologies = [...new Set(techs)];

    io.emit("scan:step", {
      scanId,
      module: this.name,
      label: `${this.label} — ${technologies.length} technologies detected`,
      status: "done",
      vulnsFound: 0,
      timestamp: new Date().toISOString(),
    });

    return { vulns: [], technologies };
  },
};
