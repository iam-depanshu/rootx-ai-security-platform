import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent";

export async function POST(req: NextRequest) {
  try {
    const { vulnerability, target } = await req.json();

    if (!vulnerability) {
      return NextResponse.json({ error: "Vulnerability data required" }, { status: 400 });
    }

    if (!GEMINI_API_KEY) {
      // Fallback response when offline
      const fallbackData = `data: ${JSON.stringify({ text: `Here is a security remediation guide for **${vulnerability.name}**:\n\n` })}\n` +
        `data: ${JSON.stringify({ text: `• **Vulnerability Details**: ${vulnerability.detail || "Exposed security issue"}\n` })}\n` +
        `data: ${JSON.stringify({ text: `• **Remediation Recommendation**: ${vulnerability.fix || "Secure the configuration and check settings."}\n\n` })}\n` +
        `data: ${JSON.stringify({ text: `_Note: Configure GEMINI_API_KEY in backend/.env to get full detailed AI remediation advice._` })}\n` +
        `data: [DONE]\n`;

      return new NextResponse(fallbackData, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const prompt = `You are RootX, a security advisor. Explain the following vulnerability in simple terms and provide step-by-step remediation advice.

Target: ${target}
Vulnerability: ${vulnerability.name}
Severity: ${vulnerability.severity}
Details: ${vulnerability.detail}
Fix recommendation: ${vulnerability.fix}

Format the explanation beautifully with markdown. Use bullet points and code block snippets.`;

    const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini stream call failed: ${response.status}`);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            
            // Try to parse SSE or raw JSON chunks returned by Gemini stream
            // Gemini returns a large JSON array elements or objects over stream
            // Let's parse the accumulated JSON buffer when possible
            try {
              // Gemini stream responds with a JSON array where chunks are added
              // or multiple JSON blocks concatenated. Let's clean the buffer and attempt parsing
              let cleaned = buffer.trim();
              if (cleaned.startsWith("[")) cleaned = cleaned.slice(1);
              if (cleaned.endsWith("]")) cleaned = cleaned.slice(0, -1);
              if (cleaned.startsWith(",")) cleaned = cleaned.slice(1);

              // Split chunks by JSON boundaries
              const parts = cleaned.split(/,\s*(?=\{)/);
              for (const part of parts) {
                try {
                  const json = JSON.parse(part);
                  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n`));
                  }
                } catch {
                  // Partial chunk, continue accumulating
                }
              }
            } catch {
              // Processing error
            }
          }
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n"));
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error("[EXPLAIN_ERROR]", error);
    return NextResponse.json({ error: "Explanation failed" }, { status: 500 });
  }
}
