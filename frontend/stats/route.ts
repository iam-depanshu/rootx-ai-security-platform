// frontend/app/api/latest-scan/route.ts
// Used by: scorering.tsx, discoveredPanel.tsx, vulntable.tsx
// Returns the most recent scan from the backend

import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:4000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/scans/latest`, {
      // Revalidate every 10 seconds so the dashboard stays fresh
      next: { revalidate: 10 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "No scans found" }, { status: 404 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/latest-scan]", err);
    return NextResponse.json(
      { error: "Backend unreachable" },
      { status: 503 }
    );
  }
}