import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

/**
 * Proxy chat messages to the RootX backend AI agent.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[CHAT PROXY] Error:", message);
    return NextResponse.json(
      {
        response:
          "Could not connect to RootX backend. Make sure the server is running on port 4000.",
        vulns: undefined,
      },
      { status: 502 }
    );
  }
}
