const { httpGet } = require('../utils');
const crypto = require('crypto');

/**
 * Establish a baseline for a target by requesting a known-nonexistent path.
 * Returns a fingerprint object that other modules use to filter false positives.
 */
async function getBaseline(targetUrl) {
  // Request a random path that definitely doesn't exist
  const randomPath = '/rootx-baseline-test-' + crypto.randomBytes(8).toString('hex');
  const res = await httpGet(targetUrl, randomPath, 6000);

  if (!res) {
    return { status: null, contentType: null, bodyHash: null, bodyLength: 0 };
  }

  const body = String(res.data || '');
  const contentType = (res.headers?.['content-type'] || '').toLowerCase();
  const bodyHash = crypto.createHash('md5').update(body.substring(0, 5000)).digest('hex');

  return {
    status: res.status,
    contentType,
    bodyHash,
    bodyLength: body.length,
  };
}

/**
 * Check if a response matches the baseline (i.e., is a generic/default page).
 * Returns true if the response is likely a false positive.
 */
function matchesBaseline(res, baseline) {
  if (!res || !baseline || !baseline.bodyHash) return false;

  const body = String(res.data || '');
  const resHash = crypto.createHash('md5').update(body.substring(0, 5000)).digest('hex');
  const resContentType = (res.headers?.['content-type'] || '').toLowerCase();

  // If body hash matches baseline, it's the same generic page
  if (resHash === baseline.bodyHash) return true;

  // If body lengths are very similar (within 10%) and both are HTML, likely same page
  if (resContentType.includes('text/html') && baseline.contentType.includes('text/html')) {
    const ratio = Math.abs(body.length - baseline.bodyLength) / Math.max(baseline.bodyLength, 1);
    if (ratio < 0.1) return true;
  }

  return false;
}

module.exports = { getBaseline, matchesBaseline };
