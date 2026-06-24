# RootX — Pre-AMD Action Plan
## What to Fix, What to Add, and Z+ Self-Security Hardening

While waiting for AMD credits, here is everything we need to work on.

---

## PART 1: WHAT TO FIX (Current Bugs & Issues)

### Fix 1: False Positive Elimination (CRITICAL)
**Files**: `backend/modules/sensitive-files.js`, `backend/modules/admin-panels.js`
**New File**: `backend/engines/baseline.js`

**The Problem**: RootX reports Instagram, Google, and other major sites as
having exposed `.env` files, admin panels, and sensitive data — all false.

**The Fix**:
- Create a baseline checker that first requests a random non-existent path
  (e.g., `/rootx-test-nonexistent-12345`) to learn what the site's default
  "not found" response looks like.
- Compare all subsequent scan results against this baseline.
- If a response to `/.env` looks identical to the baseline (same status,
  same content-type, similar body length), it is a false positive → skip it.
- Check `Content-Type` header: real `.env` files return `text/plain`, not
  `text/html`.
- For admin panels: verify the response body contains actual login elements
  (`<input type="password">`, `<form`, `login`, `sign in`) not just any HTML.

**Status**: [ ] Not started

---

### Fix 2: Supabase Environment Variables
**File**: `frontend/lib/supabase.ts`

**The Problem**: Currently uses placeholder fallback strings. During build,
Next.js may not load `.env.local` properly if it's not in the frontend dir.

**The Fix**:
- Ensure `.env.local` exists inside `D:\rootx\frontend\` (already copied).
- The fallback placeholder prevents build crashes but won't connect to the
  real database. Verify the real keys load at runtime.

**Status**: [x] Partially fixed (fallback added, needs runtime verification)

---

### Fix 3: `window is not defined` Error on /protected Page
**File**: `frontend/app/protected/page.tsx`

**The Problem**: During `npm run build`, the `/protected` page throws
`ReferenceError: window is not defined` because it accesses browser APIs
during server-side rendering.

**The Fix**:
- Wrap any `window` or `document` access inside a `useEffect` hook or
  behind a `typeof window !== 'undefined'` check.
- Add `"use client"` directive at the top of the file if missing.

**Status**: [ ] Not started

---

### Fix 4: Backend Missing Dependencies
**Files**: `backend/package.json`

**The Problem**: `dotenv` and `axios` were not listed in package.json but
were required by the code. We installed them manually.

**The Fix**:
- Verify `dotenv` and `axios` are now in `package.json` dependencies.
- Run `npm ls` to check for any other missing or broken dependencies.

**Status**: [x] Fixed (installed via npm install)

---

## PART 2: WHAT TO ADD (New Features to Build)

### Feature 1: Chat Interface (Main Page Replacement)
**Priority**: HIGH
**New Files**:
```
frontend/app/chat/page.tsx         ← Chat page component
frontend/components/ChatMessage.tsx ← Individual message bubble
frontend/components/VulnCard.tsx    ← Vulnerability card in chat
frontend/components/CodeDiff.tsx    ← Before/after code block
frontend/components/Sidebar.tsx     ← Persistent navigation sidebar
frontend/app/layout.tsx             ← Updated with sidebar layout
```

**What it does**: Replaces the current URL-scanner landing page with an AI
chat interface where users talk to RootX in natural language.

**Status**: [ ] Not started

---

### Feature 2: AI Agent Engine (Backend Brain)
**Priority**: HIGH
**New Files**:
```
backend/engines/agent.js           ← Core agent logic
backend/engines/prompt-templates.js ← System prompts for different tasks
```

**What it does**: Receives user messages, sends them to the LLM (AMD GPU
or API), parses the response, decides which security module to run, and
streams results back to the frontend.

**Status**: [ ] Not started

---

### Feature 3: Dynamic Web Crawler
**Priority**: MEDIUM
**New File**: `backend/engines/crawler.js`
**Install**: `npm install playwright`

**What it does**: Launches a headless browser to crawl target websites,
executing JavaScript, following links, and mapping the full application
structure including SPAs (React, Angular, Vue apps).

**Status**: [ ] Not started

---

### Feature 4: Code Repository Auditor
**Priority**: HIGH
**New File**: `backend/engines/code-auditor.js`

**What it does**: Clones a GitHub repository, reads source files, sends
suspicious code to the LLM for security analysis, and returns structured
vulnerability findings with line numbers and patches.

**Status**: [ ] Not started

---

### Feature 5: Auto-Fix Pull Request Engine
**Priority**: HIGH
**New File**: `backend/engines/remediation.js`
**Install**: `npm install @octokit/rest`

**What it does**: Takes a confirmed vulnerability with its code patch,
creates a Git branch, commits the fix, and opens a Pull Request on the
user's repository automatically.

**Status**: [ ] Not started

---

### Feature 6: Dependency CVE Checker
**Priority**: MEDIUM
**New File**: `backend/engines/dep-checker.js`

**What it does**: Reads `package.json`, `requirements.txt`, or similar
dependency files and queries the OSV.dev API to check each package for
known CVEs (Common Vulnerabilities and Exposures).

**API**: `https://api.osv.dev/v1/query` (free, no API key needed)

