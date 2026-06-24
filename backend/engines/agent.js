/**
 * RootX AI Agent Engine
 * 
 * This is the brain of RootX. It receives user messages,
 * sends them to the LLM (AMD GPU or API), parses the response,
 * and decides which security module to execute.
 */
// const { httpGet } = require("../utils"); // unused

/* ─── System Prompt ─── */
const SYSTEM_PROMPT = `You are RootX, an autonomous AI cybersecurity agent built for defensive security.

Your capabilities:
1. SCAN websites for vulnerabilities (SSL, headers, cookies, exposed files, admin panels)
2. AUDIT source code from GitHub repositories for security flaws
3. CHECK open ports and service configurations
4. GENERATE code patches to fix discovered vulnerabilities
5. EXPLAIN cybersecurity concepts clearly

When the user asks you to scan a website, respond with:
[ACTION:SCAN] <url>
Then provide your analysis of what you'll check.

When the user asks to audit a repo, respond with:
[ACTION:AUDIT] <github-url>
Then explain what you're looking for.

When providing vulnerability findings, format each one as:
[VULN]
severity: CRITICAL|HIGH|MEDIUM|LOW
name: <vulnerability name>
file: <file path if applicable>
line: <line number if applicable>
detail: <what the issue is>
fix: <how to fix it>
before: <vulnerable code line>
after: <fixed code line>
[/VULN]

Always be thorough, accurate, and explain your reasoning. Never report false positives.
If you're unsure about a finding, say so rather than guessing.

IMPORTANT: You are a DEFENSIVE security tool. You help people secure their own systems.
You do NOT help attack systems without authorization.`;

/**
 * Parse [VULN]...[/VULN] blocks from LLM response into structured objects.
 */
function parseVulns(text) {
  const vulns = [];
  const regex = /\[VULN\]([\s\S]*?)\[\/VULN\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const block = match[1];
    const vuln = {};

    const getField = (name) => {
      const r = new RegExp(`^${name}:\\s*(.+)$`, "mi");
      const m = block.match(r);
      return m ? m[1].trim() : null;
    };

    vuln.severity = getField("severity") || "MEDIUM";
    vuln.name = getField("name") || "Unknown Vulnerability";
    vuln.file = getField("file") || null;
    vuln.line = getField("line") ? parseInt(getField("line")) : null;
    vuln.detail = getField("detail") || "";
    vuln.fix = getField("fix") || "";

    const before = getField("before");
    const after = getField("after");
    if (before && after) {
      vuln.patch = { before, after };
    }

    vulns.push(vuln);
  }

  return vulns;
}

/**
 * Parse [ACTION:TYPE] directives from LLM response.
 */
function parseAction(text) {
  const scanMatch = text.match(/\[ACTION:SCAN\]\s*(https?:\/\/\S+)/i);
  if (scanMatch) return { type: "scan", target: scanMatch[1] };

  const auditMatch = text.match(/\[ACTION:AUDIT\]\s*(https?:\/\/\S+)/i);
  if (auditMatch) return { type: "audit", target: auditMatch[1] };

  return null;
}

/**
 * Strip [ACTION:...] and [VULN]...[/VULN] blocks from text,
 * returning the clean conversational response.
 */
