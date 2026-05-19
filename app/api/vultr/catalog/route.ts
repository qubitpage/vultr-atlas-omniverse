// app/api/vultr/catalog/route.ts — OS / applications / plans / metal / regions
import { NextResponse } from "next/server";
import { catalogSnapshot } from "@/lib/vultr";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await catalogSnapshot());
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
