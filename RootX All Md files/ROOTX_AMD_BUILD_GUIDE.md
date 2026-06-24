# RootX on AMD — Complete Setup & Build Guide
## From Zero to a Working AI Cybersecurity Agent on AMD GPU

This guide takes you from enrolling in the AMD hackathon to having a working
RootX AI agent running on AMD GPU hardware.

---

## TABLE OF CONTENTS

1.  [Understanding the Architecture](#1-understanding-the-architecture)
2.  [Step 1: Set Up AMD Developer Cloud GPU](#step-1)
3.  [Step 2: Deploy the LLM on AMD GPU](#step-2)
4.  [Step 3: Build the AI Agent Backend](#step-3)
5.  [Step 4: Build the Chat Frontend](#step-4)
6.  [Step 5: Build the Code Auditor](#step-5)
7.  [Step 6: Build the Auto-Fix PR Engine](#step-6)
8.  [Step 7: Build the Monitoring Dashboard](#step-7)
9.  [Step 8: Connect Everything Together](#step-8)
10. [Step 9: Test & Demo Preparation](#step-9)
11. [Budget Breakdown](#budget-breakdown)

---

## 1. UNDERSTANDING THE ARCHITECTURE

RootX is NOT an LLM itself. RootX is a PLATFORM that USES an LLM as its brain.

Think of it this way:
- The LLM (CodeLlama/Mistral) = The brain (runs on AMD GPU)
- The RootX Backend (Express.js) = The body (orchestrates actions)
- The RootX Frontend (Next.js) = The face (user interface)

```
┌─────────────────────────────────────────────────────────────────┐
│                    AMD DEVELOPER CLOUD                           │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  GPU INSTANCE (MI300X / MI210)                             │   │
│  │  ┌─────────────────────────────────────┐                   │   │
│  │  │  vLLM Server (OpenAI-compatible API)│                   │   │
│  │  │  Model: CodeLlama-13B-Instruct      │                   │   │
│  │  │  Endpoint: http://gpu-ip:8000/v1    │                   │   │
│  │  └─────────────────────────────────────┘                   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            │ API calls                           │
│                            ▼                                     │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                YOUR LOCAL MACHINE (or VPS)                        │
│                                                                   │
│  ┌──────────────────────┐    ┌──────────────────────────────┐    │
│  │  RootX Backend       │    │  RootX Frontend              │    │
│  │  (Express + Socket.IO)│◄──│  (Next.js + React)           │    │
│  │  Port 4000           │    │  Port 3000                   │    │
│  │                      │    │                              │    │
│  │  - Agent Logic       │    │  - Chat Interface            │    │
│  │  - Code Auditor      │    │  - Monitoring Dashboard      │    │
│  │  - Git PR Engine     │    │  - Vuln Cards + Auto-Fix     │    │
│  │  - Calls GPU LLM API │    │                              │    │
│  └──────────────────────┘    └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

The key insight: vLLM exposes an **OpenAI-compatible API**. This means your
RootX backend talks to the AMD GPU LLM using the exact same format as calling
OpenAI/ChatGPT. If you ever want to switch to a different LLM or use a
cloud API instead, you just change one URL.

---

## STEP 1: SET UP AMD DEVELOPER CLOUD GPU

### 1.1 Log into AMD Developer Cloud
- Go to: https://www.amd.com/en/developer/resources/developer-cloud.html
- Sign in with your AMD developer account (the one you used to enroll).
- You should see your $100 credits available.

### 1.2 Create a GPU Instance
- Click "Create Instance" or "New Droplet".
- Select the image: **"vLLM Quick Start"** (this has everything pre-installed).
  - If "vLLM Quick Start" is not available, select **"ROCm Software"** base image.
- Select GPU: **MI300X** (192GB HBM3) if available, otherwise **MI210** (64GB).
- Select the smallest CPU/RAM option (we only need the GPU).
- Set a root password or upload your SSH key.
- Click "Create".

### 1.3 Connect to Your Instance
Once the instance is running, connect via SSH:
```bash
ssh root@<your-instance-ip>
```

### 1.4 Verify GPU is Detected
```bash
rocm-smi
```
You should see your AMD GPU listed with temperature, memory, and usage info.
If this command works, your GPU is ready.

---

## STEP 2: DEPLOY THE LLM ON AMD GPU

### 2.1 If Using "vLLM Quick Start" Image (Easiest)
Everything is pre-installed. Just start the server:

```bash
# Start vLLM with CodeLlama 13B Instruct
vllm serve codellama/CodeLlama-13b-Instruct-hf \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90
```

### 2.2 If Using Base ROCm Image (Manual Setup)
```bash
# Pull the official vLLM Docker image for ROCm
docker pull vllm/vllm-openai-rocm:latest

# Run vLLM with CodeLlama
docker run -d \
  --name rootx-llm \
  --network=host \
  --device=/dev/kfd \
  --device=/dev/dri \
  --group-add=video \
  --ipc=host \
  --cap-add=SYS_PTRACE \
  --security-opt seccomp=unconfined \
  vllm/vllm-openai-rocm:latest \
  --model codellama/CodeLlama-13b-Instruct-hf \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90
```

### 2.3 Verify the LLM is Running
Wait 2-3 minutes for the model to load, then test:

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "codellama/CodeLlama-13b-Instruct-hf",
    "messages": [
      {"role": "system", "content": "You are RootX, a cybersecurity AI agent."},
      {"role": "user", "content": "What is SQL injection?"}
    ],
    "max_tokens": 200
  }'
```

If you get a JSON response with the AI's answer, your LLM is running on
AMD GPU! Note the URL: `http://<gpu-instance-ip>:8000` — this is what your
RootX backend will connect to.

### 2.4 Which Model to Choose?

| Model                          | Size  | GPU Memory | Best For                      |
|--------------------------------|-------|------------|-------------------------------|
| CodeLlama-7b-Instruct-hf      | 7B    | ~14GB      | Fast, fits on MI210, good for code |
| CodeLlama-13b-Instruct-hf     | 13B   | ~26GB      | Better reasoning, recommended |
| Mistral-7B-Instruct-v0.3      | 7B    | ~14GB      | Fast, good general + code ability |
| deepseek-coder-6.7b-instruct  | 6.7B  | ~14GB      | Specialized for code analysis |

**Recommended for hackathon**: CodeLlama-13b-Instruct (best balance of
code ability and speed on MI300X).

---

## STEP 3: BUILD THE AI AGENT BACKEND

This is the core of RootX. The backend receives user messages, decides what
action to take, calls the LLM for reasoning, and executes security checks.

### 3.1 Create the Agent Engine
Create a new file: `backend/engines/agent.js`

This file handles:
- Receiving user chat messages from the frontend.
- Building the system prompt that tells the LLM it is RootX.
- Sending the conversation to the vLLM API on the AMD GPU.
- Parsing the LLM response for actionable commands.
- Executing the appropriate security module based on the LLM's decision.
- Streaming the response back to the frontend via Socket.IO.

### 3.2 The System Prompt (The Soul of RootX)
The system prompt is what makes the LLM behave like a cybersecurity agent.
It tells the model WHO it is, WHAT it can do, and HOW to respond.

```
You are RootX, an autonomous AI cybersecurity agent.

You help users secure their applications by:
1. Scanning websites for vulnerabilities (SSL, headers, cookies, exposed files)
2. Auditing source code from GitHub repositories for security flaws
3. Checking open ports and service configurations
4. Generating code patches to fix vulnerabilities
5. Opening Git Pull Requests with the fixes

When a user asks you to scan or audit something, you will:
- Describe what you are checking
- Report findings with severity (CRITICAL, HIGH, MEDIUM, LOW)
- For each finding, provide the file path, line number, and a code fix
- Ask if the user wants you to auto-fix by opening a Pull Request

Format your vulnerability findings as structured JSON blocks:
{
  "type": "vulnerability",
  "severity": "CRITICAL",
  "name": "SQL Injection",
  "file": "controllers/auth.js",
  "line": 42,
  "detail": "User input concatenated into SQL query",
  "fix": "Use parameterized queries with $1 placeholders",
  "patch": {
    "before": "db.query('SELECT * FROM users WHERE id=' + id)",
    "after": "db.query('SELECT * FROM users WHERE id = $1', [id])"
  }
}
```

### 3.3 The Agent Loop
The agent works in a loop:

```
User sends message
       │
       ▼
Backend receives message via Socket.IO
       │
       ▼
Backend builds conversation history + system prompt
       │
       ▼
Backend sends to vLLM API (AMD GPU)
       │
       ▼
LLM responds with text + optional action commands
       │
       ▼
Backend parses response:
  - If LLM says "scan website X" → run Rule Engine modules
  - If LLM says "audit repo X" → run Code Auditor
  - If LLM says "fix vulnerability" → run Remediation Engine
  - If LLM says plain text → stream directly to frontend
       │
       ▼
Results streamed back to frontend via Socket.IO
```

### 3.4 API Route for Chat
Add to `backend/server.js`:
- `POST /api/chat` — receives user message, returns AI response
- Socket.IO event `chat:message` — for real-time streaming

### 3.5 Connect Backend to AMD GPU
The backend needs ONE environment variable to connect to the LLM:
```
# In backend/.env
LLM_API_URL=http://<your-amd-gpu-ip>:8000/v1
LLM_MODEL=codellama/CodeLlama-13b-Instruct-hf
```

The backend calls the LLM using the standard OpenAI chat completions format:
```javascript
const response = await fetch(`${LLM_API_URL}/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: LLM_MODEL,
    messages: conversationHistory,
    max_tokens: 2048,
    temperature: 0.1,  // Low temperature for precise security analysis
    stream: true,      // Stream response token by token
  }),
});
```

---

## STEP 4: BUILD THE CHAT FRONTEND

### 4.1 New Page Structure
Replace the current landing page with a sidebar + chat layout:

```
frontend/app/
├── layout.tsx          ← Root layout with sidebar
├── page.tsx            ← Redirect to /chat
├── chat/
│   └── page.tsx        ← AI Chat Agent (MAIN PAGE)
├── dashboard/
│   └── page.tsx        ← Security Monitoring Dashboard
├── history/
│   └── page.tsx        ← Scan History
└── settings/
    └── page.tsx        ← API Keys, GitHub Token config
```

### 4.2 Chat Page Components
- **ChatMessage**: Renders a single message (user or AI).
- **VulnerabilityCard**: Rendered inline when AI finds a vulnerability.
  Shows severity badge, file path, detail, code diff, and action buttons.
- **CodeDiffBlock**: Shows before/after code with red/green highlighting.
- **ChatInput**: Fixed at bottom, with send button and file upload.
- **StreamingText**: Handles character-by-character streaming from Socket.IO.

### 4.3 Sidebar Component
- Persistent left sidebar with navigation links.
- RootX logo at top.
- Menu items: Chat, Dashboard, History, Settings.
- Active item highlighted with green accent.
- Collapsible on mobile.

---

## STEP 5: BUILD THE CODE AUDITOR

### 5.1 Create: `backend/engines/code-auditor.js`

What this module does:
1. Receives a GitHub repository URL from the chat.
2. Clones the repository to a temporary directory.
3. Reads all source files and identifies critical ones:
   - JavaScript/TypeScript: `.js`, `.ts`, `.jsx`, `.tsx`
   - Python: `.py`
   - Configuration: `.env`, `config.*`, `docker-compose.*`
   - Dependencies: `package.json`, `requirements.txt`, `Gemfile`
4. For each critical file, sends the code to the LLM with a security
   analysis prompt.
5. Collects structured vulnerability findings from the LLM response.
6. Returns the findings to the agent, which formats them for the chat.

### 5.2 Git Clone Utility
```javascript
// Uses child_process to clone repos
const { execSync } = require('child_process');

function cloneRepo(repoUrl, targetDir) {
  execSync(`git clone --depth 1 ${repoUrl} ${targetDir}`, {
    timeout: 30000, // 30 second timeout
  });
}
```

### 5.3 File Classifier
Reads the cloned directory and categorizes files by risk level:
- **HIGH RISK**: Files containing database queries, auth logic, API routes
- **MEDIUM RISK**: Configuration files, middleware, utility functions
- **LOW RISK**: Static assets, documentation, tests

Only HIGH and MEDIUM risk files are sent to the LLM for analysis.

### 5.4 LLM Analysis Prompt Template
```
Analyze the following code file for security vulnerabilities.

File: {filename}
Language: {language}

```
{code_content}
```

For each vulnerability found, respond with this exact JSON format:
{
  "vulnerabilities": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "name": "Vulnerability Name",
      "line": 42,
      "detail": "What the issue is",
      "fix": "How to fix it",
      "patch": {
        "before": "vulnerable code line",
        "after": "fixed code line"
      }
    }
  ]
}

If no vulnerabilities are found, respond with:
{ "vulnerabilities": [] }
```

---

## STEP 6: BUILD THE AUTO-FIX PR ENGINE

### 6.1 Create: `backend/engines/remediation.js`

### 6.2 Prerequisites
- User provides a GitHub Personal Access Token in the Settings page.
- Token is stored in Supabase (encrypted) or in the session.
- Token needs `repo` scope (read/write access to repositories).

### 6.3 The Fix Pipeline
```
Step 1: Receive vulnerability + patch from Code Auditor
           │
Step 2: Use GitHub API to get the current file content
           │
Step 3: Apply the patch (replace old line with new line)
           │
Step 4: Create a new branch: "rootx/fix-{vuln-type}-{filename}"
           │
Step 5: Commit the patched file to the new branch
           │
Step 6: Open a Pull Request:
         - Title: "[RootX] Fix {vulnerability name} in {filename}"
         - Body: Description of the vulnerability + what was changed
         - Base: main branch
         - Head: the new fix branch
           │
Step 7: Return the PR URL to the chat interface
```

### 6.4 GitHub API Library
Install: `npm install @octokit/rest`

```javascript
const { Octokit } = require('@octokit/rest');

// User's token from settings
const octokit = new Octokit({ auth: userGitHubToken });

// Create branch, commit fix, open PR
async function openFixPR(owner, repo, filePath, oldContent, newContent, vulnName) {
  // ... implementation
}
```

---

## STEP 7: BUILD THE MONITORING DASHBOARD

### 7.1 Dashboard Components

**Security Overview Bar**:
- Pulls aggregate stats from Supabase: total scans, vulns found, fixed count.
- Calculates overall security score.

**Network Traffic Monitor**:
- For the hackathon demo, use simulated data with realistic patterns.
- In production, this would connect to a monitoring agent on the user's server.

**Open Ports Panel**:
- Backend provides a `/api/ports` endpoint.
- For local scanning, uses Node.js `net` module to check common ports.
- Displays port number, service name, and exposure status.

**Dependency Health Panel**:
- Reads `package.json` from the user's last audited repo.
- Queries the OSV.dev API (free, open-source vulnerability database) to
  check each dependency for known CVEs.
- Endpoint: `https://api.osv.dev/v1/query`

**Live Activity Feed**:
- Socket.IO event stream showing all RootX actions in real time.
- Events stored in Supabase for persistence.

---

## STEP 8: CONNECT EVERYTHING TOGETHER

### 8.1 Environment Variables (backend/.env)
```
# AMD GPU LLM Connection
LLM_API_URL=http://<amd-gpu-ip>:8000/v1
LLM_MODEL=codellama/CodeLlama-13b-Instruct-hf

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Server
PORT=4000
```

### 8.2 Environment Variables (frontend/.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

### 8.3 Start Everything
Terminal 1 (AMD Cloud — SSH):
```bash
# Start the LLM server on AMD GPU
vllm serve codellama/CodeLlama-13b-Instruct-hf --host 0.0.0.0 --port 8000
```

Terminal 2 (Your machine):
```bash
# Start RootX backend
cd D:\rootx\backend
node server.js
```

Terminal 3 (Your machine):
```bash
# Start RootX frontend
cd D:\rootx\frontend
npm run dev
```

Open browser: http://localhost:3000

---

## STEP 9: TEST & DEMO PREPARATION

### 9.1 Create a Test Vulnerable App
Create a small test repository on your GitHub with intentional vulnerabilities:

**test-app/server.js** (intentionally vulnerable):
```javascript
// SQL Injection vulnerability
app.get('/user', (req, res) => {
  db.query("SELECT * FROM users WHERE id=" + req.query.id);
});

// Hardcoded secret
const API_KEY = "sk-live-abc123secretkey";

// Missing auth middleware
app.get('/admin', (req, res) => {
  res.json(getAllUsers());
});
```

### 9.2 Demo Script (2 minutes)
1. Open RootX → Chat page loads.
2. Type: "Audit https://github.com/youruser/test-app"
3. Watch RootX stream:
   - "Cloning repository... ✓"
   - "Analyzing 3 files... ✓"
   - "Found 3 vulnerabilities:"
   - [Vulnerability cards appear with severity, code diffs, fix buttons]
4. Type: "Fix all vulnerabilities"
5. Watch RootX:
   - "Creating branch rootx/fix-sql-injection... ✓"
   - "Pull Request #1 opened: [link]"
6. Switch to Dashboard tab → Show monitoring panels.
7. End: "RootX — Autonomous AI Security Agent, powered by AMD GPU."

---

## BUDGET BREAKDOWN ($100 AMD Credits)

| Item                           | Est. Cost | Duration        |
|--------------------------------|-----------|-----------------|
| MI300X GPU instance            | ~$3/hr    | ~25 hours total |
| OR MI210 GPU instance          | ~$1.5/hr  | ~50 hours total |
| Storage for model weights      | ~$5       | Duration        |
| Network egress                 | ~$5       | Duration        |
| **Total estimated**            | **~$80-90** | Leaves buffer |

### Cost Optimization Tips:
- Only run the GPU instance when actively developing/testing.
- Shut down the instance when sleeping or not working.
- Use the 7B model (CodeLlama-7b) instead of 13B to use less GPU time.
- Download model weights once and save to persistent storage.

---

## WHAT TO BUILD FIRST (Priority Order)

1. **[NOW] Fix false positives** in existing scanner modules.
2. **[NOW] Create the chat frontend** (sidebar + chat page layout).
3. **[NEXT] Build the agent engine** (backend/engines/agent.js).
4. **[NEXT] Build the code auditor** (backend/engines/code-auditor.js).
5. **[LATER] Set up AMD GPU** and deploy LLM (when ready to test with real AI).
6. **[LATER] Build remediation engine** (backend/engines/remediation.js).
7. **[LATER] Build monitoring dashboard** panels.

You can build steps 1-4 using a free API (like Google Gemini free tier) as
a placeholder, then switch to your AMD GPU LLM when you're ready to deploy.

---

*This document is the complete technical guide for building RootX on AMD GPU.*
*Keep this file updated as you progress through the build.*
