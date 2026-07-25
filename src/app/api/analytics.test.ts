import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { gunzipSync } from "node:zlib";
import { makeTestDb, resetDb } from "../../../test/db";
import type { IntentResult } from "@/lib/intent";

// The Gemini seam is stubbed — the voice path is exercised without a model.
vi.mock("@/lib/gemini", () => ({ interpretAudio: vi.fn() }));
import { interpretAudio } from "@/lib/gemini";

/**
 * End-to-end check of the server-side PostHog instrumentation.
 *
 * A throwaway HTTP server stands in for the PostHog ingestion endpoint, so the
 * real posthog-node client actually serialises and ships each event over the
 * wire. The assertions are on the payloads PostHog would receive.
 */

interface Ingested {
  path: string;
  apiKey: string;
  event: string;
  properties: Record<string, unknown>;
  distinctId: string;
}

const ingested: Ingested[] = [];
/** Every payload the fake endpoint saw, across all tests — useful when eyeballing what ships. */
const allIngested: Ingested[] = [];
let sink: Server;

const TOKEN = "phc_test_token";

beforeAll(async () => {
  sink = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks);
      // posthog-node gzips its batches on the way out.
      const body =
        req.headers["content-encoding"] === "gzip"
          ? gunzipSync(raw).toString("utf8")
          : raw.toString("utf8");
      try {
        const parsed = JSON.parse(body);
        for (const item of parsed.batch ?? []) {
          const hit: Ingested = {
            path: req.url ?? "",
            apiKey: parsed.api_key,
            event: item.event,
            properties: item.properties ?? {},
            distinctId: item.distinct_id,
          };
          ingested.push(hit);
          allIngested.push(hit);
        }
      } catch {
        // Non-batch traffic (feature flag polling etc.) is not under test.
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise<void>((r) => sink.listen(0, "127.0.0.1", r));
  const { port } = sink.address() as AddressInfo;

  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = TOKEN;
  process.env.NEXT_PUBLIC_POSTHOG_HOST = `http://127.0.0.1:${port}`;
  process.env.APP_PIN = "1357";
});

afterAll(async () => {
  // POSTHOG_EVENT_LOG=1 prints the exact batches PostHog would have received.
  if (process.env.POSTHOG_EVENT_LOG) {
    console.log(JSON.stringify(allIngested, null, 2));
  }
  await new Promise<void>((r) => sink.close(() => r()));
  delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  delete process.env.APP_PIN;
});

beforeEach(async () => {
  await makeTestDb();
  ingested.length = 0;
  vi.mocked(interpretAudio).mockReset();
});
afterEach(() => resetDb());

/** posthog-node flushes on a shutdown promise the route intentionally does not await. */
async function settle(count: number): Promise<Ingested[]> {
  const deadline = Date.now() + 5000;
  while (ingested.length < count && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 25));
  }
  return ingested;
}