**Status**: [ ] Not started

---

### Feature 7: Monitoring Dashboard
**Priority**: MEDIUM
**New Files**:
```
frontend/app/monitor/page.tsx       ← Dashboard page
frontend/components/TrafficGraph.tsx ← Network traffic visualization
frontend/components/PortsList.tsx    ← Open ports display
frontend/components/ActivityFeed.tsx ← Live event feed
frontend/components/DepHealth.tsx    ← Dependency health panel
```

**What it does**: Live monitoring panels showing security overview, network
traffic, open ports, recent vulnerabilities, dependency health, and activity feed.

**Status**: [ ] Not started

---

## PART 3: Z+ SELF-SECURITY HARDENING

RootX provides security to others, so RootX itself MUST be extremely secure.
If someone hacks the security tool, they can see every vulnerability of every
client. This section defines how to make RootX itself unhackable.

### Security Layer 1: Encrypted Data at Rest
**What**: All scan results, vulnerability data, user credentials, and API
tokens stored in the database MUST be encrypted.

**How**:
- Use Supabase Row Level Security (RLS) to ensure users can only access
  their own data.
- Encrypt sensitive fields (GitHub tokens, API keys) using AES-256
  encryption before storing in the database.
- Store the encryption key in environment variables, NOT in code.
- Never log sensitive data (tokens, passwords, scan results) to console.

**Implementation**:
```javascript
// backend/utils/crypto.js
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ROOTX_ENCRYPTION_KEY; // 32 bytes
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
```

---

### Security Layer 2: Encrypted Data in Transit
**What**: All communication between frontend ↔ backend ↔ LLM must be encrypted.

**How**:
- Use HTTPS for all API endpoints (TLS 1.3).
- Use WSS (WebSocket Secure) for Socket.IO connections.
- Set up SSL certificates using Let's Encrypt (free) for production.
- For the AMD GPU connection, use SSH tunnel or VPN to encrypt LLM traffic.

**Implementation**:
```bash
# SSH tunnel to AMD GPU (encrypts LLM traffic)
ssh -L 8000:localhost:8000 root@<amd-gpu-ip>
# Now your backend connects to localhost:8000 (encrypted through SSH)
```

---

### Security Layer 3: Authentication & Authorization
**What**: Only authenticated users can access RootX. Each user sees ONLY
their own data.

**How**:
- Use Supabase Auth for user authentication (email/password + OAuth).
- Every API request must include a valid JWT token.
- Backend verifies the token before processing any request.
- Supabase RLS policies enforce data isolation between users.

**Implementation**:
```javascript
// backend/middleware/auth.js
const { createClient } = require('@supabase/supabase-js');

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  req.user = user;
  next();
}
```

**Supabase RLS Policy**:
```sql
-- Users can only read their own scans
CREATE POLICY "Users see own scans" ON scans
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own scans
CREATE POLICY "Users insert own scans" ON scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

---

### Security Layer 4: API Rate Limiting & Abuse Prevention
**What**: Prevent attackers from abusing RootX to perform mass scans or
DDoS the LLM backend.

**How**:
- Rate limit all API endpoints (e.g., max 10 scans per minute per user).
- Rate limit chat messages (e.g., max 30 messages per minute).
- Rate limit failed auth attempts (e.g., max 5 per 15 minutes).
- Use express-rate-limit (already installed in backend).

**Implementation**:
```javascript
const rateLimit = require('express-rate-limit');

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 30,              // 30 requests per minute
  message: { error: 'Too many requests. Please slow down.' },
});

// Scan-specific rate limit (more restrictive)
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,               // 5 scans per minute
  message: { error: 'Scan rate limit reached. Wait before scanning again.' },
});

app.use('/api', apiLimiter);
app.use('/api/scan', scanLimiter);
app.use('/api/chat', apiLimiter);
```

---

### Security Layer 5: Input Sanitization & Validation
**What**: Prevent injection attacks against RootX itself.

**How**:
- Validate ALL user inputs (URLs, repo paths, chat messages).
- Sanitize URLs to prevent SSRF (Server-Side Request Forgery).
- Block internal/private IP ranges (127.0.0.1, 10.x.x.x, 192.168.x.x).
- Sanitize chat messages before sending to LLM (prevent prompt injection).
- Validate GitHub URLs to ensure they are real GitHub repos.

**Implementation**:
```javascript
// backend/utils/sanitize.js
const url = require('url');

