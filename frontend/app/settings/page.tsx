"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

export default function SettingsPage() {
  const [geminiKey, setGeminiKey] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [llmUrl, setLlmUrl] = useState('https://generativelanguage.googleapis.com/v1beta');
  const [llmModel, setLlmModel] = useState('gemini-2.0-flash');
  const [saved, setSaved] = useState(false);

  /* ── Allowed domains for ethical guardrails ── */
  const [allowedDomains, setAllowedDomains] = useState<{ id: string; domain: string }[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const userId = typeof window !== "undefined" ? localStorage.getItem("rootx_user_id") || "" : "";

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/allowlist?userId=${userId}`)
      .then(r => r.json())
      .then(d => setAllowedDomains(d || []))
      .catch(() => {});
  }, [userId]);

  const addDomain = async () => {
    if (!newDomain.trim() || !userId) return;
    await fetch("/api/allowlist", {
      method: "POST",
      body: JSON.stringify({ domain: newDomain.trim(), userId }),
    });
    setNewDomain("");
    const res = await fetch(`/api/allowlist?userId=${userId}`);
    const data = await res.json();
    setAllowedDomains(data || []);
  };

  const removeDomain = async (id: string) => {
    await fetch("/api/allowlist", { method: "DELETE", body: JSON.stringify({ id }) });
    setAllowedDomains(prev => prev.filter(d => d.id !== id));
  };

  const handleSave = () => {
    // In production, these would be saved to Supabase or backend
    // For now, store in localStorage
    localStorage.setItem('rootx_gemini_key', geminiKey);
    localStorage.setItem('rootx_github_token', githubToken);
    localStorage.setItem('rootx_llm_url', llmUrl);
    localStorage.setItem('rootx_llm_model', llmModel);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const inputStyle = {
    width: '100%',
    background: 'var(--card-bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '12px 16px',
    color: 'var(--foreground)',
    fontSize: '0.78rem',
    fontFamily: "var(--font-mono)",
    outline: 'none',
    letterSpacing: '0.03em',
    boxSizing: 'border-box' as const,
  };

  const labelStyle = {
    fontSize: '0.65rem',
    fontFamily: "var(--font-mono)",
    color: 'var(--text-muted)',
    letterSpacing: '0.12em',
    marginBottom: 8,
    display: 'block' as const,
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, padding: '32px 28px', maxWidth: 700 }}>
        {/* Header */}
        <div style={{
          fontFamily: "var(--font-logo)",
          fontSize: '0.85rem', fontWeight: 700,
          color: 'var(--accent)', letterSpacing: '0.15em',
          marginBottom: 8,
        }}>SETTINGS</div>
        <div style={{
          fontSize: '0.7rem', color: 'var(--text-muted)',
          fontFamily: "var(--font-mono)", marginBottom: 32,
        }}>Configure API keys, LLM endpoints, and integrations</div>

        {/* AI Engine Section */}
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 10, padding: '22px 24px', marginBottom: 16,
        }}>
          <div style={{
            fontFamily: "var(--font-logo)", fontSize: '0.6rem',
            color: 'var(--text-muted)', letterSpacing: '0.15em',
            marginBottom: 18,
          }}>AI ENGINE</div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>GEMINI API KEY</label>
            <input
              type="password"
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
              placeholder="AIza..."
              style={inputStyle}
            />
            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 6, fontFamily: "var(--font-mono)" }}>
              Get a free key at aistudio.google.com/apikey
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>LLM API URL</label>
            <input
              value={llmUrl}
              onChange={e => setLlmUrl(e.target.value)}
              placeholder="https://generativelanguage.googleapis.com/v1beta"
              style={inputStyle}
            />
            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 6, fontFamily: "var(--font-mono)" }}>
              For AMD GPU: http://your-gpu-ip:8000/v1
            </div>
          </div>

          <div style={{ marginBottom: 0 }}>
            <label style={labelStyle}>MODEL NAME</label>
            <input
              value={llmModel}
              onChange={e => setLlmModel(e.target.value)}
              placeholder="gemini-2.0-flash"
              style={inputStyle}
            />
            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 6, fontFamily: "var(--font-mono)" }}>
              For AMD GPU: codellama/CodeLlama-13b-Instruct-hf
            </div>
          </div>
        </div>

        {/* GitHub Integration Section */}
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 10, padding: '22px 24px', marginBottom: 16,
        }}>
          <div style={{
            fontFamily: "var(--font-logo)", fontSize: '0.6rem',
            color: 'var(--text-muted)', letterSpacing: '0.15em',
            marginBottom: 18,
          }}>GITHUB INTEGRATION</div>

          <div>
            <label style={labelStyle}>PERSONAL ACCESS TOKEN</label>
            <input
              type="password"
              value={githubToken}
              onChange={e => setGithubToken(e.target.value)}
              placeholder="ghp_..."
              style={inputStyle}
            />
            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 6, fontFamily: "var(--font-mono)" }}>
              Required for auto-fix Pull Requests. Needs &apos;repo&apos; scope.
            </div>
          </div>
        </div>

        {/* Allowed Domains Section */}
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 10, padding: '22px 24px', marginBottom: 16,
        }}>
          <div style={{
            fontFamily: "var(--font-logo)", fontSize: '0.6rem',
            color: 'var(--text-muted)', letterSpacing: '0.15em',
            marginBottom: 18,
          }}>ALLOWED SCAN DOMAINS</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12, fontFamily: "var(--font-mono)" }}>
            Only these domains will be scanned. If empty, any domain is allowed.
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addDomain()}
              placeholder="example.com"
              style={{
                flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '10px 14px', color: 'var(--foreground)',
                fontSize: '0.78rem', fontFamily: "var(--font-mono)", outline: 'none',
              }}
            />
            <button onClick={addDomain} style={{
              background: 'var(--accent)', color: 'var(--background)', border: 'none',
              borderRadius: 6, padding: '10px 20px', fontFamily: "var(--font-mono)",
              fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
            }}>
              ADD
            </button>
          </div>
          {allowedDomains.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {allowedDomains.map(d => (
                <div key={d.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 6,
                  border: "1px solid var(--border)",
                }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--foreground)", fontFamily: "var(--font-mono)" }}>{d.domain}</span>
                  <button onClick={() => removeDomain(d.id)} style={{
                    background: "none", border: "none", color: "#f87171", cursor: "pointer",
                    fontSize: "0.65rem", fontFamily: "var(--font-mono)",
                  }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          style={{
            background: saved ? 'rgba(var(--accent-rgb), 0.15)' : 'var(--accent)',
            color: saved ? 'var(--accent)' : 'var(--background)',
            border: saved ? '1px solid var(--accent)' : 'none',
            borderRadius: 8,
            padding: '12px 32px',
            fontFamily: "var(--font-logo)",
            fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.1em',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {saved ? '✓ SAVED' : 'SAVE SETTINGS'}
        </button>

        {/* Security Notice */}
        <div style={{
          marginTop: 28, padding: '14px 18px',
          background: 'rgba(var(--accent-rgb), 0.03)',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--accent)', fontFamily: "var(--font-logo)", letterSpacing: '0.1em', marginBottom: 6 }}>
            🔒 SECURITY
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.6, fontFamily: "var(--font-mono)" }}>
            API keys are stored locally in your browser. In production, they will be encrypted
            with AES-256 and stored in the database. Keys are never sent to any third party.
          </div>
        </div>
      </div>
      <style>{`
        input::placeholder { color: rgba(255,255,255,0.15); }
        input:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 2px var(--accent-glow); }
      `}</style>
    </div>
  );
}
