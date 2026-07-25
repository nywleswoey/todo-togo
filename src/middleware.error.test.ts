import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { NextRequest } from "next/server";

/**
 * The gate's own errors are unreported unless the middleware wrapper catches
 * them — `onRequestError` never sees Edge. This drives the real `middleware`
 * export with a gate that throws and asserts the `$exception` PostHog actually
 * receives, plus that the error still escapes to the runtime unchanged.
 */

vi.mock("@/lib/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session")>()),
  isValidSession: async () => {
    throw new RangeError("gate exploded");
  },
}));

const { middleware } = await import("./middleware");

const captured: Record<string, unknown>[] = [];
let sink: Server;

beforeAll(async () => {
  sink = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      captured.push(JSON.parse(Buffer.concat(chunks).toString()));
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
});

beforeEach(() => {
  captured.length = 0;
  process.env.APP_PIN = "1357";
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_edge_token";
});
afterEach(() => {
  delete process.env.APP_PIN;
  delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
});

test("an error escaping the gate is reported to PostHog and rethrown unchanged", async () => {
  const req = new NextRequest("http://localhost:3000/api/todos", { method: "POST" });

  await expect(middleware(req)).rejects.toThrow(
    expect.objectContaining({ name: "RangeError", message: "gate exploded" }),
  );

  expect(captured).toHaveLength(1);
  const props = captured[0].properties as Record<string, unknown>;
  expect(captured[0].event).toBe("$exception");
  expect(props).toMatchObject({ path: "/api/todos", method: "POST" });
  expect((props.$exception_list as Array<Record<string, unknown>>)[0]).toMatchObject({
    type: "RangeError",
    value: "gate exploded",
    mechanism: { handled: false },
  });
});

test("a PostHog that is down does not mask the original error", async () => {
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_edge_token";
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "http://127.0.0.1:1"; // nothing listening
  try {
    await expect(middleware(new NextRequest("http://localhost:3000/"))).rejects.toThrow(
      "gate exploded",
    );
  } finally {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = host;
  }
});
