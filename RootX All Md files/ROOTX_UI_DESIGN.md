# RootX — UI Design Specification
## Main Page & Dashboard — Detailed Layout

---

## OVERALL APP STRUCTURE

RootX has a **persistent left sidebar** and a **content area** that changes based
on the selected page. The sidebar is always visible on desktop.

```
┌────────────┬──────────────────────────────────────────────────────┐
│            │                                                      │
│  SIDEBAR   │              CONTENT AREA                            │
│            │                                                      │
│  Logo      │  (Changes based on selected sidebar item)            │
│  ────────  │                                                      │
│  💬 Chat   │  Page 1: AI Chat Agent (Main Page)                   │
│  📊 Monitor│  Page 2: Security Dashboard (Monitoring)             │
│  📜 History│  Page 3: Scan History                                │
│  ⚙️ Settings│  Page 4: API Keys, GitHub Token, Preferences        │
│            │                                                      │
└────────────┴──────────────────────────────────────────────────────┘
```

### Sidebar Details:
- **Width**: 240px (collapsible to 60px icon-only mode on mobile)
- **Background**: `#080d1e` (very dark navy)
- **Logo**: "ROOTX" in Orbitron font, color `#00FF9C`, with a pulsing green dot
- **Menu Items**: Icon + label, highlight active item with green left border
- **Bottom of sidebar**: User avatar/name + "Sign Out" link

---

## PAGE 1: MAIN PAGE — AI CHAT AGENT

This is the **homepage** of RootX. It works like a cybersecurity AI chatbot.
The user types commands or questions in natural language, and RootX performs
the action and responds with detailed, formatted results.

### Layout:

