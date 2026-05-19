// app/api/agent/chat/route.ts — SSE streaming chat with Gemini
import { streamChat, type ChatTurn } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const { history, message, context } = (await req.json()) as {
    history: ChatTurn[];
    message: string;
    context?: string;
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        send("status", { state: "thinking" });
        for await (const chunk of streamChat(history ?? [], message, context ?? "")) {
          send("chunk", { text: chunk });
        }
        send("done", {});
      } catch (e: any) {
        send("error", { message: e?.message ?? String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
    },
  });
}