function isValidTarget(target) {
  try {
    const parsed = new url.URL(target.startsWith('http') ? target : 'http://' + target);

    // Block internal IPs (SSRF prevention)
    const blocked = ['127.0.0.1', 'localhost', '0.0.0.0', '::1'];
    if (blocked.includes(parsed.hostname)) return false;

    // Block private IP ranges
    const ip = parsed.hostname;
    if (ip.startsWith('10.') || ip.startsWith('192.168.') ||
        ip.match(/^172\.(1[6-9]|2\d|3[01])\./)) return false;

    return true;
  } catch {
    return false;
  }
}

function sanitizeChatMessage(message) {
  // Remove potential prompt injection markers
  return message
    .replace(/```system/gi, '')
    .replace(/\[INST\]/gi, '')
    .replace(/<<SYS>>/gi, '')
    .slice(0, 2000); // Max 2000 characters
}
```

---

### Security Layer 6: Secure LLM Communication
**What**: Protect the AI model from prompt injection and ensure scan
data never leaks to unauthorized parties.

**How**:
- Never include user A's scan data in user B's LLM context.
- Each chat session has isolated conversation history.
- System prompt is hardcoded — users cannot modify it.
- LLM responses are parsed and sanitized before displaying.
- Never expose the raw LLM API endpoint to the frontend.

**Architecture**:
```
Frontend → Backend (auth check) → LLM API (AMD GPU)
                                       │
                              User NEVER talks to LLM directly.
                              Backend is the ONLY gateway.
```

---

### Security Layer 7: Audit Logging
**What**: Record every action performed in RootX for accountability.

**How**:
- Log every scan request (who, what target, when).
- Log every PR opened (who, which repo, what fix).
- Log every login attempt (success and failure).
- Store logs in a separate Supabase table with write-only access.
- Logs are append-only — no user can delete or modify them.

**Supabase Table**:
```sql
CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,       -- 'scan', 'audit', 'fix_pr', 'login', 'login_failed'
  target TEXT,                -- URL or repo that was scanned
  details JSONB,              -- Additional context
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No one can delete audit logs
CREATE POLICY "Append only" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- No UPDATE or DELETE policies = immutable logs
```

---

### Security Layer 8: Secure Deployment Checklist
Before deploying RootX to production:

- [ ] All API keys and secrets are in environment variables (never in code).
- [ ] HTTPS is enabled on frontend and backend.
- [ ] WSS (secure WebSocket) is enabled for Socket.IO.
- [ ] SSH tunnel or VPN is set up for AMD GPU communication.
- [ ] Supabase RLS policies are enabled and tested.
- [ ] Rate limiting is active on all endpoints.
- [ ] CORS is restricted to the frontend domain only (not "*").
- [ ] Input validation is active on all user inputs.
- [ ] Audit logging is recording all actions.
- [ ] GitHub tokens are AES-256 encrypted in the database.
- [ ] Error messages do not expose internal details to users.
- [ ] `helmet` middleware is added to Express for security headers.
- [ ] Dependencies are up-to-date with no known CVEs.

---

## BUILD ORDER (What to Do While Waiting for AMD Credits)

### This Week:
1. [ ] **Fix false positives** — Create baseline.js, update sensitive-files.js
       and admin-panels.js. Test with instagram.com.
2. [ ] **Fix /protected page** — Add SSR-safe window checks.
3. [ ] **Build Sidebar component** — Persistent navigation for new layout.
4. [ ] **Build Chat page** — Basic chat UI with message bubbles and input bar.

### Next Week:
5. [ ] **Build Agent Engine** — Connect to free Gemini API as placeholder LLM.
6. [ ] **Build Code Auditor** — Git clone + file reader + LLM analysis.
7. [ ] **Add Z+ Security** — Auth middleware, encryption, rate limiting, RLS.
8. [ ] **Build Monitoring Dashboard** — Security overview panels.

### When AMD Credits Arrive:
9. [ ] **Set up AMD GPU instance** — Deploy CodeLlama via vLLM.
10. [ ] **Switch LLM endpoint** — Point backend to AMD GPU.
11. [ ] **Build Remediation Engine** — Auto-fix PRs via GitHub API.
12. [ ] **Polish UI** — Animations, responsive design, final touches.
13. [ ] **Prepare demo** — Create test vulnerable app, practice 2-min pitch.

---

*This is your complete action plan. Start from the top and work down.*
