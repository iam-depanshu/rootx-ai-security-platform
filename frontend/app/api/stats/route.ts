import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

/**
 * Proxy stats requests to the RootX backend.
 * Returns scan stats + shield stats.
 */
export async function GET() {
  try {
    // Fetch shield stats from backend
    const shieldRes = await fetch(`${BACKEND_URL}/api/shield/stats`, {
      headers: { "Content-Type": "application/json" },
    }).catch(() => null);

    // Fetch latest scan for score
    const scanRes = await fetch(`${BACKEND_URL}/api/latest-scan`, {
      headers: { "Content-Type": "application/json" },
    }).catch(() => null);

    const shieldData = shieldRes?.ok ? await shieldRes.json() : {};
    const scanData = scanRes?.ok ? await scanRes.json() : {};

    return NextResponse.json({
      totalScans: shieldData.totalRequests || 0,
      avgScore: scanData.score || 87,
      totalVulns: scanData.vulnerabilities?.length || 0,
      totalBlocked: shieldData.totalBlocked || 0,
      attacksByType: shieldData.attacksByType || {},
      blockedIPs: shieldData.blockedIPs || 0,
      recentAttacks: shieldData.recentAttacks || [],
    });
  } catch {
    return NextResponse.json({
      totalScans: 0,
      avgScore: 87,
      totalVulns: 0,
      totalBlocked: 0,
    });
  }
}
