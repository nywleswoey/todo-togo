import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { config } from "@/lib/config";
import { todayInTz } from "@/lib/date";
import { interpretAudio } from "@/lib/gemini";
import { processCapture } from "@/lib/capture";
import { listOpen } from "@/lib/todos";
import { captureServerEvent } from "@/lib/posthog-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/capture — the whole server voice path.
 *
 * multipart audio in → read current open todos → single Gemini call
 * (transcribe + interpret) → apply (insert captures / resolve completion
 * candidates / unknown) → applied result out.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "audio is required" }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ error: "empty audio" }, { status: 400 });
  }

  const db = getDb();
  const openTodos = (await listOpen(db)).map((t) => ({
    id: t.id,
    title: t.title,
  }));
  const tz = config.serverTz;

  let intent;
  try {
    intent = await interpretAudio({
      audioBase64: bytes.toString("base64"),
      mimeType: file.type || "audio/webm",
      ctx: { today: todayInTz(tz), timezone: tz, openTodos },
    });
  } catch (err) {
    // Transcription/interpretation failed — client shows a Retry toast.
    return NextResponse.json(
      { error: "transcription_failed", message: (err as Error).message },
      { status: 502 },
    );
  }

  const result = await processCapture(db, intent);

  captureServerEvent("voice_capture_processed", {
    intent: result.intent,
    todos_created: result.intent === "capture" ? result.created?.length ?? 0 : 0,
  });

  return NextResponse.json(result);
}