function json(url: string, body: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("todo create / status change / delete each ship an event to PostHog", async () => {
  const { POST } = await import("./todos/route");
  const { PATCH, DELETE } = await import("./todos/[id]/route");

  const created = await POST(
    json("http://test/api/todos", { title: "buy milk", dueDate: "2026-08-01" }),
  );
  expect(created.status).toBe(201);
  const { todo } = await created.json();

  await PATCH(json("http://test", { status: "done" }), {
    params: Promise.resolve({ id: todo.id }),
  });
  await DELETE(new Request("http://test", { method: "DELETE" }), {
    params: Promise.resolve({ id: todo.id }),
  });

  const events = await settle(3);
  expect(events.map((e) => e.event)).toEqual([
    "todo_created",
    "todo_status_changed",
    "todo_deleted",
  ]);
  expect(events[0].properties).toMatchObject({ method: "text", has_due_date: true });
  expect(events[1].properties).toMatchObject({ status: "done", has_due_date: true });
  // Every event lands on the batch endpoint of the configured project.
  expect(events.every((e) => e.apiKey === TOKEN)).toBe(true);
  expect(events.every((e) => e.distinctId === "togo_user")).toBe(true);
  expect(events.every((e) => e.path.startsWith("/batch"))).toBe(true);
});

test("a rejected todo create ships no event", async () => {
  const { POST } = await import("./todos/route");
  const res = await POST(json("http://test/api/todos", { title: "   " }));
  expect(res.status).toBe(400);
  await new Promise((r) => setTimeout(r, 300));
  expect(ingested).toEqual([]);
});

test("voice capture ships the intent and the number of todos created", async () => {
  vi.mocked(interpretAudio).mockResolvedValue({
    intent: "capture",
    transcript: "buy milk and call the dentist tomorrow",
    captures: [
      { title: "buy milk", due_date: null },
      { title: "call the dentist", due_date: "2026-07-26" },
    ],
    command: null,
  } as IntentResult);

  const { POST } = await import("./capture/route");
  const fd = new FormData();
  fd.append(
    "audio",
    new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }),
    "clip.webm",
  );
  const res = await POST(
    new Request("http://test/api/capture", { method: "POST", body: fd }),
  );
  expect(res.status).toBe(200);

  const [event] = await settle(1);
  expect(event.event).toBe("voice_capture_processed");
  expect(event.properties).toMatchObject({ intent: "capture", todos_created: 2 });
});

test("a failed transcription ships no capture event", async () => {
  vi.mocked(interpretAudio).mockRejectedValue(new Error("gemini down"));
  const { POST } = await import("./capture/route");
  const fd = new FormData();
  fd.append("audio", new Blob([new Uint8Array([1])], { type: "audio/webm" }), "c.webm");
  const res = await POST(
    new Request("http://test/api/capture", { method: "POST", body: fd }),
  );
  expect(res.status).toBe(502);
  await new Promise((r) => setTimeout(r, 300));
  expect(ingested).toEqual([]);
});

test("login ships exactly one event, and a wrong PIN ships none", async () => {
  const { POST } = await import("./auth/route");

  const bad = await POST(json("http://test/api/auth", { pin: "0000" }));
  expect(bad.status).toBe(401);
  await new Promise((r) => setTimeout(r, 300));
  expect(ingested).toEqual([]);

  const ok = await POST(json("http://test/api/auth", { pin: "1357" }));
  expect(ok.status).toBe(200);
  const events = await settle(1);
  await new Promise((r) => setTimeout(r, 300));
  expect(events.map((e) => e.event)).toEqual(["user_logged_in"]);
});

test("an uncaught server error ships a $exception via onRequestError", async () => {
  const { onRequestError } = await import("../../instrumentation");

  const savedRuntime = process.env.NEXT_RUNTIME;
  process.env.NEXT_RUNTIME = "nodejs";
  try {
    await onRequestError!(
      new Error("boom"),
      { path: "/api/todos", method: "POST", headers: {} },
      {
        routerKind: "App Router",
        routePath: "/api/todos",
        routeType: "route",
        revalidateReason: undefined,
      },
    );
  } finally {
    if (savedRuntime === undefined) delete process.env.NEXT_RUNTIME;
    else process.env.NEXT_RUNTIME = savedRuntime;
  }

  const [event] = await settle(1);
  expect(event.event).toBe("$exception");
  expect(event.distinctId).toBe("togo_user");
  expect(event.properties).toMatchObject({ path: "/api/todos", method: "POST" });
});

test("with no project token configured, nothing is sent and routes still work", async () => {
  const saved = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  try {
    const { POST } = await import("./todos/route");
    const res = await POST(json("http://test/api/todos", { title: "no analytics" }));
    expect(res.status).toBe(201);
    await new Promise((r) => setTimeout(r, 300));
    expect(ingested).toEqual([]);
  } finally {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = saved;
  }
});
