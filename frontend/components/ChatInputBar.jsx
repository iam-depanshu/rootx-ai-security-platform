"use client";
import { useState, useRef } from "react";

export default function ChatInputBar({ onSend, disabled }) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const fileRef = useRef(null);
  const inputRef = useRef(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    onSend({ text: trimmed, attachments: [...attachments] });
    setText("");
    setAttachments([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files.map((f) => ({ name: f.name, size: f.size, file: f }))]);
    e.target.value = "";
  };

  const removeAttachment = (i) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
  };

  return (
    <div>
      {attachments.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {attachments.map((a, i) => (
            <span key={i} style={{
              fontSize: "0.65rem", padding: "4px 10px", borderRadius: 4,
              background: "rgba(var(--accent-rgb),0.08)", border: "1px solid var(--border)",
              color: "var(--foreground)", display: "flex", alignItems: "center", gap: 6,
            }}>
              {a.name}
              <button onClick={() => removeAttachment(i)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.7rem", padding: 0 }}>✕</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10,
            padding: "10px 12px", color: "var(--text-muted)", cursor: "pointer", fontSize: "1rem",
            lineHeight: 1, transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
          title="Attach file"
        >
          +
        </button>
        <input ref={fileRef} type="file" onChange={handleFileSelect} style={{ display: "none" }} multiple />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask RootX anything..."
          disabled={disabled}
          style={{
            flex: 1, background: "var(--card-bg)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "14px 18px", color: "var(--foreground)",
            fontSize: "0.85rem", fontFamily: "var(--font-mono)", outline: "none",
            transition: "all 0.2s", letterSpacing: "0.03em",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-glow)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || (!text.trim() && attachments.length === 0)}
          style={{
            background: "var(--accent)", color: "var(--background)", border: "none",
            borderRadius: 10, padding: "14px 24px", fontFamily: "var(--font-logo)",
            fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled || (!text.trim() && attachments.length === 0) ? 0.5 : 1,
            transition: "all 0.15s", whiteSpace: "nowrap",
          }}
        >
          {disabled ? "..." : "SEND ▶"}
        </button>
      </div>
    </div>
  );
}
