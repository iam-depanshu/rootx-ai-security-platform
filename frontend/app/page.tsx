"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RootXBadge from "@/components/RootXBadge";

/* ─────────────────────────────────────────────
   TYPEWRITER HOOK
───────────────────────────────────────────── */
function useTypewriter(phrases: string[], speed = 60, pause = 1800) {
  const [displayed, setDisplayed] = useState("");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[phraseIdx];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && displayed.length < current.length) {
      timeout = setTimeout(
        () => setDisplayed(current.slice(0, displayed.length + 1)),
        speed
      );
    } else if (!deleting && displayed.length === current.length) {
      timeout = setTimeout(() => setDeleting(true), pause);
    } else if (deleting && displayed.length > 0) {
      timeout = setTimeout(
        () => setDisplayed(displayed.slice(0, -1)),
        speed / 2
      );
    } else if (deleting && displayed.length === 0) {
      setDeleting(false);
      setPhraseIdx((i) => (i + 1) % phrases.length);
    }
    return () => clearTimeout(timeout);
  }, [displayed, deleting, phraseIdx, phrases, speed, pause]);

  return displayed;
}

/* ─────────────────────────────────────────────
   ANIMATED COUNTER
───────────────────────────────────────────── */
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.floor(v).toLocaleString());
  const [val, setVal] = useState("0");

  useEffect(() => {
    const unsubscribe = rounded.on("change", setVal);
    const controls = animate(count, to, { duration: 2.5, ease: "easeOut" });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [count, rounded, to]);
<RootXBadge />
  return (
    <span>
      {val}
      {suffix}
    </span>
  );
}

/* ─────────────────────────────────────────────
   MATRIX RAIN CANVAS
───────────────────────────────────────────── */
function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const fontSize = 13;
    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノ".split("");
    let cols = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array(cols).fill(1);

    const draw = () => {
      ctx.fillStyle = "rgba(5, 8, 22, 0.06)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;

      cols = Math.floor(canvas.width / fontSize);
      while (drops.length < cols) drops.push(Math.random() * -100);

      for (let i = 0; i < drops.length; i++) {
        const opacity = Math.random() * 0.5 + 0.1;
        ctx.fillStyle = `rgba(0, 255, 156, ${opacity})`;
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975)
          drops[i] = 0;
        drops[i]++;
      }
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full opacity-20"
      style={{ pointerEvents: "none" }}
    />
  );
}

