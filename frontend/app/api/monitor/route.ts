// import { NextResponse } from "next/server";

// const attacks = [
//   {
//     ip: "185.220.101.4",
//     path: "/login",
//     payload: "' OR 1=1 --",
//     type: "SQL Injection",
//     severity: "CRITICAL",
//   },
//   {
//     ip: "45.83.64.12",
//     path: "/search",
//     payload: "<script>alert(1)</script>",
//     type: "XSS Attempt",
//     severity: "HIGH",
//   },
//   {
//     ip: "91.210.45.77",
//     path: "/admin",
//     payload: "Brute Force Attack",
//     type: "Credential Attack",
//     severity: "MEDIUM",
//   },
// ];

// export async function GET() {
//   const randomAttack =
//     attacks[Math.floor(Math.random() * attacks.length)];

//   return NextResponse.json({
//     success: true,
//     attack: randomAttack,
//     timestamp: new Date(),
//   });
// }
// frontend/app/api/stats/route.ts
// Used by: SecurityCard.tsx, Slidebar.tsx, ActivityFeed.tsx

import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:4000";

export async function GET() {
  try {
    const [statsRes, scansRes] = await Promise.all([
      fetch(`${BACKEND}/api/stats`, { next: { revalidate: 30 } }),
      fetch(`${BACKEND}/api/scans?limit=10`, { next: { revalidate: 10 } }),
    ]);

    const stats = await statsRes.json();
    const scans = await scansRes.json();

    return NextResponse.json({ ...stats, recentScans: scans });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 503 });
  }
}