```
┌──────────────────────────────────────────────────────────────────┐
│                        CHAT AREA                                  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                                                              │ │
│  │  Welcome message:                                            │ │
│  │  "I'm RootX, your AI security agent. Ask me to scan a       │ │
│  │   website, audit a GitHub repo, check open ports, or         │ │
│  │   analyze code for vulnerabilities."                         │ │
│  │                                                              │ │
│  │  Quick action buttons:                                       │ │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐ │ │
│  │  │ 🔍 Scan Website │ │ 📂 Audit Repo   │ │ 🔧 Check Ports │ │ │
│  │  └─────────────────┘ └─────────────────┘ └────────────────┘ │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  USER MESSAGE:                                               │ │
│  │  "Check https://github.com/user/myapp for vulnerabilities"   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  ROOTX RESPONSE:                                             │ │
│  │                                                              │ │
│  │  "Cloning repository... ✓                                   │ │
│  │   Analyzing 47 files... ✓                                   │ │
│  │   Found 3 vulnerabilities:"                                 │ │
│  │                                                              │ │
│  │  ┌── VULNERABILITY CARD ──────────────────────────────────┐  │ │
│  │  │ ☠ CRITICAL │ SQL Injection                │ ✓ Verified │  │ │
│  │  │ File: controllers/auth.js:42                           │  │ │
│  │  │ Detail: User input concatenated into SQL query         │  │ │
│  │  │                                                        │  │ │
│  │  │ ┌──── Generated Fix ────────────────────────────────┐  │  │ │
│  │  │ │ - const q = "SELECT * FROM users WHERE id=" + id  │  │  │ │
│  │  │ │ + const q = "SELECT * FROM users WHERE id = $1"   │  │  │ │
│  │  │ │ + const result = await db.query(q, [id])          │  │  │ │
│  │  │ └──────────────────────────────────────────────────┘  │  │ │
│  │  │                                                        │  │ │
│  │  │  [ 📋 Copy Fix ]  [ ⚡ Open Pull Request ]             │  │ │
│  │  └────────────────────────────────────────────────────────┘  │ │
│  │                                                              │ │
│  │  ┌── VULNERABILITY CARD ──────────────────────────────────┐  │ │
│  │  │ ⚠ HIGH │ Hardcoded API Key               │ ✓ Verified │  │ │
│  │  │ File: config/database.js:8                             │  │ │
│  │  │ Detail: AWS secret key hardcoded in source             │  │ │
│  │  │                                                        │  │ │
│  │  │  [ 📋 Copy Fix ]  [ ⚡ Open Pull Request ]             │  │ │
│  │  └────────────────────────────────────────────────────────┘  │ │
│  │                                                              │ │
│  │  "Want me to fix all 3 issues and open Pull Requests?"      │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  USER MESSAGE:                                               │ │
│  │  "Yes, fix all of them"                                      │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  ROOTX RESPONSE:                                             │ │
│  │                                                              │ │
│  │  "Creating fixes...                                         │ │
│  │   ✓ Branch created: rootx/fix-sql-injection-auth-js         │ │
│  │   ✓ Patch applied to controllers/auth.js                    │ │
│  │   ✓ Pull Request #42 opened                                 │ │
│  │   🔗 https://github.com/user/myapp/pull/42                  │ │
│  │                                                              │ │
│  │   ✓ Branch created: rootx/fix-hardcoded-key-database-js     │ │
│  │   ✓ Patch applied to config/database.js                     │ │
│  │   ✓ Pull Request #43 opened                                 │ │
│  │   🔗 https://github.com/user/myapp/pull/43                  │ │
│  │                                                              │ │
│  │   All 3 issues fixed. PRs are ready for review."            │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌────────────────────────────────────────────────────────────────┐│
│ │ 🔒 Ask RootX anything...                           [ Send ▶ ] ││
│ └────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### Chat Area Behavior:
- **Welcome Screen**: Shows on first load with greeting + quick action buttons.
- **User Messages**: Right-aligned, dark green background bubble.
- **RootX Responses**: Left-aligned, dark card background with formatted content.
- **Vulnerability Cards**: Rendered inline inside RootX's response messages.
  Each card shows severity badge, title, file path, detail, generated fix (as
  a code diff block), and action buttons.
- **Live Streaming**: When RootX is working (scanning, analyzing), the response
  streams character by character (like ChatGPT), with progress indicators:
  "Cloning repository... ✓", "Analyzing 47 files... ✓"
- **Action Buttons on Cards**:
  - "📋 Copy Fix" — copies the patch code to clipboard.
  - "⚡ Open Pull Request" — triggers the backend to create a Git PR.
  - After PR is opened, button changes to "🔗 View PR #42" with a link.

### Chat Input Bar:
- Fixed at the bottom of the chat area.
- Dark input field with green border glow on focus.
- Placeholder: "Ask RootX anything..."
- Send button on the right (green arrow icon).
- Supports Enter to send, Shift+Enter for newline.
- Attachment button (📎) for uploading code files directly.

### Example User Prompts RootX Should Handle:
- "Scan https://example.com"
- "Audit my GitHub repo https://github.com/user/app"
- "Check what ports are open on my server"
- "Analyze this code for SQL injection" (with file upload)
- "What are the latest CVEs for Express.js 4.18?"
- "Fix the XSS vulnerability in search.js and open a PR"
- "Show me the OWASP Top 10 risks for my last scan"

---

## PAGE 2: DASHBOARD — SECURITY MONITORING CENTER

This page is a **live monitoring dashboard** that shows the health and security
status of the user's systems in real time. No URL search bar here — this is
purely observational and informational.

### Layout:

```
┌──────────────────────────────────────────────────────────────────┐
│  SECURITY OVERVIEW BAR                                            │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────────┐ │
│  │  SCORE │  │ SCANS  │  │ VULNS  │  │ FIXED  │  │   STATUS   │ │
│  │   87   │  │  142   │  │   23   │  │   19   │  │ ● SECURE   │ │
│  │  /100  │  │ total  │  │ found  │  │ patched│  │            │ │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────────────┘ │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┬───────────────────────────────────┐
│  NETWORK TRAFFIC MONITOR     │  OPEN PORTS                       │
│                              │                                   │
│  Incoming ━━━━━━━ (green)    │  Port   Service    Status         │
│  Outgoing ━━━━━━━ (cyan)     │  ────── ────────── ──────         │
│                              │  22     SSH        ⚠ EXPOSED      │
│  [Live graph with traffic    │  80     HTTP       ● OPEN         │
│   data flowing left to       │  443    HTTPS      ● SECURE       │
│   right, showing bandwidth   │  3000   Node.js    ● LOCAL        │
│   usage over time]           │  3306   MySQL      ✓ BLOCKED      │
│                              │  5432   PostgreSQL ✓ BLOCKED      │
│  ▸ Incoming: 2.4 MB/s       │  8080   Proxy      ⚠ EXPOSED      │
│  ▸ Outgoing: 890 KB/s       │                                   │
│  ▸ Connections: 47 active    │  Total: 7 ports │ 2 exposed       │
│                              │                                   │
└──────────────────────────────┴───────────────────────────────────┘

