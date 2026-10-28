import { getOrCreateDeviceId } from "@/lib/device";
import { getSessionStatus } from "@/lib/services/syncService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events: tells Phone A the moment Phone B joins.
 * The prototype polls SQLite once a second per open stream, which is fine
 * for a demo. At scale, swap for Postgres LISTEN/NOTIFY or Redis pub/sub.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const deviceId = await getOrCreateDeviceId();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      let last = "";
      while (!req.signal.aborted) {
        const status = await getSessionStatus(id, deviceId);
        const payload = status ?? { status: "NOT_FOUND" };
        const key = JSON.stringify(payload);
        if (key !== last) {
          send(payload);
          last = key;
        }
        if (payload.status !== "PENDING") break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      try {
        controller.close();
      } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
