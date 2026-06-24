import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function POST(req: NextRequest) {
  try {
    const { scanId } = await req.json();
    if (!scanId) return NextResponse.json({ error: "scanId required" }, { status: 400 });

    const scanRes = await fetch(`${BACKEND_URL}/api/scan/${scanId}`);
    if (!scanRes.ok) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    const scan = await scanRes.json();

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Write a beginner-friendly, step-by-step tutorial explaining this security scan, as if teaching someone learning pentesting. Target: ${scan.target}. Findings: ${JSON.stringify(scan.vulnerabilities)}. Structure: intro, what was tested, what was found and why it matters, how to fix it.`;
    const result = await model.generateContent(prompt);
    return NextResponse.json({ tutorial: result.response.text() });
  } catch (err) {
    console.error("[TUTORIAL] Error:", err);
    return NextResponse.json({ error: "Failed to generate tutorial" }, { status: 500 });
  }
}