┌──────────────────────────────┬───────────────────────────────────┐
│  RECENT VULNERABILITIES      │  DEPENDENCY HEALTH                │
│                              │                                   │
│  ☠ CRIT SQL Injection        │  express@4.18.2                   │
│    auth.js:42 — 2 hours ago  │  ├─ CVE-2024-XXXX ⚠ HIGH         │
│    Status: ✓ Fixed (PR #42)  │  ├─ Fix: Upgrade to 4.19.1       │
│                              │                                   │
│  ⚠ HIGH Missing CSP Header   │  lodash@4.17.20                   │
│    nginx.conf — 5 hours ago  │  ├─ CVE-2021-XXXX ◎ MEDIUM       │
│    Status: ⏳ Pending         │  ├─ Fix: Upgrade to 4.17.21      │
│                              │                                   │
│  ◎ MED Cookie No HttpOnly    │  jsonwebtoken@8.5.1               │
│    server.js:15 — 1 day ago  │  ├─ No known CVEs ✓ SAFE         │
│    Status: ✓ Fixed (PR #39)  │                                   │
│                              │  5 packages │ 2 vulnerable        │
└──────────────────────────────┴───────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  LIVE ACTIVITY FEED                                               │
│                                                                   │
│  12:45:03  ● SCAN    Completed scan of api.example.com (Score:87)│
│  12:44:51  ● FIX     PR #42 merged by @developer                │
│  12:42:18  ⚠ ALERT   New CVE published for express@4.18.2       │
│  12:40:05  ● SCAN    Started code audit of github.com/user/app  │
│  12:38:22  ● SYSTEM  All ports verified — 2 exposed warnings     │
│  12:35:10  ● FIX     PR #41 created: fix-xss-search-component   │
│  12:30:00  ● HEALTH  System health check passed                  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Security Overview Bar (Top):
- **Security Score**: Overall score across all scanned assets (0-100).
  Color: green (70+), yellow (40-69), red (0-39).
- **Total Scans**: Number of scans performed (lifetime).
- **Vulns Found**: Total vulnerabilities discovered across all scans.
- **Fixed**: Number of vulnerabilities patched via auto-fix PRs.
- **Status**: Overall health indicator — "SECURE", "AT RISK", or "CRITICAL".

### Network Traffic Monitor (Left Panel):
- **Live graph**: Animated line chart showing incoming (green) and outgoing
  (cyan) bandwidth over the last 60 seconds.
- **Stats below graph**: Current incoming rate, outgoing rate, active connections.
- **Data source**: The backend polls system network interfaces or reads from
  a monitoring agent running on the user's server.

### Open Ports Panel (Right Panel):
- **Table format**: Port number, service name, and status.
- **Status indicators**:
  - ● SECURE (green) — Port is open but properly configured with encryption.
  - ● OPEN (blue) — Port is open and serving traffic (expected).
  - ● LOCAL (gray) — Port is only listening on localhost (safe).
  - ✓ BLOCKED (green) — Port is firewalled (good).
  - ⚠ EXPOSED (yellow/red) — Port is publicly accessible and may be risky.
- **Data source**: Backend runs local port queries or uses cloud provider
  APIs to list active services.

### Recent Vulnerabilities Panel (Bottom Left):
- Shows the last 5-10 vulnerabilities found across all scans.
- Each entry shows: severity badge, name, file/location, time ago, and status.
- **Status types**:
  - ✓ Fixed (PR #XX) — Linked to the merged/open Pull Request.
  - ⏳ Pending — Found but not yet fixed.
  - ❌ Ignored — User dismissed this finding.

### Dependency Health Panel (Bottom Right):
- Lists the user's project dependencies (from package.json, requirements.txt).
- For each dependency, shows:
  - Package name and version.
  - Known CVEs (if any) with severity badge.
  - Recommended fix version.
  - ✓ SAFE if no known issues.
- **Data source**: Backend reads the dependency manifest and queries a CVE
  database (like OSV.dev or NVD).

### Live Activity Feed (Full Width Bottom):
- A scrolling, real-time log of all RootX activity.
- Shows: timestamp, event type icon, and description.
- Event types: SCAN, FIX, ALERT, SYSTEM, HEALTH.
- Auto-scrolls to newest entry.
- Clicking an entry navigates to the relevant scan result or PR.

---

## COLOR PALETTE

| Element               | Color Code  | Usage                              |
|-----------------------|-------------|------------------------------------|
| Background (main)     | `#060b18`   | Page background                    |
| Background (cards)    | `#0a1128`   | Card/panel backgrounds             |
| Background (sidebar)  | `#080d1e`   | Sidebar background                 |
| Primary accent        | `#00FF9C`   | Logo, buttons, active states       |
| Critical severity     | `#f87171`   | Critical vulnerability badges      |
| High severity         | `#fb923c`   | High vulnerability badges          |
| Medium severity       | `#facc15`   | Medium vulnerability badges        |
| Low severity          | `#22d3ee`   | Low vulnerability badges           |
| Text primary          | `#e2e8f0`   | Main body text                     |
| Text secondary        | `rgba(255,255,255,0.35)` | Labels, subtitles     |
| Border                | `rgba(0,255,156,0.15)` | Card borders, dividers |
| User chat bubble      | `rgba(0,255,156,0.08)` | User message background|
| RootX chat bubble     | `rgba(255,255,255,0.03)` | AI response background|

## TYPOGRAPHY

| Element        | Font                     | Size      | Weight |
|----------------|--------------------------|-----------|--------|
| Logo           | Orbitron                 | 1.2rem    | 900    |
| Headings       | Orbitron                 | 0.85rem   | 700    |
| Body text      | Courier New, monospace   | 0.8rem    | 400    |
| Chat messages  | Inter, sans-serif        | 0.85rem   | 400    |
| Code blocks    | Fira Code, monospace     | 0.75rem   | 400    |
| Labels/badges  | Courier New, monospace   | 0.6rem    | 600    |

---

*This document defines the complete UI specification for the new RootX interface.*
