// frontend/app/api/scan/route.ts
// Receives scan request from scannerengine.tsx → proxies to Express backend

import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:4000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Generate a scanId here so the frontend can connect to Socket.io
    // room BEFORE the scan starts (avoids race condition)
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const res = await fetch(`${BACKEND}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, scanId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Backend error" }));
      return NextResponse.json(err, { status: res.status });
    }

    const data = await res.json();
    // Always include scanId so frontend can open the Socket.io room
    return NextResponse.json({ ...data, scanId });
  } catch (err) {
    console.error("[API/scan]", err);
    return NextResponse.json(
      { error: "Failed to reach backend. Is server.js running on port 4000?" },
      { status: 503 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use POST /api/scan with { target: string }" }, { status: 405 });
}