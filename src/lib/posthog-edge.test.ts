import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { captureEdgeException } from "./posthog-edge";

/**
 * The Edge exception path posts a single PostHog `$exception` event with plain
 * `fetch` (posthog-node cannot run on Edge — see the module doc comment). A
 * throwaway HTTP server stands in for PostHog's capture endpoint so the real
 * payload is asserted.
 */

interface Captured {
  path: string;
  body: Record<string, unknown>;
}

const captured: Captured[] = [];
let sink: Server;

const TOKEN = "phc_edge_token";

beforeAll(async () => {
  sink = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      captured.push({ path: req.url ?? "", body: JSON.parse(Buffer.concat(chunks).toString()) });
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise<void>((r) => sink.listen(0, "127.0.0.1", r));
  const { port } = sink.address() as AddressInfo;
  process.env.NEXT_PUBLIC_POSTHOG_HOST = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => sink.close(() => r()));
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
});

beforeEach(() => {
  captured.length = 0;
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = TOKEN;
});
afterEach(() => {
  delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
});

test("posts a $exception event in PostHog's error-tracking shape", async () => {
  await captureEdgeException(new TypeError("boom"), { path: "/x", method: "GET" });

  expect(captured).toHaveLength(1);
  const { path, body } = captured[0];
  expect(path).toBe("/capture/");
  expect(body.api_key).toBe(TOKEN);
  expect(body.event).toBe("$exception");
  expect(body.distinct_id).toBe("togo_user");

  const props = body.properties as Record<string, unknown>;
  expect(props).toMatchObject({ path: "/x", method: "GET" });
  const list = props.$exception_list as Array<Record<string, unknown>>;
  expect(list[0]).toMatchObject({
    type: "TypeError",
    value: "boom",
    mechanism: { handled: false },
  });
});

test("with no project token, nothing is sent", async () => {
  delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  await captureEdgeException(new Error("nope"));
  expect(captured).toEqual([]);
});

test("a failing PostHog is swallowed, never rethrown", async () => {
  const goodHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "http://127.0.0.1:1"; // nothing listening
  try {
    await expect(captureEdgeException(new Error("boom"))).resolves.toBeUndefined();
  } finally {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = goodHost;
  }
});
