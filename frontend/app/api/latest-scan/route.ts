import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    scan: {
      target: "localhost",
      vulnerabilities: [
        "SQL Injection",
        "XSS",
        "Open Port 22",
      ],
      risk: "High",
      timestamp: new Date(),
    },
  });
}
// frontend/app/api/monitor/route.ts
// Used by: attackmonitor.tsx
// Handles MITM proxy control and log fetching

// frontend/app/api/ai/explain/route.ts
// Used by: SecurityCard.tsx, vulntable.tsx — AI-powered vuln explanation
// Streams SSE (Server-Sent Events) from Express → Next.js → browser

import { NextRequest } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:4000";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch(`${BACKEND}/api/ai/explain`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok || !res.body) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: "AI explain unavailable." })}\n\n`)
          );
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: "\n\n**Fix:** " + (body.vulnerability?.fix || "See OWASP remediation guide.") })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}