import { NextResponse } from "next/server";
import { encodeSession, verifyPassword, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password: string = body?.password ?? "";
  const role = verifyPassword(password);
  if (!role) {
    return NextResponse.json({ error: "invalid password" }, { status: 401 });
  }
  const token = encodeSession(role);
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
