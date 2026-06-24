# ╔══════════════════════════════════════════════════════════════╗
# ║              ROOTX — MASTER BLUEPRINT v1.0                  ║
# ║    Autonomous AI-Powered Defensive Security Agent           ║
# ╚══════════════════════════════════════════════════════════════╝

---

## TABLE OF CONTENTS

1.  [What is RootX?](#1-what-is-rootx)
2.  [The Problem RootX Solves](#2-the-problem-rootx-solves)
3.  [Claude Mythos vs RootX — Comparison & Strategy](#3-claude-mythos-vs-rootx--comparison--strategy)
4.  [Technical Architecture](#4-technical-architecture)
5.  [Tech Stack — What We Use & Why](#5-tech-stack--what-we-use--why)
6.  [Feature Breakdown (Every Module Explained)](#6-feature-breakdown-every-module-explained)
7.  [Data Flow — How RootX Processes a Scan](#7-data-flow--how-rootx-processes-a-scan)
8.  [Step-by-Step Build Plan](#8-step-by-step-build-plan)
9.  [Dashboard Design Specification](#9-dashboard-design-specification)
10. [AMD Hackathon Strategy](#10-amd-hackathon-strategy)
11. [Security & Legal Boundaries](#11-security--legal-boundaries)
12. [Future Vision](#12-future-vision)

---

## 1. WHAT IS ROOTX?

RootX is an **Autonomous AI-Powered Defensive Security Agent**. It is NOT a simple
vulnerability scanner. It is an intelligent system that:

- **Discovers** every page, form, API endpoint, and service on a target application
  using dynamic crawling (headless browser).
- **Analyzes** source code from Git repositories to find logic flaws, hardcoded
  secrets, insecure queries, and vulnerable dependencies (White-Box Auditing).
- **Verifies** potential vulnerabilities using safe, non-destructive validation
  to eliminate false positives (the Instagram problem we encountered).
- **Fixes** confirmed issues automatically by generating code patches and opening
  Git Pull Requests.
- **Reports** everything through a premium, real-time dashboard with live AI
  reasoning terminal, proof-of-concept viewers, and one-click remediation.

### What RootX is NOT:
- It is NOT an offensive hacking tool.
- It is NOT designed to attack systems without authorization.
- It is a DEFENSIVE platform that helps developers and organizations secure their
  applications before attackers find the vulnerabilities.

---

## 2. THE PROBLEM ROOTX SOLVES

### Current Market Problems:
1. **Existing scanners produce massive false positives** — They flag Instagram as
   having exposed `.env` files because they trust HTTP 200 status codes blindly.
   This wastes developer time and erodes trust in the tool.

2. **Scanners only find problems, they don't fix them** — A developer gets a
   report with 50 vulnerabilities but no code to fix them. They still need to
   spend hours writing patches manually.

3. **Static analysis tools don't understand runtime behavior** — Tools that only
   read code can't tell if a vulnerability is actually exploitable in production.

4. **Enterprise tools cost $50,000-$500,000/year** — Snyk, Veracode, Qualys,
   and similar platforms are priced for large corporations. Small organizations
   and individual developers have no affordable option.

### How RootX Solves These:
- **Zero false positives**: AI verification confirms every finding before reporting.
- **Auto-fix**: Every vulnerability comes with a generated code patch + Git PR.
- **Hybrid analysis**: Combines static code reading + dynamic runtime testing.
- **Affordable**: Open-source core with premium features, accessible to everyone.

---

## 3. CLAUDE MYTHOS vs ROOTX — COMPARISON & STRATEGY

### What Claude Mythos Does:
- Mythos is a raw AI MODEL (neural network) trained by Anthropic.
- It reads millions of lines of source code and reasons about logic to find
  zero-day vulnerabilities (previously unknown bugs).
- It is restricted under "Project Glasswing" — only vetted organizations and
  government partners can access it.
- It is SLOW (analyzes code for hours) and EXPENSIVE (requires massive GPU
  compute).

### What RootX Does Differently:
- RootX is a PLATFORM/APPLICATION, not a raw model.
- It uses a hybrid approach: fast rule-based checks (milliseconds) combined
  with targeted AI analysis (only when needed).
- It is ACCESSIBLE — anyone can use it.
- It is FASTER — the rule engine handles 90% of checks instantly; the AI
  only processes the remaining 10% that need deeper analysis.

### How RootX Surpasses Mythos in Practical Value:

| Dimension           | Claude Mythos              | RootX                        |
|---------------------|----------------------------|------------------------------|
| Access              | Restricted (invite-only)   | Open/Available to everyone   |
| Speed               | Hours per analysis         | Seconds for rules + minutes for AI |
| Cost                | Massive GPU compute needed | $100 GPU credits can run it  |
| Output              | "Here's a bug"             | "Here's the bug + the fix + a PR" |
| False Positives     | Low (but still possible)   | Near-zero (verified by sandbox) |
| Auto-Remediation    | No                         | Yes (Git Pull Requests)      |
| Real-time Dashboard | No (CLI/API only)          | Yes (premium web dashboard)  |
| Legal to sell       | No (restricted model)      | Yes (defensive tool)         |

### The Strategy:
RootX does NOT try to be a bigger AI model. Instead, it uses AI models (Gemini,
Claude API, or open-source LLMs on AMD GPUs) as TOOLS within a larger, faster,
more practical platform. This is like how a car uses an engine — the engine is
powerful, but the car (chassis, steering, brakes, navigation) is what makes it
useful.

---

## 4. TECHNICAL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER / DASHBOARD                            │
│                   (Next.js + React + Socket.IO)                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR (Express.js)                       │
│  Routes: /api/scan, /api/audit, /api/patch, /api/crawl              │
│  Manages: Scan lifecycle, module execution order, result aggregation │
└──────┬──────────┬──────────┬──────────┬──────────┬─────────────────┘
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│ CRAWLER  │ │ RULE     │ │ AI       │ │ SANDBOX  │ │ REMEDIATION  │
│ ENGINE   │ │ ENGINE   │ │ VERIFIER │ │ EXECUTOR │ │ ENGINE       │
│          │ │          │ │          │ │          │ │              │
│ Playwright│ │ SSL      │ │ LLM API  │ │ Node VM  │ │ Git API      │
│ Headless │ │ Headers  │ │ Code     │ │ Safe     │ │ Branch       │
│ Browser  │ │ Cookies  │ │ Analysis │ │ Payload  │ │ Commit       │
│ Sitemap  │ │ Config   │ │ Verify   │ │ Testing  │ │ Pull Request │
│ Builder  │ │ Deps     │ │ Findings │ │          │ │              │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘
```

### The 5 Engines:

1. **Crawler Engine**: Uses Playwright to browse the target like a real user,
   mapping every page, form, and API endpoint.

2. **Rule Engine**: Fast, lightweight Node.js modules that check for known
   vulnerability patterns (SSL, headers, cookies, exposed files, etc.).
   These run in milliseconds and catch 90% of issues.

3. **AI Verifier**: Takes potential findings from the Rule Engine and uses
   an LLM (running on AMD GPU or via API) to verify if they are real
   vulnerabilities or false positives. Also analyzes uploaded source code.

4. **Sandbox Executor**: A safe, isolated environment (Node.js VM or Docker
   container) that executes harmless validation payloads to confirm if a
   vulnerability is actually exploitable.

5. **Remediation Engine**: Generates code patches using LLM assistance and
   opens Git Pull Requests automatically to fix confirmed vulnerabilities.

---

## 5. TECH STACK — WHAT WE USE & WHY

### Frontend:

| Technology       | Purpose                        | Why This Choice                                    |
|------------------|--------------------------------|----------------------------------------------------|
| Next.js 16       | Dashboard framework            | Fast SSR, routing, TypeScript support, React-based  |
| React 19         | UI components                  | Component-based, huge ecosystem, real-time updates  |
| Socket.IO Client | Live updates from backend      | Bidirectional real-time communication for terminals  |
| Framer Motion    | Animations                     | Smooth, premium-feeling UI transitions              |
| Supabase Client  | Database queries from frontend | Auth, real-time subscriptions, scan history          |

### Backend:

| Technology       | Purpose                        | Why This Choice                                    |
|------------------|--------------------------------|----------------------------------------------------|
| Express.js       | API server                     | Lightweight, flexible, industry standard for Node.js |
| Socket.IO Server | Real-time event streaming      | Streams live scan steps, AI reasoning, and results   |
| Playwright       | Dynamic web crawling           | Full browser automation, handles SPAs and JavaScript |
| Node.js VM       | Sandbox execution              | Built-in isolation for running validation scripts    |
| Supabase (DB)    | Persistent storage             | PostgreSQL + real-time subscriptions + auth          |
| dotenv           | Environment configuration      | Keeps API keys and secrets out of source code        |

### AI / ML Layer:

| Technology          | Purpose                     | Why This Choice                                    |
|---------------------|-----------------------------|----------------------------------------------------|
| Google Gemini API   | Code analysis, verification | Fast, affordable, good at code reasoning            |
| OR Claude API       | Code analysis, verification | Excellent at security-focused reasoning              |
| OR CodeLlama (OSS)  | Self-hosted on AMD GPU      | Free, runs on AMD MI210/MI300, no API costs         |
| OR Mistral (OSS)    | Self-hosted on AMD GPU      | Fast inference, open weights, good code ability      |

### Why Open-Source LLMs on AMD GPU (for Hackathon):
- Running CodeLlama or Mistral on an AMD GPU means **zero API costs**.
- You control the model entirely — no rate limits, no usage fees.
- The $100 AMD credits can run inference for the entire hackathon duration.
- Judges will be impressed by self-hosted AI on AMD hardware.

### Infrastructure:

| Technology         | Purpose                     | Why This Choice                                   |
|--------------------|-----------------------------|---------------------------------------------------|
| AMD Developer Cloud | GPU compute for AI inference | Hackathon sponsor, $100 free credits              |
| GitHub API          | Repository integration       | Most popular code hosting, excellent REST API      |
| Docker (optional)   | Containerized deployment     | Consistent environments, easy scaling              |

---

## 6. FEATURE BREAKDOWN (EVERY MODULE EXPLAINED)

### Module 1: Dynamic Crawler Engine
**File**: `backend/engines/crawler.js`

**What it does**:
- Launches a headless Chromium browser using Playwright.
- Navigates to the target URL and waits for JavaScript to fully execute.
- Extracts all internal links, forms, input fields, and API calls from the page.
- Recursively follows links to build a complete sitemap.
- Captures cookies, local storage, and session tokens set by the application.

**Why we need it**:
- Modern web apps (React, Angular, Vue) render content with JavaScript.
- Simple HTTP GET requests (what RootX currently does) miss 80% of the app.
- Instagram, Facebook, and similar SPAs require a real browser to analyze.

**How it connects to other modules**:
- Output: A structured sitemap (JSON) containing every discovered URL, form,
  and API endpoint.
- This sitemap feeds into the Rule Engine and AI Verifier.

---

### Module 2: Heuristic Baseline Checker
**File**: `backend/engines/baseline.js`

**What it does**:
- Before running any vulnerability checks, it sends a request to a known-invalid
  path (e.g., `/this-page-does-not-exist-rootx-test-12345`).
- Records the status code and body length of this "404 baseline" response.
- If the baseline returns 200 with HTML content, the site uses wildcard routing
  (like Instagram does).
- All subsequent checks compare their responses against this baseline to filter
  out false positives.

**Why we need it**:
- This is the exact fix for the Instagram false-positive problem.
- Without this, every path on Instagram returns 200 OK, making the scanner
  think `/admin`, `/.env`, `/wp-admin` all exist.

**How it works**:
```
Request: GET https://instagram.com/rootx-nonexistent-path-test
Response: 200 OK, body length = 45000 characters, content-type: text/html

Baseline established:
  - Status: 200
  - Body fingerprint: hash("45000 chars of Instagram HTML")

Later check: GET https://instagram.com/.env
Response: 200 OK, body length = 45000 characters, content-type: text/html

Comparison: Response matches baseline fingerprint → FALSE POSITIVE → Skip!

Later check: GET https://vulnerable-site.com/.env
Response: 200 OK, body length = 350 characters, content-type: text/plain
Content: "DB_PASSWORD=secretkey123..."

Comparison: Response does NOT match baseline → REAL FINDING → Report!
```

---

### Module 3: Rule Engine (Upgraded Modules)
**Files**: `backend/modules/*.js` (existing, upgraded)

**What it does**:
- Runs fast, deterministic checks against the target.
- Each module checks one category: SSL, headers, cookies, sensitive files,
  admin panels, technology detection, etc.

**Upgrades from current version**:
- Every module now receives the baseline fingerprint and filters responses.
- Content-Type verification: `.env` files must NOT be `text/html`.
- Response body comparison: if the body matches the 404 baseline, skip it.

---

### Module 4: AI Code Auditor (White-Box Analysis)
**File**: `backend/engines/code-auditor.js`

**What it does**:
- Accepts a GitHub repository URL or uploaded code directory.
- Clones/reads the source files.
- Identifies critical file types: database queries, API routes, authentication
  handlers, configuration files, dependency manifests.
- Sends suspicious code snippets to the LLM with a structured prompt:
  "Analyze this code for security vulnerabilities. For each finding, provide:
  the file path, line number, vulnerability type, severity, and a code patch."
- Parses the LLM response into structured vulnerability objects.

**Why we need it**:
- This is the Mythos-equivalent feature — reading code to find bugs.
- External scanning can only find symptoms. Code auditing finds root causes.
- Example: A scanner can detect that SQL injection is possible, but only code
  auditing reveals which exact line uses `db.query("SELECT * FROM users WHERE id=" + req.params.id)`.

**Supported analysis types**:
1. **Hardcoded Secrets**: API keys, passwords, tokens in source files.
2. **SQL Injection**: String concatenation in database queries.
3. **XSS Vulnerabilities**: Unescaped user input in templates/renders.
4. **Insecure Dependencies**: Packages with known CVEs in package.json/requirements.txt.
5. **Authentication Flaws**: Missing auth middleware, weak password hashing.
6. **Configuration Issues**: Debug mode enabled, CORS set to *, etc.

---

### Module 5: AI Verification Engine
**File**: `backend/engines/verifier.js`

**What it does**:
- Takes potential vulnerabilities from the Rule Engine.
- Sends the full context (request, response, headers, body snippet) to the LLM.
- Asks: "Is this a real vulnerability or a false positive? Explain your reasoning."
- The LLM acts as a second opinion, filtering out noise.

**Why we need it**:
- Reduces false positives from ~30% to near 0%.
- Much cheaper than running the LLM on everything — only runs on flagged items.

---

### Module 6: Sandbox Executor
**File**: `backend/engines/sandbox.js`

**What it does**:
- For vulnerabilities that need runtime confirmation, creates an isolated
  execution environment using Node.js VM module.
- Generates safe, non-destructive validation scripts.
- Example: To verify if a search parameter reflects unescaped content, it
  sends a unique marker string (not a real exploit) and checks if it appears
  in the response unmodified.

**Why we need it**:
- Proves vulnerabilities are real, not theoretical.
- A "Verified" badge on a finding is worth 10x more than "Suspected."

---

### Module 7: Remediation Engine (Auto-Patch)
**File**: `backend/engines/remediation.js`

**What it does**:
1. Takes a confirmed vulnerability with its file path and line number.
2. Sends the vulnerable code + vulnerability description to the LLM.
3. LLM generates a minimal, focused code patch (only changing what's needed).
4. Uses GitHub REST API to:
   a. Fork or create a branch (e.g., `rootx/fix-sql-injection-line-42`)
   b. Apply the code change via the Contents API
   c. Open a Pull Request with a detailed description:
      - What was found
      - Why it's dangerous
      - What the fix does
      - Before/After code comparison

**Why we need it**:
- This is the killer feature that no other affordable tool provides.
- Developers save hours of manual patching work.
- This is what wins hackathons — a live demo of "bug found → PR opened."

---

## 7. DATA FLOW — HOW ROOTX PROCESSES A SCAN

### Flow A: Web Application Scan (Black-Box + AI)

```
Step 1: User enters URL in dashboard
        ↓
Step 2: Orchestrator receives target URL
        ↓
Step 3: Baseline Checker sends request to random invalid path
        Records: status code, body hash, content-type
        ↓
Step 4: Crawler Engine launches headless browser
        Navigates target, maps sitemap (pages, forms, APIs)
        Emits: scan:crawl events via Socket.IO → Dashboard shows progress
        ↓
Step 5: Rule Engine runs all modules against discovered endpoints
        Each module compares results against baseline to filter false positives
        Emits: scan:step events → Dashboard shows each check
        ↓
Step 6: AI Verifier reviews flagged findings
        Sends context to LLM → LLM confirms or rejects each finding
        Emits: scan:verify events → Dashboard shows verified badge
        ↓
Step 7: Results compiled → Score calculated → Report generated
        Emits: scan:complete event → Dashboard shows final results
```

### Flow B: Code Repository Audit (White-Box)

```
Step 1: User connects GitHub repo or uploads code directory
        ↓
Step 2: Code Auditor clones/reads the repository files
        ↓
Step 3: File classifier identifies critical files:
        - package.json / requirements.txt (dependencies)
        - *.sql, *.prisma (database schemas)
        - routes/, controllers/ (API handlers)
        - .env, config.* (configuration)
        ↓
Step 4: Each critical file is sent to LLM with analysis prompt
        LLM returns structured findings: { file, line, type, severity, patch }
        ↓
Step 5: Remediation Engine generates patches for each finding
        ↓
Step 6: Git API creates branch + commits fixes + opens Pull Request
        ↓
Step 7: Dashboard shows: findings list + PR links + before/after diffs
```

---

## 8. STEP-BY-STEP BUILD PLAN

### Step 1: Fix False Positives (Priority: CRITICAL)
**Files to modify**: `backend/modules/sensitive-files.js`, `backend/modules/admin-panels.js`
**New file**: `backend/engines/baseline.js`
- Create the baseline checker module.
- Update sensitive-files.js to check content-type and compare against baseline.
- Update admin-panels.js to verify response body contains login-related content.
- **Test**: Scan instagram.com → should report 0 false positives.

### Step 2: Integrate Dynamic Crawler
**New file**: `backend/engines/crawler.js`
**Install**: `npm install playwright`
- Create the Playwright-based crawler.
- Wire it into the orchestrator to run before the rule engine.
- Add Socket.IO events for crawl progress.
- Update dashboard to show discovered sitemap.

### Step 3: Build AI Code Auditor
**New file**: `backend/engines/code-auditor.js`
**New API route**: `POST /api/audit`
- Create the file reader and code classifier.
- Build the LLM prompt templates for security analysis.
- Add a new "Code Audit" tab to the dashboard.
- Create the file upload or GitHub URL input component.

### Step 4: Build AI Verification Engine
**New file**: `backend/engines/verifier.js`
- Create the verification pipeline that takes Rule Engine findings.
- Build the LLM prompt for confirming/rejecting findings.
- Add "Verified ✓" and "Unverified ?" badges to dashboard vulnerability cards.

### Step 5: Build Remediation Engine
**New file**: `backend/engines/remediation.js`
**Install**: `npm install @octokit/rest` (GitHub API client)
- Create the patch generation pipeline.
- Implement Git branch creation, commit, and PR opening.
- Add "Auto-Fix" button to each vulnerability in the dashboard.
- Show PR link after fix is applied.

### Step 6: Dashboard Overhaul
- Add "Agent Terminal" component: shows live AI reasoning in a terminal UI.
- Add "Code Audit" tab: file upload + GitHub connect + code findings display.
- Add "Proof-of-Concept" viewer: shows the exact request/response that proved
  a vulnerability.
- Add "Auto-Fix" panel: shows generated patch, before/after diff, PR link.
- Add scan mode selector: "Quick Scan" / "Deep Scan" / "Code Audit".

### Step 7: Self-Hosted LLM on AMD GPU (Hackathon)
- Set up AMD Developer Cloud GPU instance.
- Install vLLM or Ollama for model serving.
- Deploy CodeLlama or Mistral model.
- Point RootX backend to the self-hosted inference endpoint.
- Verify all AI features work with the self-hosted model.

---

## 9. DASHBOARD DESIGN SPECIFICATION

### Main Tabs:
1. **SCAN** — URL input + mode selector + live scanning terminal
2. **RESULTS** — Vulnerability cards with severity, verified status, auto-fix
3. **CODE AUDIT** — File upload / GitHub repo + code analysis findings
4. **AGENT LOG** — Full AI reasoning transcript (like a terminal)
5. **HISTORY** — Past scans stored in Supabase

### Vulnerability Card Layout:
```
┌─────────────────────────────────────────────────────────────────┐
│ ☠ CRITICAL │ SQL Injection in /api/users          │ ✓ Verified │
├─────────────────────────────────────────────────────────────────┤
│ File: controllers/userController.js:42                          │
│ Detail: User input concatenated directly into SQL query         │
│ Impact: Full database access, data theft                        │
├─────────────────────────────────────────────────────────────────┤
│ ▸ View Proof of Concept    │    ⚡ Auto-Fix (Opens PR)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. AMD HACKATHON STRATEGY

### Pitch (30 seconds):
"RootX is an autonomous AI security agent. Give it a website or a GitHub repo,
and it finds vulnerabilities, proves they're real, and automatically fixes them
with a Pull Request. The AI runs on AMD GPUs using self-hosted CodeLlama."

### Demo Flow (2 minutes):
1. Open RootX dashboard → Enter a test vulnerable app URL.
2. Watch the live terminal as the AI crawls, checks, and verifies.
3. Show the results: 3 verified vulnerabilities with PoC evidence.
4. Click "Auto-Fix" → Show the PR created on GitHub.
5. Show the code diff: before (vulnerable) → after (patched).

### Why Judges Will Love It:
- Real-world, practical application (not a toy demo).
- Self-hosted AI on AMD hardware (uses the sponsor's product).
- Live, working demo with visible results.
- Premium UI that looks professional.

---

## 11. SECURITY & LEGAL BOUNDARIES

### What RootX Does (Legal & Ethical):
- Scans websites and applications that the user OWNS or has WRITTEN
  AUTHORIZATION to test.
- Uses non-destructive validation techniques (no data modification).
- Generates defensive patches to improve security.
- All findings are private to the user.

### What RootX Does NOT Do:
- Does not launch offensive exploits or attacks.
- Does not attempt to trace, locate, or "hack back" attackers.
- Does not access systems without authorization.
- Does not store or transmit target credentials externally.

### Terms of Use (to display in dashboard):
"RootX is a defensive security tool. Only scan targets you own or have explicit
written permission to test. Unauthorized scanning may violate computer fraud laws
in your jurisdiction."

---

## 12. FUTURE VISION

### After Hackathon — Growth Path:
1. **SaaS Platform**: Host RootX as a cloud service. Users pay monthly to scan
   their applications and get automated PR fixes.
2. **CI/CD Integration**: Run RootX as part of GitHub Actions / GitLab CI.
   Every code push gets automatically audited before merge.
3. **Enterprise API**: Sell API access to security teams who want to integrate
   RootX into their existing workflows.
4. **Collaboration Features**: Teams can share findings, assign fixes, and
   track remediation progress.
5. **Compliance Reporting**: Auto-generate OWASP, SOC 2, and PCI-DSS
   compliance reports from scan results.

### Revenue Model:
- **Free Tier**: 3 scans/month, basic rule engine only.
- **Pro Tier ($29/month)**: Unlimited scans, AI verification, code auditing.
- **Enterprise Tier ($199/month)**: Auto-fix PRs, CI/CD integration, team features.

---

## CREDITS & TOOL ACKNOWLEDGMENTS

RootX integrates with and credits the following open-source tools and services:
- Playwright (Microsoft) — Browser automation
- Socket.IO — Real-time communication
- Next.js (Vercel) — Frontend framework
- Express.js — Backend framework
- Supabase — Database and authentication
- CodeLlama / Mistral (Meta / Mistral AI) — Open-source LLMs
- AMD Developer Cloud — GPU compute infrastructure

---

*This document is the single source of truth for the RootX project.*
*Last updated: June 2026*
