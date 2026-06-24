const { httpGet } = require('../utils');
const { matchesBaseline } = require('../engines/baseline');

module.exports = {
  name: 'admin_panels',
  label: 'Admin Panel Discovery',

  async run(targetUrl, context, io, scanId) {
    const vulns = [];
    const panels = [];
    const baseline = context.baseline;

    io.emit('scan:step', {
      scanId, module: this.name, label: this.label,
      status: 'running', timestamp: new Date().toISOString(),
    });

    // Admin panel indicators — the response MUST contain at least one of these
    const loginIndicators = [
      'type="password"', 'name="password"', 'name="pwd"',
      'name="log"', 'name="user"', 'name="username"',
      'login', 'sign in', 'signin', 'log in',
      'admin panel', 'dashboard', 'authentication',
      'phpmyadmin', 'cpanel',
    ];

    const paths = ['/admin', '/wp-admin', '/administrator', '/manager', '/phpmyadmin', '/cpanel'];

    for (const path of paths) {
      const res = await httpGet(targetUrl, path, 4000);
      if (!res) continue;

      // Only check 200 and 401 (403 = blocked = good security)
      if (![200, 401].includes(res.status)) continue;

      // Skip if matches baseline (generic catch-all page)
      if (baseline && matchesBaseline(res, baseline)) continue;

      const body = String(res.data || '').toLowerCase();

      // For 401 responses, the path exists but requires auth
      if (res.status === 401) {
        panels.push(`${targetUrl}${path} [${res.status} - Auth Required]`);
        continue;
      }

      // For 200 responses, verify the body has actual login/admin content
      const hasLoginContent = loginIndicators.some(indicator => body.includes(indicator));
      if (!hasLoginContent) continue;

      panels.push(`${targetUrl}${path} [${res.status}]`);
    }

    if (panels.length > 0) {
      vulns.push({
        name: 'Exposed Admin Panel',
        severity: 'HIGH',
        detail: `Found: ${panels.join(', ')}`,
        fix: 'Restrict admin access by IP whitelist, add MFA, or use a VPN.',
      });
    }

    io.emit('scan:step', {
      scanId, module: this.name,
      label: `${this.label} — ${vulns.length} issues found`,
      status: 'done', vulnsFound: vulns.length,
      timestamp: new Date().toISOString(),
    });

    for (const vuln of vulns) {
      io.emit('scan:vuln', { scanId, ...vuln });
    }

    return { vulns, panels };
  },
};
