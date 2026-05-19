// middleware.ts — gate every page/api on a valid Atlas session.
import { NextRequest, NextResponse } from "next/server";

const PUBLIC = new Set<string>([
  "/",
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/check",
  "/favicon.ico",
  "/api/omniverse/network",
  "/api/omniverse/voice-command",
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC.has(pathname)) return true;
  if (pathname.startsWith("/api/omniverse/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/assets/")) return true;
  return false;
}

function isInternalVscodeAuthRequest(req: NextRequest): boolean {
  if (req.nextUrl.pathname !== "/api/vscode-github-auth") return false;
  const host = req.headers.get("host") || "";
  return host.startsWith("127.0.0.1:3030") || host.startsWith("localhost:3030");
}

// Inline HMAC verify so middleware (Edge runtime) doesn't import node:crypto.
async function verify(token: string | undefined, secret: string): Promise<{ role: "admin" | "demo" } | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const expected = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
    );
    const expectedB64 = btoa(String.fromCharCode(...expected))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    if (expectedB64 !== sig) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (!json.exp || json.exp < Math.floor(Date.now() / 1000)) return null;
    if (json.role !== "admin" && json.role !== "demo") return null;
    return { role: json.role };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isInternalVscodeAuthRequest(req)) return NextResponse.next();
  if (isPublic(pathname)) return NextResponse.next();
  const secret = process.env.ATLAS_SESSION_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "auth is not configured" }, { status: 500 });
  }
  const sess = await verify(req.cookies.get("atlas_session")?.value, secret);
  if (!sess) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("x-atlas-role", sess.role);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
