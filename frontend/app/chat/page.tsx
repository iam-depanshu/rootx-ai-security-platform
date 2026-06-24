"use client";

import { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

/* ─── Types ─── */
type MessageRole = "user" | "assistant" | "system";

type VulnFinding = {
  severity: string;
  name: string;
  file?: string;
  line?: number;
  detail: string;
  fix: string;
  patch?: { before: string; after: string };
};

type ChatMessage = {
  id: number;
  role: MessageRole;
  content: string;
  vulns?: VulnFinding[];
  timestamp: string;
  streaming?: boolean;
};

/* ─── Severity Config ─── */
const SEV: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  CRITICAL: { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)', icon: '☠' },
  HIGH:     { color: '#fb923c', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.3)',  icon: '⚠' },
  MEDIUM:   { color: '#facc15', bg: 'rgba(250,204,21,0.08)',  border: 'rgba(250,204,21,0.3)',  icon: '◎' },
  LOW:      { color: '#22d3ee', bg: 'rgba(34,211,238,0.08)',  border: 'rgba(34,211,238,0.3)',  icon: '▸' },
};

/* ─── Quick Actions ─── */
const QUICK_ACTIONS = [
  { icon: '🔍', label: 'Scan Website', prompt: 'Scan https://example.com for vulnerabilities' },
  { icon: '📂', label: 'Audit Repo', prompt: 'Audit the GitHub repository https://github.com/user/app' },
  { icon: '🔧', label: 'Check Ports', prompt: 'Check what ports are open on my server' },
  { icon: '📦', label: 'Check Dependencies', prompt: 'Check my package.json for vulnerable dependencies' },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgId = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);

    // Add user message
    const userMsg: ChatMessage = {
      id: msgId.current++,
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Add placeholder assistant message
    const assistantId = msgId.current++;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, assistantMsg]);

    // Call backend
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();

      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: data.response || 'I could not process that request.', vulns: data.vulns, streaming: false }
          : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Error: Could not connect to RootX backend. Make sure the server is running on port 4000.', streaming: false }
          : m
      ));
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
      <Sidebar />

      {/* Main Content Area */}
      <div style={{
        marginLeft: 220,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
      }}>

        {/* Chat Messages Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px 24px 120px',
          maxWidth: 900,
          margin: '0 auto',
          width: '100%',
        }}>
          {/* Welcome Screen (shown when no messages) */}
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 80 }}>
              <div style={{
                fontFamily: "var(--font-logo)",
                fontSize: '1.8rem',
                fontWeight: 900,
                color: 'var(--accent)',
                letterSpacing: '0.15em',
                marginBottom: 12,
              }}>
                ROOTX
              </div>
              <div style={{
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.4)',
                maxWidth: 500,
                margin: '0 auto 40px',
                lineHeight: 1.6,
              }}>
                I&apos;m your AI security agent. Ask me to scan a website, audit a
                GitHub repo, check open ports, or analyze code for vulnerabilities.
              </div>

              {/* Quick Action Buttons */}
              <div style={{
                display: 'flex',
                gap: 12,
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginBottom: 40,
              }}>
                {QUICK_ACTIONS.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(action.prompt)}
                    style={{
                      background: 'rgba(var(--accent-rgb),0.03)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '14px 20px',
                      color: 'var(--foreground)',
                      opacity: 0.7,
                      fontSize: '0.75rem',
                      fontFamily: "var(--font-mono)",
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      letterSpacing: '0.04em',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.color = 'var(--accent)';
                      e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.08)';
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--foreground)';
                      e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.03)';
                      e.currentTarget.style.opacity = '0.7';
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>{action.icon}</span>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <div key={msg.id} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 16,
            }}>
              <div style={{
                maxWidth: msg.role === 'user' ? '70%' : '85%',
                padding: '14px 18px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user'
                  ? 'rgba(var(--accent-rgb),0.06)'
                  : 'var(--card-bg)',
                border: msg.role === 'user'
                  ? '1px solid var(--border-hover)'
                  : '1px solid var(--border)',
                fontSize: '0.82rem',
                lineHeight: 1.7,
                color: 'var(--foreground)',
                fontFamily: msg.role === 'user'
                  ? "var(--font-mono)"
                  : "var(--font-sans)",
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {/* Role Label */}
                <div style={{
                  fontSize: '0.55rem',
                  letterSpacing: '0.15em',
                  color: msg.role === 'user' ? 'var(--accent)' : 'var(--text-muted)',
                  fontFamily: "var(--font-mono)",
                  marginBottom: 6,
                  fontWeight: 700,
                }}>
                  {msg.role === 'user' ? 'YOU' : 'ROOTX'}
                </div>

                {/* Message Content */}
                {msg.streaming && !msg.content ? (
                  <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'blink 1.4s infinite both', animationDelay: '0.2s' }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'blink 1.4s infinite both', animationDelay: '0.4s' }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'blink 1.4s infinite both', animationDelay: '0.6s' }} />
                  </div>
                ) : (
                  msg.content
                )}

                {/* Vulnerability Cards */}
                {msg.vulns && msg.vulns.length > 0 && (
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {msg.vulns.map((v, i) => {
                      const sev = SEV[v.severity] || SEV.LOW;
                      return (
                        <div key={i} style={{
                          background: sev.bg,
                          border: `1px solid ${sev.border}`,
                          borderRadius: 8,
                          padding: '14px 16px',
                        }}>
                          {/* Header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{
                              fontSize: '0.6rem', padding: '2px 8px', borderRadius: 3,
                              border: `1px solid ${sev.border}`,
                              color: sev.color, fontWeight: 700,
                              fontFamily: "var(--font-mono)",
                              letterSpacing: '0.1em',
                            }}>
                              {v.severity}
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)' }}>
                              {sev.icon} {v.name}
                            </span>
                          </div>

                          {/* File/Line */}
                          {v.file && (
                            <div style={{
                              fontSize: '0.68rem', color: 'var(--text-muted)',
                              fontFamily: "var(--font-mono)",
                              marginBottom: 6,
                            }}>
                              📄 {v.file}{v.line ? `:${v.line}` : ''}
                            </div>
                          )}

                          {/* Detail */}
                          <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.6)', marginBottom: 8, lineHeight: 1.5 }}>
                            {v.detail}
                          </div>

                          {/* Code Diff */}
                          {v.patch && (
                            <div style={{
                              background: 'rgba(0,0,0,0.3)',
                              borderRadius: 6,
                              padding: '10px 14px',
                              fontFamily: "var(--font-mono)",
                              fontSize: '0.7rem',
                              marginBottom: 10,
                              border: '1px solid var(--border)',
                            }}>
                              <div style={{ color: '#f87171' }}>- {v.patch.before}</div>
                              <div style={{ color: 'var(--accent)' }}>+ {v.patch.after}</div>
                            </div>
                          )}

                          {/* Fix */}
                          <div style={{ fontSize: '0.68rem', color: 'var(--accent)', fontFamily: "var(--font-mono)" }}>
                            ▸ Fix: {v.fix}
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button style={{
                              fontSize: '0.6rem', padding: '5px 12px', borderRadius: 4,
                              border: '1px solid var(--border-hover)',
                              background: 'rgba(var(--accent-rgb), 0.08)',
                              color: 'var(--accent)', cursor: 'pointer',
                              fontFamily: "var(--font-mono)",
                              letterSpacing: '0.05em',
                            }}>
                              📋 Copy Fix
                            </button>
                            <button style={{
                              fontSize: '0.6rem', padding: '5px 12px', borderRadius: 4,
                              border: 'none',
                              background: 'var(--accent)',
                              color: 'var(--background)', cursor: 'pointer',
                              fontFamily: "var(--font-mono)",
                              fontWeight: 700,
                              letterSpacing: '0.05em',
                            }}>
                              ⚡ Open Pull Request
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar (fixed at bottom) */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 220,
          right: 0,
          padding: '16px 24px 20px',
          background: 'linear-gradient(transparent, var(--background) 30%)',
        }}>
          <div style={{
            maxWidth: 900,
            margin: '0 auto',
            display: 'flex',
            gap: 10,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask RootX anything..."
              disabled={sending}
              style={{
                flex: 1,
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '14px 18px',
                color: 'var(--foreground)',
                fontSize: '0.85rem',
                fontFamily: "var(--font-mono)",
                outline: 'none',
                transition: 'all 0.2s',
                letterSpacing: '0.03em',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-glow)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={sending || !input.trim()}
              style={{
                background: 'var(--accent)',
                color: 'var(--background)',
                border: 'none',
                borderRadius: 10,
                padding: '14px 24px',
                fontFamily: "var(--font-logo)",
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                cursor: sending ? 'not-allowed' : 'pointer',
                opacity: sending || !input.trim() ? 0.5 : 1,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {sending ? '...' : 'SEND ▶'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');
        @keyframes blink {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }
        input::placeholder { color: rgba(255,255,255,0.2); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,156,0.15); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0,255,156,0.3); }
      `}</style>
    </div>
  );
}