function cleanResponse(text) {
  return text
    .replace(/\[ACTION:\w+\]\s*\S+/g, "")
    .replace(/\[VULN\][\s\S]*?\[\/VULN\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Call the LLM (vLLM on AMD GPU, or any OpenAI-compatible API).
 */
async function callLLM(messages) {
  const apiUrl = process.env.LLM_API_URL || "https://generativelanguage.googleapis.com/v1beta";
  const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || "";
  const model = process.env.LLM_MODEL || "gemini-2.0-flash";

  // Detect if using vLLM (OpenAI-compatible) or Gemini
  const isVLLM = apiUrl.includes(":8000") || apiUrl.includes("/v1");

  if (isVLLM) {
    // vLLM / OpenAI-compatible API (AMD GPU)
    const res = await fetch(`${apiUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 2048,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LLM API error: ${res.status} - ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } else {
    // Google Gemini API (free tier fallback)
    const geminiMessages = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Merge system prompt into the first user message for Gemini
    if (messages[0]?.role === "system" && geminiMessages.length > 1) {
      geminiMessages[1].parts[0].text =
        `[System Instructions]\n${messages[0].content}\n\n[User Message]\n${geminiMessages[1].parts[0].text}`;
      geminiMessages.shift();
    }

    const res = await fetch(
      `${apiUrl}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error: ${res.status} - ${err}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
}

/**
 * Detect URLs in a user message.
 */
function extractURL(text) {
  const urlMatch = text.match(/(https?:\/\/[^\s,]+)/i);
  if (urlMatch) return urlMatch[1].replace(/[.,;!?)]+$/, "");

  // Also match bare domains like facebook.com, google.com
  const domainMatch = text.match(/\b([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b/i);
  if (domainMatch) return "https://" + domainMatch[0];

  return null;
}

/**
 * Detect if a message is asking for a scan.
 */
function isScanIntent(text) {
  const lower = text.toLowerCase();
  const scanWords = ["scan", "check", "test", "audit", "analyze", "analyse", "find", "look", "search", "vulnerability", "vulnerabilities", "secure", "security", "hack", "exploit", "port", "ssl", "header"];
  return scanWords.some(w => lower.includes(w)) || extractURL(text) !== null;
}

/**
 * Generate a human-readable scan report from scan results.
 */
function formatScanReport(url, results) {
  const { score, status, vulnerabilities = [], technologies = [], sslResult } = results;

  let report = `✅ Scan complete for ${url}\n\n`;
  report += `🔒 Security Score: ${score}/100 — ${status}\n`;

  if (sslResult) {
    report += `📜 SSL Grade: ${sslResult.grade} (${sslResult.status})\n`;
  }

  if (technologies?.length > 0) {
    report += `🔧 Technologies: ${technologies.join(", ")}\n`;
  }

  report += `\n`;

  if (vulnerabilities.length === 0) {
    report += `🎉 No vulnerabilities found! This target has good security practices.\n`;
    report += `\nRecommendations:\n`;
    report += `• Keep all software up to date\n`;
    report += `• Monitor for new CVEs in your dependencies\n`;
    report += `• Run periodic scans to catch regressions\n`;
  } else {
    report += `Found ${vulnerabilities.length} issue(s):\n`;
  }

  return report;
}

/**
 * Built-in responses for common security questions (no LLM needed).
 */
const BUILT_IN_RESPONSES = {
  help: `I'm RootX, your AI security agent. Here's what I can do:\n\n🔍 **Scan a website** — Just paste a URL and I'll check it for vulnerabilities\n📂 **Audit code** — Share a GitHub repo URL for code analysis\n🔧 **Check ports** — I'll identify open and exposed ports\n📦 **Check dependencies** — Analyze package.json for vulnerable packages\n\nTry: "Scan https://example.com" or just paste any URL!`,

  hello: `Hey! I'm RootX 🛡️ — your autonomous security agent.\n\nPaste any URL and I'll scan it for vulnerabilities, or ask me about cybersecurity topics.\n\nQuick commands:\n• Scan https://example.com\n• What is SQL injection?\n• How do I fix XSS?`,
};

/**
 * Process a user message through the RootX agent.
 * Smart fallback: works WITHOUT an LLM by detecting scan intent.
 *
 * @param {string} userMessage - The user's chat message
 * @param {Array} conversationHistory - Previous messages in the conversation
 * @param {object} options - { io, scanFn } for Socket.IO and scan execution
 * @returns {object} { response, vulns, action }
 */
async function processMessage(userMessage, conversationHistory = [], options = {}) {
  const { io, scanFn } = options;
  const lowerMsg = userMessage.toLowerCase().trim();

  // ─── 1. Check for built-in responses ───
  if (["help", "?", "what can you do", "commands"].some(k => lowerMsg.includes(k))) {
    return { response: BUILT_IN_RESPONSES.help };
  }
  if (["hello", "hi", "hey", "sup", "yo"].includes(lowerMsg)) {
    return { response: BUILT_IN_RESPONSES.hello };
  }

  // ─── 2. Try to extract a URL and detect scan intent ───
  const detectedURL = extractURL(userMessage);

  if (detectedURL && scanFn) {
    // Direct scan — no LLM needed
    console.log(`[AGENT] Direct scan: ${detectedURL}`);

    try {
      const scanResults = await scanFn(detectedURL);
      const report = formatScanReport(detectedURL, scanResults);

      return {
        response: report,
        vulns: scanResults.vulnerabilities?.length > 0
          ? scanResults.vulnerabilities.map(v => ({
              severity: v.severity,
              name: v.name,
              detail: v.detail,
              fix: v.fix,
              proof: v.proof,
            }))
          : undefined,
        action: { type: "scan", target: detectedURL },
        scanResults,
      };
    } catch (err) {
      return {
        response: `❌ Could not scan ${detectedURL}: ${err.message}\n\nMake sure the URL is correct and the target is online.`,
      };
    }
  }

  // ─── 3. Try LLM if API key is configured ───
  const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || "";

  if (apiKey) {
    try {
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...conversationHistory.slice(-10),
        { role: "user", content: userMessage },
      ];

      const llmResponse = await callLLM(messages);
      const vulns = parseVulns(llmResponse);
      const action = parseAction(llmResponse);
      const cleanText = cleanResponse(llmResponse);

      // If the LLM requested a scan action, execute it
      let scanResults = null;
      if (action?.type === "scan" && scanFn) {
        try {
          scanResults = await scanFn(action.target);
        } catch (err) {
          console.error("[AGENT] Scan execution error:", err.message);
        }
      }

      const allVulns = [...vulns];
      if (scanResults?.vulnerabilities) {
        allVulns.push(
          ...scanResults.vulnerabilities.map((v) => ({
            severity: v.severity,
            name: v.name,
            detail: v.detail,
            fix: v.fix,
            proof: v.proof,
          }))
        );
      }

      return {
        response: cleanText || "I've analyzed your request. See the findings below.",
        vulns: allVulns.length > 0 ? allVulns : undefined,
        action,
        scanResults,
      };
    } catch (err) {
      console.error("[AGENT] LLM call failed, using offline mode:", err.message);
      // Fall through to offline response
    }
  }

  // ─── 4. Offline mode — no LLM, no URL detected ───
  return {
    response: `I'm running in **offline mode** (no LLM API key configured).\n\n🔍 **To scan a website**, just paste a URL:\n\`Scan https://example.com\`\n\`https://facebook.com\`\n\nTo enable full AI chat, add a free Gemini API key to \`backend/.env\`:\n\`GEMINI_API_KEY=your-key-here\`\n\nGet one free at: https://aistudio.google.com/apikey`,
  };
}

module.exports = { processMessage, callLLM, parseVulns, parseAction, SYSTEM_PROMPT };

