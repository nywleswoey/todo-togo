import { afterEach, beforeEach, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { SESSION_COOKIE, sessionTokenFor } from "@/lib/session";
import { middleware } from "./middleware";

const PIN = "1357";

beforeEach(() => {
  process.env.APP_PIN = PIN;
});
afterEach(() => {
  delete process.env.APP_PIN;
});

function req(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

/** The headers middleware forwards upstream (Next encodes them on the response). */
function forwardedHeaders(res: Response): string[] {
  return (res.headers.get("x-middleware-override-headers") ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

test("the /ingest proxy is reachable with no session (login-page events)", async () => {
  const res = await middleware(req("/ingest/e/"));
  expect(res.status).toBe(200);
  expect(res.headers.get("x-middleware-next")).toBe("1");
  expect(res.headers.get("location")).toBeNull();
});

test("/ingest static asset paths are reachable too", async () => {
  const res = await middleware(req("/ingest/static/array.js"));
  expect(res.headers.get("x-middleware-next")).toBe("1");
});

test("the session cookie never reaches the third-party ingest host", async () => {
  const token = await sessionTokenFor(PIN);
  const res = await middleware(
    req("/ingest/e/", {
      cookie: `${SESSION_COOKIE}=${token}; other=1`,
      "content-type": "application/json",
    }),
  );
  const forwarded = forwardedHeaders(res);
  expect(forwarded).toContain("content-type");
  expect(forwarded).not.toContain("cookie");
});

test("a path that merely starts with the word ingest is still gated", async () => {
  const res = await middleware(req("/ingestion-secrets"));
  expect(res.status).toBe(307);
  expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
});

test("app routes are still gated behind the PIN session", async () => {
  const locked = await middleware(req("/"));
  expect(new URL(locked.headers.get("location")!).pathname).toBe("/login");

  const api = await middleware(req("/api/todos"));
  expect(api.status).toBe(401);

  const token = await sessionTokenFor(PIN);
  const open = await middleware(req("/", { cookie: `${SESSION_COOKIE}=${token}` }));
  expect(open.headers.get("x-middleware-next")).toBe("1");
  expect(open.headers.get("location")).toBeNull();
});
