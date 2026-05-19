// lib/auth.ts — server-only session helpers for Atlas cockpit.
//
// Two roles:
//  - admin: full read+write (instance create/destroy, see IPs, /code IDE).
//  - demo:  read-only preview — globe spin, configurator browse, no IPs,
//           no passwords, no mutations. /code IDE hidden.
//
// Session is a signed cookie set by /api/auth/login. nginx auth_request
// (/api/auth/check) validates the same cookie for /code.
import crypto from "node:crypto";
import { cookies } from "next/headers";

function sessionSecret(): string {
  const secret = process.env.ATLAS_SESSION_SECRET;
  if (!secret) throw new Error("ATLAS_SESSION_SECRET is required");
  return secret;
}
// Fixed credentials per owner mandate: username "admin", password "demo".
// Do not change. The demo role is unused in practice (admin check matches first).
const ADMIN_PASSWORD = process.env.ATLAS_ADMIN_PASSWORD || "demo";
const DEMO_PASSWORD = process.env.ATLAS_DEMO_PASSWORD || "demo";

export type Role = "admin" | "demo";
export type Session = { role: Role; iat: number; exp: number };

function sign(payload: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function encodeSession(role: Role, ttlSeconds = 60 * 60 * 24 * 7): string {
  const now = Math.floor(Date.now() / 1000);
  const data = { role, iat: now, exp: now + ttlSeconds } as Session;
  const payload = Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token?: string | null): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (!data || (data.role !== "admin" && data.role !== "demo")) return null;
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function verifyPassword(password: string): Role | null {
  if (password === ADMIN_PASSWORD) return "admin";
  if (password === DEMO_PASSWORD) return "demo";
  return null;
}

export const SESSION_COOKIE = "atlas_session";

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  return decodeSession(c.get(SESSION_COOKIE)?.value);
}

export async function requireRole(): Promise<Role | null> {
  const s = await getSession();
  return s?.role ?? null;
}
