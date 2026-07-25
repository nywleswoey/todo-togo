import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Never prerender — this hits the database at request time.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Liveness + database reachability check for the deployed app. */
export async function GET() {
  try {
    const { rows } = await getDb().query<{ ok: number }>("SELECT 1 AS ok");
    const dbOk = rows[0]?.ok === 1;
    return NextResponse.json({ status: "ok", db: dbOk });
  } catch (err) {
    return NextResponse.json(
      { status: "error", db: false, error: (err as Error).message },
      { status: 503 },
    );
  }
}
