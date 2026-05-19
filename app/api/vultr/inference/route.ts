// app/api/vultr/inference/route.ts — account-scoped Vultr Serverless Inference subs
import { NextResponse } from "next/server";
import { listInferenceSubs } from "@/lib/vultr";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const subs = await listInferenceSubs();
    return NextResponse.json({ subscriptions: subs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e), subscriptions: [] }, { status: 200 });
  }
}
