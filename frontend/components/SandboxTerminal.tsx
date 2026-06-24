"use client";
import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

export default function SandboxTerminal({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = new Terminal({ theme: { background: "#0f172a" }, fontSize: 13 });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current!);
    fitAddon.fit();

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000";
    const ws = new WebSocket(`${wsUrl}/terminal?sessionId=${sessionId}`);

    ws.onmessage = (e) => term.write(e.data);
    term.onData((data) => ws.send(data));
    ws.onerror = () => term.write("\r\n\x1b[31mWebSocket connection failed\x1b[0m\r\n");

    return () => { ws.close(); term.dispose(); };
  }, [sessionId]);

  return <div ref={containerRef} className="w-full h-96 rounded-xl overflow-hidden" />;
}
