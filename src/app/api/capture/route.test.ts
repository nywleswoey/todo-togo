import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { makeTestDb, resetDb } from "../../../../test/db";
import { createTodo, listOpen } from "@/lib/todos";
import { getDb } from "@/lib/db";
import type { IntentResult } from "@/lib/intent";

// The Gemini seam is stubbed — the whole server path is exercised without a model.
vi.mock("@/lib/gemini", () => ({ interpretAudio: vi.fn() }));
import { interpretAudio } from "@/lib/gemini";
import { POST } from "./route";

const mockInterpret = vi.mocked(interpretAudio);

beforeEach(async () => {
  await makeTestDb();
  mockInterpret.mockReset();
});
afterEach(() => resetDb());

/** Canned model output (already in parsed IntentResult shape). */
function canned(intent: IntentResult) {
  mockInterpret.mockResolvedValue(intent);
}

function audioReq(): Request {
  const fd = new FormData();
  fd.append("audio", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }), "clip.webm");
  return new Request("http://test/api/capture", { method: "POST", body: fd });
}

test("multi-capture inserts one todo per capture with the transcript attached", async () => {
  canned({
    intent: "capture",
    transcript: "buy milk and call the dentist tomorrow",
    captures: [
      { title: "buy milk", due_date: null },
      { title: "call the dentist", due_date: "2026-07-26" },
    ],
    command: null,
  });

  const res = await POST(audioReq());
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.intent).toBe("capture");
  expect(body.created).toHaveLength(2);

  const open = await listOpen(getDb());
  expect(open.map((t) => t.title).sort()).toEqual(["buy milk", "call the dentist"]);
  expect(open.every((t) => t.sourceTranscript?.includes("buy milk"))).toBe(true);
  const dentist = open.find((t) => t.title === "call the dentist");
  expect(dentist?.dueDate).toBe("2026-07-26");
});

test("single capture returns the created row", async () => {
  canned({
    intent: "capture",
    transcript: "water the plants friday",
    captures: [{ title: "water the plants", due_date: "2026-07-31" }],
    command: null,
  });
  const body = await (await POST(audioReq())).json();
  expect(body.created).toHaveLength(1);
  expect(body.created[0].dueDate).toBe("2026-07-31");
});

test("command (single, high) resolves one candidate and completes nothing", async () => {
  const milk = await createTodo(getDb(), { title: "Buy milk" });
  canned({
    intent: "command",
    transcript: "mark the milk one done",
    captures: [],
    command: {
      action: "complete",
      target_phrase: "the milk one",
      candidates: [{ id: milk.id, title: "Buy milk", confidence: "high" }],
    },
  });

  const body = await (await POST(audioReq())).json();
  expect(body.intent).toBe("command");
  expect(body.command.candidates).toHaveLength(1);
  expect(body.command.candidates[0].id).toBe(milk.id);
  // Never auto-applied: the todo is still open.
  expect((await listOpen(getDb())).some((t) => t.id === milk.id)).toBe(true);
});

test("ambiguous command returns multiple candidates in order", async () => {
  const a = await createTodo(getDb(), { title: "Call mom" });
  const b = await createTodo(getDb(), { title: "Call dentist" });
  canned({
    intent: "command",
    transcript: "mark the call one done",
    captures: [],
    command: {
      action: "complete",
      target_phrase: "the call one",
      candidates: [
        { id: a.id, title: "Call mom", confidence: "low" },
        { id: b.id, title: "Call dentist", confidence: "low" },
      ],
    },
  });
  const body = await (await POST(audioReq())).json();
  expect(body.command.candidates.map((c: { id: string }) => c.id)).toEqual([
    a.id,
    b.id,
  ]);
});

test("command with no matches returns an empty candidate list", async () => {
  canned({
    intent: "command",
    transcript: "finish the report",
    captures: [],
    command: { action: "complete", target_phrase: "the report", candidates: [] },
  });
  const body = await (await POST(audioReq())).json();
  expect(body.command.candidates).toEqual([]);
});

test("hallucinated candidate ids are dropped (resolved against real todos)", async () => {
  await createTodo(getDb(), { title: "Real todo" });
  canned({
    intent: "command",
    transcript: "complete the thing",
    captures: [],
    command: {
      action: "complete",
      target_phrase: "the thing",
      candidates: [
        { id: "00000000-0000-0000-0000-000000000000", title: "Ghost", confidence: "high" },
      ],
    },
  });
  const body = await (await POST(audioReq())).json();
  expect(body.command.candidates).toEqual([]);
});

test("unknown intent writes nothing but echoes the transcript", async () => {
  canned({
    intent: "unknown",
    transcript: "mmphgrbl",
    captures: [],
    command: null,
  });
  const body = await (await POST(audioReq())).json();
  expect(body.intent).toBe("unknown");
  expect(body.transcript).toBe("mmphgrbl");
  expect(body.created).toEqual([]);
  expect((await listOpen(getDb())).length).toBe(0);
});

test("missing audio is a 400", async () => {
  const res = await POST(
    new Request("http://test/api/capture", { method: "POST", body: new FormData() }),
  );
  expect(res.status).toBe(400);
});

test("a model failure surfaces as 502 (client will offer Retry)", async () => {
  mockInterpret.mockRejectedValue(new Error("gemini down"));
  const res = await POST(audioReq());
  expect(res.status).toBe(502);
  expect((await res.json()).error).toBe("transcription_failed");
});
