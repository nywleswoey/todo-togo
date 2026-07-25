import { afterEach, beforeEach, expect, test } from "vitest";
import { SESSION_COOKIE, isValidSession, sessionTokenFor } from "@/lib/session";
import { POST } from "./route";

const PIN = "1357";

beforeEach(() => {
  process.env.APP_PIN = PIN;
});
afterEach(() => {
  delete process.env.APP_PIN;
});

function post(body: unknown): Request {
  return new Request("http://test/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("correct PIN opens a session (sets a valid cookie)", async () => {
  const res = await POST(post({ pin: PIN }));
  expect(res.status).toBe(200);
  const token = res.cookies.get(SESSION_COOKIE)?.value;
  expect(token).toBe(await sessionTokenFor(PIN));
  expect(await isValidSession(token, PIN)).toBe(true);
});

test("session cookie is httpOnly and long-lived (remembered)", async () => {
  const res = await POST(post({ pin: PIN }));
  const cookie = res.cookies.get(SESSION_COOKIE);
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.maxAge ?? 0).toBeGreaterThan(60 * 60 * 24 * 30);
});

test("wrong PIN is rejected with 401 and no session", async () => {
  const res = await POST(post({ pin: "0000" }));
  expect(res.status).toBe(401);
  expect(res.cookies.get(SESSION_COOKIE)?.value).toBeFalsy();
});

test("non-string / missing PIN is rejected", async () => {
  expect((await POST(post({ pin: 1357 }))).status).toBe(401);
  expect((await POST(post({}))).status).toBe(401);
});

test("a session minted for one PIN is invalid after PIN rotation", async () => {
  const token = await sessionTokenFor(PIN);
  expect(await isValidSession(token, PIN)).toBe(true);
  expect(await isValidSession(token, "9999")).toBe(false);
});
