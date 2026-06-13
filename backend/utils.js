const axios = require("axios");
const url = require("url");

/**
 * Parse a user-supplied target string into a URL object.
 * Prepends "http://" if no protocol is given.
 */
function parseTarget(target) {
  try {
    if (!target.startsWith("http")) target = "http://" + target;
    return new url.URL(target);
  } catch { return null; }
}

/**
 * Perform a tolerant HTTP GET request.
 * Returns the axios response or null on failure.
 */
async function httpGet(targetUrl, path = "", timeout = 8000) {
  try {
    return await axios.get(targetUrl + path, {
      timeout,
      maxRedirects: 3,
      validateStatus: () => true,
      headers: { "User-Agent": "Mozilla/5.0 RootX-Scanner/1.0", Accept: "*/*" },
    });
  } catch { return null; }
}

/**
 * Calculate a security score (0-100) from a list of vulnerabilities.
 */
function calculateScore(vulns) {
  let d = 0;
  for (const v of vulns) {
    if (v.severity === "CRITICAL") d += 25;
    else if (v.severity === "HIGH") d += 15;
    else if (v.severity === "MEDIUM") d += 8;
    else if (v.severity === "LOW") d += 3;
  }
  return Math.max(0, 100 - d);
}

module.exports = { parseTarget, httpGet, calculateScore };
