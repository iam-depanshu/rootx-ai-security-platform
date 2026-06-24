const PATTERNS = [
  { type: 'AWS Key', regex: /AKIA[0-9A-Z]{16}/g },
  { type: 'Generic API Key', regex: /[a-zA-Z0-9_\-]{32,45}/g },
  { type: 'JWT', regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
];

function scanForSecrets(text) {
  const found = [];
  for (const { type, regex } of PATTERNS) {
    const matches = text.match(regex) || [];
    matches.forEach(m => found.push({ type, redactedPreview: m.slice(0, 4) + '****' + m.slice(-4) }));
  }
  return found;
}

module.exports = { scanForSecrets };
