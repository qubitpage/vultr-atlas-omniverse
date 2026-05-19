// /api/auth/whoami — client-facing read of current role.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const s = await getSession();
  return NextResponse.json({ role: s?.role ?? null });
}
