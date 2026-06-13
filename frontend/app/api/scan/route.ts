import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND_URL}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[Proxy] Error forwarding to backend:", err);
    return NextResponse.json(
      {
        score: 0,
        status: "SCAN FAILED",
        vulnerabilities: [{
          name: "Backend Unreachable",
          severity: "CRITICAL",
          detail: "Could not connect to RootX backend. Make sure the backend is running on port 4000.",
          fix: "Run: cd backend && node server.js",
        }],
        technologies: [],
        threats: [],
        discoveredPanels: [],
        sslGrade: "F",
        sslStatus: "ERROR",
      },
      { status: 502 }
    );
  }
}