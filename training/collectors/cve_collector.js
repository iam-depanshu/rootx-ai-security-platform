/**
 * RootX CVE Collector
 * 
 * Fetches real CVE data from the NIST NVD API (free, no key needed)
 * and formats it as training data for the RootX LLM.
 * 
 * Usage: node cve_collector.js [--count 500] [--year 2024]
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const OUTPUT_FILE = path.join(__dirname, "..", "datasets", "cve_database.jsonl");

/**
 * Fetch from URL and return JSON.
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "RootX-Collector/1.0" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

/**
 * Format a CVE entry as a training sample.
 */
function formatCVE(cve) {
  const id = cve.cve?.id || "UNKNOWN";
  const desc = cve.cve?.descriptions?.find(d => d.lang === "en")?.value || "";
  const severity = cve.cve?.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity ||
                   cve.cve?.metrics?.cvssMetricV2?.[0]?.baseSeverity || "UNKNOWN";
  const score = cve.cve?.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ||
                cve.cve?.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore || "N/A";
  const vector = cve.cve?.metrics?.cvssMetricV31?.[0]?.cvssData?.vectorString || "";
  const weaknesses = cve.cve?.weaknesses?.map(w => 
    w.description?.map(d => d.value).join(", ")
  ).join("; ") || "N/A";
  const refs = cve.cve?.references?.slice(0, 3).map(r => r.url).join("\n") || "N/A";
  const published = cve.cve?.published || "";

  if (!desc || desc.length < 20) return null;

  return {
    instruction: `Explain the security vulnerability ${id} and how to fix it`,
    input: "",
    output: `**${id}** — ${severity} (CVSS ${score})\n\n` +
      `**Description:** ${desc}\n\n` +
      `**Severity:** ${severity}\n` +
      `**CVSS Score:** ${score}\n` +
      `**Attack Vector:** ${vector}\n` +
      `**Weakness:** ${weaknesses}\n` +
      `**Published:** ${published}\n\n` +
      `**References:**\n${refs}\n\n` +
      `**Mitigation:**\n` +
      `1. Check if your software is affected by reviewing the references above\n` +
      `2. Apply the vendor-provided patch immediately\n` +
      `3. If no patch is available, implement compensating controls (WAF rules, network segmentation)\n` +
      `4. Monitor for exploitation attempts using IDS/IPS signatures\n` +
      `5. Update your vulnerability management database`
  };
}

/**
 * Main collector function.
 */
async function collectCVEs(options = {}) {
  const count = options.count || 200;
  const year = options.year || 2024;
  const resultsPerPage = Math.min(count, 50); // NVD API max is 2000, but let's be nice

  console.log(`[CVE Collector] Fetching ${count} CVEs from ${year}...`);

  const startDate = `${year}-01-01T00:00:00.000`;
  const endDate = `${year}-12-31T23:59:59.999`;

  const entries = [];
  let startIndex = 0;

  while (entries.length < count) {
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?` +
      `pubStartDate=${startDate}&pubEndDate=${endDate}` +
      `&resultsPerPage=${resultsPerPage}&startIndex=${startIndex}`;

    console.log(`  Fetching batch at index ${startIndex}...`);

    try {
      const data = await fetchJSON(url);
      const vulns = data.vulnerabilities || [];

      if (vulns.length === 0) break;

      for (const v of vulns) {
        const formatted = formatCVE(v);
        if (formatted) entries.push(formatted);
        if (entries.length >= count) break;
      }

      startIndex += resultsPerPage;

      // Rate limit: NVD allows 5 requests per 30 seconds without API key
      await new Promise(r => setTimeout(r, 6500));
    } catch (err) {
      console.error(`  Error fetching CVEs: ${err.message}`);
      break;
    }
  }

  // Write to file
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const lines = entries.map(e => JSON.stringify(e)).join("\n");
  fs.writeFileSync(OUTPUT_FILE, lines + "\n");

  console.log(`[CVE Collector] Saved ${entries.length} CVEs to ${OUTPUT_FILE}`);
  return entries.length;
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const countIdx = args.indexOf("--count");
  const yearIdx = args.indexOf("--year");

  collectCVEs({
    count: countIdx >= 0 ? parseInt(args[countIdx + 1]) : 200,
    year: yearIdx >= 0 ? parseInt(args[yearIdx + 1]) : 2024,
  }).catch(console.error);
}

module.exports = { collectCVEs };
