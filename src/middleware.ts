import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";

/**
 * Gate every app route behind the PIN session. The matcher already excludes the
 * login page, the auth endpoint, and static assets; everything else needs a
 * valid session cookie. API paths get a 401; page paths redirect to /login.
 */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const ok = await isValidSession(token, process.env.APP_PIN);
  if (ok) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except the login page, the auth endpoint, and static assets.
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest).*)",
  ],
};
