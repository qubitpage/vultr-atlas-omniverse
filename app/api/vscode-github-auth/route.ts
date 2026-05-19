import crypto from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STORE_PATH =
  process.env.ATLAS_GITHUB_AUTH_STORE ||
  "/var/lib/vscode-web/server-data/data/User/globalStorage/vscode.github-authentication/server-sessions.enc.json";

function key() {
  return crypto
    .createHash("sha256")
    .update(process.env.ATLAS_GITHUB_AUTH_SECRET || process.env.ATLAS_SESSION_SECRET || "atlas-frankfurt-secret-2026")
    .digest();
}

function encrypt(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: data.toString("base64url"),
  };
}

function decrypt(payload: { iv: string; tag: string; data: string }) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(payload.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(payload.data, "base64url")), decipher.final()]).toString("utf8");
}

async function requireAdmin() {
  return (await requireRole()) === "admin";
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const payload = JSON.parse(await readFile(STORE_PATH, "utf8"));
    return NextResponse.json({ value: decrypt(payload) }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ value: null }, { headers: { "cache-control": "no-store" } });
  }
}

export async function PUT(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { value?: unknown } | null;
  if (typeof body?.value !== "string") return NextResponse.json({ error: "invalid value" }, { status: 400 });
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(encrypt(body.value)) + "\n", { mode: 0o600 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await rm(STORE_PATH, { force: true });
  return NextResponse.json({ ok: true });
}