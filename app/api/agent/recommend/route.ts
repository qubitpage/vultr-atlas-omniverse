// app/api/agent/recommend/route.ts
import { NextResponse } from "next/server";
import { listPlans } from "@/lib/vultr";
import { recommend } from "@/lib/recommend";
import type { RecommendationInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as RecommendationInput;
    const plans = await listPlans();
    const picks = recommend(plans, input, 5);
    return NextResponse.json({ picks });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
