import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

/**
 * Proxy shield requests to the RootX backend.
 * Supports: GET /api/shield?action=stats|log|blocked
 *           POST /api/shield with { action: 'block'|'unblock'|'test', ... }
 */
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "stats";

  try {
    const res = await fetch(`${BACKEND_URL}/api/shield/${action}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "test";

    const res = await fetch(`${BACKEND_URL}/api/shield/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }
}
