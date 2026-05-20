import { NextRequest, NextResponse } from "next/server";
import { ask, MOCK_STEPS } from "@/lib/mcp-adapter";
import type { ChatMessage } from "@/types/contract";

export const runtime = "nodejs";
// Allow up to 70s for the real MCP (which can take ~40s)
export const maxDuration = 70;

export async function POST(req: NextRequest) {
  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Streaming SSE so the front can receive step updates during the ~40s wait
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }

      // Emit step labels as they are triggered by the adapter
      function onStep(label: string) {
        send({ type: "step", label });
      }

      // For real MCP mode we don't have step callbacks, so emit the known steps
      // on a timer so the UI stays alive
      const mode = process.env.MCP_MODE ?? "mock";
      let stepTimer: ReturnType<typeof setTimeout> | undefined;
      if (mode === "mcp") {
        let i = 0;
        function emitNextStep() {
          if (i < MOCK_STEPS.length) {
            send({ type: "step", label: MOCK_STEPS[i].label });
            i++;
            stepTimer = setTimeout(emitNextStep, 12_000);
          }
        }
        emitNextStep();
      }

      try {
        const response = await ask(messages, onStep);
        if (stepTimer !== undefined) clearTimeout(stepTimer);
        send({ type: "response", data: response });
      } catch (err) {
        if (stepTimer !== undefined) clearTimeout(stepTimer);
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
