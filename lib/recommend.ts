// lib/recommend.ts
import type { RecommendationInput, RecommendationPick, VultrPlan } from "./types";

const WORKLOAD_WEIGHTS: Record<RecommendationInput["workload"], { cpu: number; ram: number; net: number; gpu: number }> = {
  web:    { cpu: 0.5, ram: 0.5, net: 1.0, gpu: 0.0 },
  api:    { cpu: 1.0, ram: 0.8, net: 0.8, gpu: 0.0 },
  db:     { cpu: 0.7, ram: 1.5, net: 0.5, gpu: 0.0 },
  worker: { cpu: 1.5, ram: 0.7, net: 0.3, gpu: 0.0 },
  ml:     { cpu: 1.2, ram: 1.2, net: 0.4, gpu: 2.5 },
  static: { cpu: 0.2, ram: 0.2, net: 1.2, gpu: 0.0 },
};

export function recommend(
  plans: VultrPlan[],
  input: RecommendationInput,
  topN = 3,
): RecommendationPick[] {
  const w = WORKLOAD_WEIGHTS[input.workload];
  const picks: RecommendationPick[] = [];

  for (const plan of plans) {
    if (input.budget_monthly && plan.monthly_cost > input.budget_monthly) continue;
    if (input.ram_gb_min && plan.ram / 1024 < input.ram_gb_min) continue;
    if (input.vcpu_min && plan.vcpu_count < input.vcpu_min) continue;

    const targetRegions = input.region_hint
      ? plan.locations.filter((r) => r === input.region_hint || r.startsWith(input.region_hint!))
      : plan.locations;
    if (targetRegions.length === 0) continue;

    for (const region of targetRegions) {
      const cpuScore = plan.vcpu_count * w.cpu;
      const ramScore = (plan.ram / 1024) * w.ram;
      const netScore = (plan.bandwidth / 1000) * w.net;
      const gpuScore = (plan.gpu_vram_gb ?? 0) * w.gpu;
      const utility = cpuScore + ramScore + netScore + gpuScore;
      const costPenalty = Math.log10(plan.monthly_cost + 1);
      const score = utility / (costPenalty || 1);

      const reasonParts: string[] = [];
      reasonParts.push(`${plan.vcpu_count} vCPU / ${(plan.ram / 1024).toFixed(0)} GB RAM`);
      reasonParts.push(`$${plan.monthly_cost}/mo`);
      if (plan.gpu_vram_gb) reasonParts.push(`${plan.gpu_vram_gb} GB GPU`);
      reasonParts.push(`@${region}`);

      picks.push({
        plan_id: plan.id,
        region_id: region,
        monthly_cost: plan.monthly_cost,
        rationale: reasonParts.join(" · "),
        score,
      });
    }
  }

  return picks.sort((a, b) => b.score - a.score).slice(0, topN);
}
