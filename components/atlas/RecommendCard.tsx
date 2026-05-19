"use client";
import { useState } from "react";
import { useAtlas } from "@/lib/store";
import type { RecommendationPick } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RecommendCard() {
  const { regions, plans } = useAtlas();
  const [open, setOpen] = useState(false);
  const [workload, setWorkload] = useState<"web" | "api" | "db" | "worker" | "ml" | "static">("api");
  const [ramMin, setRamMin] = useState(2);
  const [vcpuMin, setVcpuMin] = useState(1);
  const [budget, setBudget] = useState(50);
  const [regionHint, setRegionHint] = useState<string>("");
  const [picks, setPicks] = useState<RecommendationPick[]>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setPicks([]);
    try {
      const res = await fetch("/api/agent/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intent: "best fit for workload",
          workload,
          ram_gb_min: ramMin,
          vcpu_min: vcpuMin,
          budget_monthly: budget || undefined,
          region_hint: regionHint || undefined,
        }),
      });
      const j = await res.json();
      setPicks(j.picks ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-panel/70 backdrop-blur">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-accent">Recommend</div>
          <h3 className="text-sm font-semibold">Best plan for your workload</h3>
        </div>
        <span className="text-xs text-gray-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="border-t border-line p-4 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-gray-400">Workload</span>
              <select
                value={workload}
                onChange={(e) => setWorkload(e.target.value as any)}
                className="rounded border border-line bg-bg p-1.5"
              >
                <option value="web">Web (static + CDN-style)</option>
                <option value="api">API / backend</option>
                <option value="db">Database</option>
                <option value="worker">Background worker</option>
                <option value="ml">ML inference (GPU)</option>
                <option value="static">Static site</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-400">Region hint</span>
              <select
                value={regionHint}
                onChange={(e) => setRegionHint(e.target.value)}
                className="rounded border border-line bg-bg p-1.5"
              >
                <option value="">Any</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.city}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-400">Min RAM (GB)</span>
              <input
                type="number"
                value={ramMin}
                min={0}
                onChange={(e) => setRamMin(Number(e.target.value))}
                className="rounded border border-line bg-bg p-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-400">Min vCPU</span>
              <input
                type="number"
                value={vcpuMin}
                min={0}
                onChange={(e) => setVcpuMin(Number(e.target.value))}
                className="rounded border border-line bg-bg p-1.5"
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-gray-400">Max budget $/month</span>
              <input
                type="number"
                value={budget}
                min={0}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="rounded border border-line bg-bg p-1.5"
              />
            </label>
          </div>
          <button
            onClick={run}
            disabled={loading}
            className={cn(
              "mt-3 w-full rounded bg-accent px-3 py-2 font-semibold text-bg",
              loading && "opacity-60",
            )}
          >
            {loading ? "Scoring…" : "Recommend"}
          </button>
          {picks.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {picks.map((p, i) => {
                const plan = plans.find((pp) => pp.id === p.plan_id);
                const region = regions.find((r) => r.id === p.region_id);
                return (
                  <li
                    key={`${p.plan_id}-${p.region_id}-${i}`}
                    className="rounded border border-line/60 bg-bg/40 p-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-accent">
                        {plan?.type ?? "?"} · {plan?.id}
                      </span>
                      <span className="text-[11px] text-gray-300">
                        ${p.monthly_cost}/mo
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-400">{p.rationale}</div>
                    <div className="mt-0.5 text-[10px] text-gray-500">
                      {region?.city ?? p.region_id} · score {p.score.toFixed(2)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
