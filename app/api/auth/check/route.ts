// /api/auth/check — used by nginx auth_request to gate the /code IDE.
// Returns 200 only for admin sessions (demo cannot open the IDE).
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const s = await getSession();
  if (!s) return new NextResponse(null, { status: 401 });
  if (s.role !== "admin") return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 200, headers: { "x-atlas-role": s.role } });
}
