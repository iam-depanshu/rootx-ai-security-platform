const { httpGet } = require('../utils');
const { matchesBaseline } = require('../engines/baseline');

module.exports = {
  name: 'sensitive_files',
  label: 'Sensitive File Exposure Check',

  async run(targetUrl, context, io, scanId) {
    const vulns = [];
    const baseline = context.baseline;

    io.emit('scan:step', {
      scanId, module: this.name, label: this.label,
      status: 'running', timestamp: new Date().toISOString(),
    });

    // Each file has expected content-type patterns (NOT text/html)
    const files = [
      { path: '/.env', keywords: ['password', 'secret', 'key', 'db_', 'api_'] },
      { path: '/.git/config', keywords: ['[core]', '[remote', 'repositoryformatversion'] },
      { path: '/config.php', keywords: ['<?php', 'password', 'db_'] },
      { path: '/wp-config.php', keywords: ['<?php', 'db_name', 'db_password'] },
      { path: '/phpinfo.php', keywords: ['phpinfo()', 'php version', 'configuration'] },
      { path: '/.htaccess', keywords: ['rewriterule', 'rewriteengine', 'deny from'] },
      { path: '/backup.zip', keywords: [] },  // Binary check only
      { path: '/db.sql', keywords: ['create table', 'insert into', 'drop table'] },
      { path: '/actuator/env', keywords: ['property', 'source', 'value'] },
    ];

    for (const file of files) {
      const res = await httpGet(targetUrl, file.path, 4000);
      if (!res || res.status !== 200 || !res.data) continue;

      const body = String(res.data).toLowerCase();
      const contentType = (res.headers?.['content-type'] || '').toLowerCase();

      // FILTER 1: Skip if response matches the baseline (generic page)
      if (baseline && matchesBaseline(res, baseline)) continue;

      // FILTER 2: Skip if content-type is text/html (real config files are NOT HTML)
      // Exception: phpinfo.php can be HTML
      if (contentType.includes('text/html') && file.path !== '/phpinfo.php') continue;

      // FILTER 3: Check for HTML document markers (SPA catch-all pages)
      if (body.includes('<!doctype html') || body.includes('<html')) {
        if (file.path !== '/phpinfo.php') continue;
      }

      // FILTER 4: For files with keywords, at least one must match
      if (file.keywords.length > 0) {
        const hasKeyword = file.keywords.some(kw => body.includes(kw));
        if (!hasKeyword) continue;
      }

      // FILTER 5: For binary files (backup.zip), check content-type
      if (file.path === '/backup.zip') {
        if (!contentType.includes('application/zip') && !contentType.includes('application/octet-stream')) continue;
      }

      // Passed all filters — this is a REAL finding
      vulns.push({
        name: `Sensitive File Exposed: ${file.path}`,
        severity: 'CRITICAL',
        detail: `${file.path} is publicly accessible and contains sensitive data.`,
        fix: `Block access to ${file.path} in your web server configuration.`,
        proof: `${targetUrl}${file.path}`,
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

    return { vulns };
  },
};
