const url = require('url');

/**
 * Validate a target URL. Returns true if safe to scan.
 * Blocks internal/private IPs to prevent SSRF attacks.
 */
function isValidTarget(target) {
  try {
    const parsed = new url.URL(target.startsWith('http') ? target : 'http://' + target);
    
    // Block internal/private IPs
    const blocked = ['127.0.0.1', 'localhost', '0.0.0.0', '::1'];
    if (blocked.includes(parsed.hostname)) return false;
    
    const ip = parsed.hostname;
    if (ip.startsWith('10.') || ip.startsWith('192.168.') ||
        ip.match(/^172\.(1[6-9]|2\d|3[01])\./)) return false;
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize a chat message to prevent prompt injection.
 */
function sanitizeChatMessage(message) {
  return message
    .replace(/```system/gi, '')
    .replace(/\[INST\]/gi, '')
    .replace(/<<SYS>>/gi, '')
    .replace(/<\|im_start\|>/gi, '')
    .replace(/<\|im_end\|>/gi, '')
    .slice(0, 4000);
}

module.exports = { isValidTarget, sanitizeChatMessage };
