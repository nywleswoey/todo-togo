import { NextResponse } from "next/server";
import { verifyPin } from "@/lib/auth";
import { config } from "@/lib/config";
import { SESSION_COOKIE, sessionTokenFor } from "@/lib/session";
import { captureServerEvent } from "@/lib/posthog-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** POST /api/auth — unlock with the PIN; sets a remembered session cookie. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!verifyPin(body?.pin)) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }
  const token = await sessionTokenFor(config.appPin);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });

  captureServerEvent("user_logged_in");

  return res;
}

/** DELETE /api/auth — sign out (clears the session cookie). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