/* ─────────────────────────────────────────────
   GLITCH TEXT
───────────────────────────────────────────── */
function GlitchTitle() {
  return (
    <div className="relative inline-block select-none" aria-label="RootX">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@900&display=swap');

        .glitch {
          font-family: 'Orbitron', monospace;
          font-size: clamp(5rem, 14vw, 10rem);
          font-weight: 900;
          color: #00FF9C;
          letter-spacing: -2px;
          text-shadow:
            0 0 20px rgba(0,255,156,0.8),
            0 0 60px rgba(0,255,156,0.4),
            0 0 120px rgba(0,255,156,0.15);
          position: relative;
          display: inline-block;
        }

        .glitch::before,
        .glitch::after {
          content: attr(data-text);
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          font-family: 'Orbitron', monospace;
          font-size: inherit;
          font-weight: 900;
        }

        .glitch::before {
          color: #ff0055;
          animation: glitch-before 3.5s infinite;
          clip-path: polygon(0 30%, 100% 30%, 100% 50%, 0 50%);
        }

        .glitch::after {
          color: #0af;
          animation: glitch-after 3.5s infinite;
          clip-path: polygon(0 55%, 100% 55%, 100% 75%, 0 75%);
        }

        @keyframes glitch-before {
          0%,80%,100% { transform: translate(0); opacity: 0; }
          82%          { transform: translate(-4px, 1px); opacity: 0.8; }
          84%          { transform: translate(4px, -1px); opacity: 0.8; }
          86%          { transform: translate(-2px, 2px); opacity: 0.8; }
          88%          { transform: translate(0); opacity: 0; }
        }

        @keyframes glitch-after {
          0%,84%,100% { transform: translate(0); opacity: 0; }
          86%          { transform: translate(4px, -2px); opacity: 0.7; }
          88%          { transform: translate(-4px, 2px); opacity: 0.7; }
          90%          { transform: translate(2px, -1px); opacity: 0.7; }
          92%          { transform: translate(0); opacity: 0; }
        }

        .scan-line {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            transparent 0%,
            rgba(0,255,156,0.04) 50%,
            transparent 100%
          );
          background-size: 100% 4px;
          animation: scan 8s linear infinite;
          pointer-events: none;
        }

        @keyframes scan {
          from { background-position: 0 0; }
          to   { background-position: 0 100vh; }
        }

        .blink {
          animation: blink 1s step-end infinite;
        }
        @keyframes blink {
          50% { opacity: 0; }
        }

        .tag-badge {
          font-family: 'Courier New', monospace;
          font-size: 0.7rem;
          letter-spacing: 0.15em;
          padding: 4px 12px;
          border: 1px solid rgba(0,255,156,0.35);
          border-radius: 2px;
          color: #00FF9C;
          background: rgba(0,255,156,0.06);
        }

        .stat-card {
          border: 1px solid rgba(0,255,156,0.2);
          background: rgba(0,255,156,0.04);
          border-radius: 4px;
          padding: 1.25rem 1.5rem;
          backdrop-filter: blur(8px);
          position: relative;
          overflow: hidden;
        }

        .stat-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 3px; height: 100%;
          background: #00FF9C;
        }

        .btn-primary {
          font-family: 'Orbitron', monospace;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #050816;
          background: #00FF9C;
          padding: 14px 32px;
          border: none;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
        }

        .btn-primary:hover {
          background: #fff;
          box-shadow: 0 0 30px rgba(0,255,156,0.6);
        }

        .btn-secondary {
          font-family: 'Orbitron', monospace;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #00FF9C;
          background: transparent;
          padding: 13px 32px;
          border: 1px solid rgba(0,255,156,0.5);
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
        }

        .btn-secondary:hover {
          background: rgba(0,255,156,0.08);
          border-color: #00FF9C;
        }

        .scan-input-wrapper {
          display: flex;
          align-items: stretch;
          border: 1px solid rgba(0,255,156,0.4);
          border-radius: 2px;
          overflow: hidden;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(8px);
          width: 100%;
          max-width: 560px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .scan-input-wrapper:focus-within {
          border-color: #00FF9C;
          box-shadow: 0 0 20px rgba(0,255,156,0.2);
        }

        .scan-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #fff;
          font-family: 'Courier New', monospace;
          font-size: 0.85rem;
          padding: 14px 16px;
          letter-spacing: 0.05em;
        }

        .scan-input::placeholder {
          color: rgba(255,255,255,0.25);
        }
      `}</style>
      <span className="glitch" data-text="RootX">
        RootX
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   FLOATING ORBS
───────────────────────────────────────────── */
function FloatingOrbs() {
  const orbs = [
    { w: 300, x: "10%", y: "20%", delay: 0 },
    { w: 200, x: "75%", y: "60%", delay: 1.5 },
    { w: 150, x: "50%", y: "80%", delay: 3 },
    { w: 100, x: "30%", y: "10%", delay: 2 },
  ];
  return (
    <>
      {orbs.map((o, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: o.w,
            height: o.w,
            left: o.x,
            top: o.y,
            background: `radial-gradient(circle, rgba(0,255,156,0.12) 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{
            duration: 6,
            delay: o.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────
   THREAT TAGS TICKER
───────────────────────────────────────────── */
const threats = [
  "SQL INJECTION",
  "XSS ATTACK",
  "OPEN PORTS",
  "SSL VULNERABILITY",
  "BRUTE FORCE",
  "ZERO-DAY EXPLOIT",
  "CSRF TOKEN BYPASS",
  "PATH TRAVERSAL",
];

function ThreatTicker() {
  return (
    <div className="overflow-hidden whitespace-nowrap border-y border-[rgba(0,255,156,0.15)] py-2 my-8">
      <style>{`
        .ticker-track {
          display: inline-flex;
          animation: ticker 25s linear infinite;
        }
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
      <div className="ticker-track">
        {[...threats, ...threats].map((t, i) => (
          <span
            key={i}
            className="mx-6 text-xs font-mono text-[rgba(0,255,156,0.5)] tracking-widest"
          >
            ⚡ {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function Home() {
  const phrases = [
    "Automated Vulnerability Scanning.",
    "Real-Time Threat Monitoring.",
    "AI-Powered Remediation.",
    "Zero Blind Spots. Zero Compromise.",
  ];
  const typed = useTypewriter(phrases);
  const [mounted, setMounted] = useState(false);
  const [scanTarget, setScanTarget] = useState("");
  const router = useRouter();

  const handleScan = () => {
    if (!scanTarget.trim()) return;
    router.push(`/dashboard?target=${encodeURIComponent(scanTarget)}`);
  };

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <main
      className="relative bg-[#050816] text-white min-h-screen overflow-hidden"
      style={{
        backgroundImage:
          "linear-gradient(rgba(0,255,156,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,156,0.04) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }}
    >
      {/* Matrix rain */}
      <MatrixRain />

      {/* Scan line overlay */}
      <div className="scan-line absolute inset-0 pointer-events-none z-10" />

      {/* Floating orbs */}
      <FloatingOrbs />

      {/* ── NAV ── */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-20 flex items-center justify-between px-8 py-5 border-b border-[rgba(0,255,156,0.1)]"
      >
        <span
          style={{ fontFamily: "'Orbitron', monospace", letterSpacing: "4px" }}
          className="text-[#00FF9C] text-sm font-black"
        >
          ROOT<span className="text-white">X</span>
        </span>
        <div className="hidden md:flex items-center gap-8">
          {["Features", "How It Works", "Reports", "Pricing"].map((item) => (
            <a
              key={item}
              href="#"
              className="text-xs font-mono text-[rgba(255,255,255,0.5)] hover:text-[#00FF9C] tracking-widest transition-colors"
            >
              {item.toUpperCase()}
            </a>
          ))}
        </div>
        <Link href="/dashboard">
          <button className="btn-primary text-[0.65rem] px-5 py-2">
            Dashboard →
          </button>
        </Link>
      </motion.nav>

      {/* ── HERO ── */}
      <section className="relative z-20 flex flex-col items-center justify-center text-center px-6 pt-16 pb-8">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="tag-badge mb-8"
        >
          ◈ AI-POWERED CYBERSECURITY PLATFORM
        </motion.div>

        {/* Glitch title */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <GlitchTitle />
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-2 text-lg md:text-xl font-mono text-[rgba(0,255,156,0.6)] tracking-widest uppercase"
        >
          Detect. Defend. Dominate.
        </motion.p>

        {/* Typewriter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="mt-6 h-8 text-base md:text-lg font-mono text-[rgba(255,255,255,0.65)]"
        >
          {typed}
          <span className="blink text-[#00FF9C]">█</span>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
          className="mt-6 max-w-xl text-sm md:text-base text-[rgba(255,255,255,0.4)] leading-relaxed"
        >
          Enter a URL. Let RootX handle the rest — automated scanning,
          live threat intelligence, and AI-generated fix reports. <br />
          <span className="text-[rgba(0,255,156,0.7)]">
            Security made fast. Made smart. Made for builders.
          </span>
        </motion.p>

        {/* ── SCAN INPUT + BUTTON (single CTA) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
          className="mt-10 flex flex-col items-center gap-3 w-full"
        >
          <div className="scan-input-wrapper">
            <input
              type="text"
              className="scan-input"
              placeholder="https://target-domain.com"
              value={scanTarget}
              onChange={(e) => setScanTarget(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
            />
            <button
              className="btn-primary"
              style={{ borderRadius: 0, padding: "14px 24px" }}
              onClick={handleScan}
            >
              ⚡ Scan
            </button>
          </div>
        </motion.div>

        {/* Trust line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="mt-4 text-[10px] font-mono text-[rgba(255,255,255,0.25)] tracking-widest"
        >
          NO CREDIT CARD · AUTHORIZED SCANNING ONLY · OWASP COMPLIANT
        </motion.p>
      </section>

      {/* ── THREAT TICKER ── */}
      <div className="relative z-20 px-0">
        <ThreatTicker />
      </div>

      {/* ── STATS ── */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.9 }}
        className="relative z-20 grid grid-cols-2 md:grid-cols-4 gap-4 px-8 pb-16 max-w-5xl mx-auto w-full"
      >
        {[
          { label: "VULNERABILITIES DETECTED", value: 128400, suffix: "+" },
          { label: "SCANS COMPLETED",          value: 52000,  suffix: "+" },
          { label: "THREATS BLOCKED",          value: 9800,   suffix: "+" },
          { label: "AVG SCAN TIME",            value: 120,    suffix: "s"  },
        ].map((s, i) => (
          <motion.div
            key={i}
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2 + i * 0.1 }}
          >
            <p className="text-[10px] font-mono text-[rgba(0,255,156,0.5)] tracking-widest mb-2">
              {s.label}
            </p>
            <p
              style={{ fontFamily: "'Orbitron', monospace" }}
              className="text-2xl font-black text-[#00FF9C]"
            >
              <Counter to={s.value} suffix={s.suffix} />
            </p>
          </motion.div>
        ))}
      </motion.section>

      {/* ── TERMINAL PREVIEW ── */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.2 }}
        className="relative z-20 max-w-3xl mx-auto px-8 pb-20 w-full"
      >
        <div
          className="rounded border border-[rgba(0,255,156,0.2)] overflow-hidden"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}
        >
          {/* Terminal bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(0,255,156,0.1)]">
            <span className="w-3 h-3 rounded-full bg-red-500 opacity-80" />
            <span className="w-3 h-3 rounded-full bg-yellow-400 opacity-80" />
            <span className="w-3 h-3 rounded-full bg-[#00FF9C] opacity-80" />
            <span className="ml-4 text-xs font-mono text-[rgba(255,255,255,0.3)]">
              rootx — scan engine v2.4.1
            </span>
          </div>
          {/* Terminal lines */}
          <div className="px-5 py-4 space-y-1">
            {[
              { prefix: "$",      text: "rootx scan --target https://example.com --deep", color: "text-white" },
              { prefix: "▸",      text: "Initializing OWASP ZAP engine...",               color: "text-[rgba(255,255,255,0.5)]" },
              { prefix: "▸",      text: "Running Nmap port discovery...",                 color: "text-[rgba(255,255,255,0.5)]" },
              { prefix: "[WARN]", text: "Port 8080 exposed — HTTP running unencrypted",   color: "text-yellow-400" },
              { prefix: "[CRIT]", text: "SQL Injection found at /login?id= parameter",    color: "text-red-400" },
              { prefix: "[CRIT]", text: "Reflected XSS detected on /search endpoint",     color: "text-red-400" },
              { prefix: "[OK]",   text: "SSL/TLS configuration: PASSED",                  color: "text-[#00FF9C]" },
              { prefix: "✦ AI",  text: "Generating remediation report...",                color: "text-[#00FF9C]" },
            ].map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 2.4 + i * 0.18 }}
                className={`text-xs font-mono flex gap-3 ${line.color}`}
              >
                <span className="opacity-50 min-w-12">{line.prefix}</span>
                <span>{line.text}</span>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 4 }}
              className="mt-3 pt-3 border-t border-[rgba(0,255,156,0.15)] flex items-center justify-between"
            >
              <span className="text-xs font-mono text-[rgba(255,255,255,0.3)]">
                SECURITY SCORE
              </span>
              <span
                style={{ fontFamily: "'Orbitron', monospace" }}
                className="text-lg font-black text-red-400"
              >
                42 / 100
              </span>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ── FOOTER LINE ── */}
      <div className="relative z-20 border-t border-[rgba(0,255,156,0.08)] py-4 text-center">
        <p className="text-[10px] font-mono text-[rgba(255,255,255,0.2)] tracking-widest">
          © 2025 ROOTX · BUILT FOR THE PARANOID · POWERED BY AI
        </p>
      </div>
    </main>
  );
}