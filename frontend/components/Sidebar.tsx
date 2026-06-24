"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/chat", icon: "💬", label: "Chat" },
  { href: "/dashboard", icon: "📊", label: "Monitor" },
  { href: "/history", icon: "📜", label: "History" },
  { href: "/protected", icon: "🛡️", label: "Threat Monitor" },
  { href: "/mitm", icon: "🔀", label: "MITM Proxy" },
  { href: "/settings", icon: "⚙️", label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 220,
      minHeight: '100vh',
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        padding: '0 24px 28px',
        borderBottom: '1px solid var(--border)',
        marginBottom: 12,
      }}>
        <div style={{
          fontFamily: "var(--font-logo)",
          fontSize: '1.3rem',
          fontWeight: 900,
          color: 'var(--accent)',
          letterSpacing: '0.2em',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 12px var(--accent-glow)',
            animation: 'pulse-dot 2s ease-in-out infinite',
          }} />
          ROOTX
        </div>
        <div style={{
          fontSize: '0.55rem',
          color: 'var(--text-muted)',
          letterSpacing: '0.15em',
          marginTop: 6,
          fontFamily: "var(--font-mono)",
        }}>
          AI SECURITY AGENT
        </div>
      </div>

      {/* Nav Items */}
      <nav style={{ flex: 1, padding: '0 12px' }}>
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                marginBottom: 4,
                borderRadius: 8,
                fontSize: '0.78rem',
                fontFamily: "var(--font-mono)",
                letterSpacing: '0.06em',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                background: isActive ? 'rgba(var(--accent-rgb), 0.08)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}>
                <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid var(--border)',
        fontSize: '0.5rem',
        color: 'var(--text-muted)',
        fontFamily: "var(--font-mono)",
        letterSpacing: '0.1em',
      }}>
        ROOTX v2.0 · AMD POWERED
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </aside>
  );
}
