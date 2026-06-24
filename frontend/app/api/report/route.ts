// frontend/app/api/report/route.ts
// Used by: SecurityCard.tsx, scan history, PDF download button

import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:4000";

// GET /api/report?scanId=xxx          — fetch report JSON
// GET /api/report?scanId=xxx&pdf=true — stream PDF download
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scanId = searchParams.get("scanId");
  const pdf    = searchParams.get("pdf") === "true";

  if (!scanId) {
    return NextResponse.json({ error: "scanId query param required" }, { status: 400 });
  }

  try {
    if (pdf) {
      const res = await fetch(`${BACKEND}/api/report/pdf/${scanId}`);
      if (!res.ok) return NextResponse.json({ error: "Report not found" }, { status: 404 });

      const blob = await res.blob();
      return new NextResponse(blob.stream(), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="rootx-report-${scanId}.pdf"`,
        },
      });
    }

    const res  = await fetch(`${BACKEND}/api/report/${scanId}`);
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 503 });
  }
}

// POST /api/report — send report email or compare two scans
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Email: { action: "email", scanId, emailTo }
    if (body.action === "email") {
      const res = await fetch(`${BACKEND}/api/report/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: body.scanId, emailTo: body.emailTo }),
      });
      return NextResponse.json(await res.json());
    }

    // Compare: { action: "compare", scanIdA, scanIdB }
    if (body.action === "compare") {
      const res = await fetch(`${BACKEND}/api/scan/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanIdA: body.scanIdA, scanIdB: body.scanIdB }),
      });
      return NextResponse.json(await res.json());
    }

    return NextResponse.json({ error: "Unknown action. Use: email | compare" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 503 });
  }
}
