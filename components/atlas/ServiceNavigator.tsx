"use client";
import { useMemo, useState } from "react";
import {
  LayoutDashboard,
  Server,
  Database,
  Network,
  Boxes,
  Sparkles,
  HelpCircle,
  Rocket,
  Trash2,
  Loader2,
  AlertTriangle,
  Power,
  RotateCcw,
  X,
  ExternalLink,
  Cpu,
  HardDrive,
  Wifi,
  Globe2,
  ChevronRight,
} from "lucide-react";
import { useAtlas, type ServiceCategory } from "@/lib/store";
import { useIsDemo } from "@/lib/role";
import { cn } from "@/lib/utils";
import type { InfrastructureService, VultrInstance } from "@/lib/types";
import { aggregateCapacity, categoryForServiceKind, fmtBytes } from "@/lib/vultr-rules";

type NavItem = { id: ServiceCategory; label: string; icon: typeof Server };
const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "compute", label: "Compute", icon: Server },
  { id: "storage", label: "Storage", icon: Database },
  { id: "network", label: "Network", icon: Network },
  { id: "orchestration", label: "Orchestration", icon: Boxes },
  { id: "marketplace", label: "Marketplace", icon: Sparkles },
  { id: "quick-deploy", label: "Quick Deploy", icon: Rocket },
  { id: "help", label: "Help", icon: HelpCircle },
];

export function ServiceNavigator() {
  const active = useAtlas((s) => s.activeCategory);
  const setActiveCategory = useAtlas((s) => s.setActiveCategory);
  return (
    <div className="absolute left-3 top-[60px] z-20 flex flex-col gap-1 rounded-lg border border-line bg-panel/85 p-1 backdrop-blur lg:top-[60px]">
      {NAV.map((n) => {
        const Icon = n.icon;
        const sel = active === n.id;
        return (
          <button
            key={n.id}
            onClick={() => setActiveCategory(sel ? null : n.id)}
            title={n.label}
            className={cn(
              "group relative flex h-10 w-10 items-center justify-center rounded-md transition",
              sel ? "bg-accent text-bg shadow-glow" : "text-gray-400 hover:bg-line/50 hover:text-gray-100",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="pointer-events-none absolute left-12 z-30 hidden rounded border border-line bg-panel/95 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-gray-200 shadow group-hover:block">
              {n.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ServicePanel() {
  const active = useAtlas((s) => s.activeCategory);
  const setActiveCategory = useAtlas((s) => s.setActiveCategory);
  const services = useAtlas((s) => s.services);
  const instances = useAtlas((s) => s.instances);
  const plans = useAtlas((s) => s.plans);
  const regions = useAtlas((s) => s.regions);
  const openConfigurator = useAtlas((s) => s.openConfigurator);
  const setData = useAtlas((s) => s.setData);
  const isDemo = useIsDemo();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const cap = useMemo(() => aggregateCapacity(instances, plans), [instances, plans]);

  if (!active) return null;

  async function refresh() {
    const r = await fetch("/api/vultr");
    if (r.ok) {
      const j = await r.json();
      setData({
        regions: j.regions, plans: j.plans, metalPlans: j.metalPlans,
        instances: j.instances, services: j.services,
        regionStatus: j.regionStatus, maintenanceEvents: j.maintenanceEvents,
        sla: j.sla, fetchedAt: j.fetchedAt, apiConnected: j.apiConnected, apiError: j.apiError ?? null,
      });
    }
  }

  async function destroy(svc: InfrastructureService | VultrInstance, kind?: string) {
    const id = (svc as any).id;
    const k = kind ?? (svc as InfrastructureService).kind ?? "instance";
    const label = (svc as any).label ?? id;
    if (!confirm(`Delete ${k} "${label}" (${id})? This cannot be undone.`)) return;
    setBusy(id); setErr(null);
    try {
      const res = await fetch("/api/vultr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(k === "instance" ? { action: "destroy_instance", id } : { action: "destroy_service", kind: k, id }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "delete failed");
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function instanceAction(id: string, action: "reboot_instance" | "start_instance" | "stop_instance") {
    setBusy(id); setErr(null);
    try {
      const res = await fetch("/api/vultr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? action + " failed");
      setTimeout(refresh, 1500);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  // Filter services by active category. Compute = instances. Others use kind→category map.
  const filtered = active === "compute"
    ? instances.map((i) => ({ ...i, kind: "instance" as const, region: i.region, label: i.label }))
    : services.filter((s) => categoryForServiceKind(s.kind) === active);

  const title = NAV.find((n) => n.id === active)?.label ?? "Services";

  return (
    <div className="absolute left-16 top-[60px] z-20 flex h-[calc(100%-72px)] w-full max-w-[440px] flex-col rounded-lg border border-accent/40 bg-bg/95 shadow-glow backdrop-blur lg:max-w-[480px]">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-accent">{title}</div>
          <div className="text-sm font-semibold">{filtered.length} resource{filtered.length === 1 ? "" : "s"}</div>
        </div>
        <button onClick={() => setActiveCategory(null)} className="ml-auto rounded-md border border-line p-1.5 text-gray-400 hover:border-accent hover:text-accent">
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      {err && (
        <div className="mx-4 mt-2 flex items-start gap-2 rounded border border-danger/40 bg-danger/10 p-2 text-[11px] text-danger">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{err}</span>
        </div>
      )}

      {active === "dashboard" && (
        <div className="space-y-2 p-4">
          <CapTile label="Servers" value={String(cap.count)} sub="active instances" />
          <CapTile label="Compute" value={`${cap.vcpu} vCPU`} sub={`${cap.ramGb} GB RAM`} />
          <CapTile label="Storage" value={fmtBytes(cap.diskGb)} sub="across all instances" />
          <CapTile label="Bandwidth" value={fmtBytes(cap.bandwidthGb)} sub="monthly allowance" />
          <CapTile label="Spend" value={`$${cap.monthlyCost}/mo`} sub={`across ${regions.length} regions`} />
        </div>
      )}

      {active === "marketplace" && (
        <div className="space-y-2 p-4 text-sm text-gray-300">
          <p>Open the configurator on any region and switch to the <span className="text-accent">App</span> boot source to deploy from the Vultr Marketplace.</p>
          <button
            onClick={() => { setActiveCategory(null); openConfigurator(regions[0]?.id ?? null); }}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-bg text-xs font-semibold hover:bg-teal-300"
          >
            <Sparkles className="h-3.5 w-3.5" /> Open marketplace browser
          </button>
        </div>
      )}

      {active === "quick-deploy" && (
        <div className="space-y-2 p-4 text-sm text-gray-300">
          <p>Pick the cheapest available <span className="font-mono text-accent">vc2-1c-1gb</span> Ubuntu 22.04 in your nearest region — perfect for tests and demos.</p>
          {regions.slice(0, 6).map((r) => (
            <button
              key={r.id}
              onClick={() => { setActiveCategory(null); openConfigurator(r.id); }}
              className="flex w-full items-center justify-between gap-2 rounded border border-line bg-panel/60 px-3 py-2 text-xs hover:border-accent hover:text-accent"
            >
              <span className="flex items-center gap-2"><Globe2 className="h-3 w-3" /> {r.city}</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {active === "help" && (
        <div className="space-y-2 p-4 text-sm text-gray-300">
          <p>Atlas exposes a <span className="font-mono text-accent">postMessage</span> protocol. The Copilot chat (right rail) can drive the cockpit:</p>
          <ul className="space-y-1 font-mono text-[11px] text-gray-400">
            <li>· <span className="text-accent">atlas:focus</span> — fly the globe to a region</li>
            <li>· <span className="text-accent">atlas:open-region</span> — open the configurator</li>
            <li>· <span className="text-accent">atlas:add-to-cart</span> — queue a server for deploy</li>
            <li>· <span className="text-accent">atlas:deploy-cart</span> — provision everything</li>
          </ul>
          <a href="https://www.vultr.com/docs/" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-accent hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> Vultr documentation
          </a>
        </div>
      )}

      {(active === "compute" || active === "storage" || active === "network" || active === "orchestration") && (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {filtered.length === 0 && (
            <div className="flex h-full items-center justify-center text-center text-xs text-gray-500">
              No {title.toLowerCase()} resources in your account yet.
            </div>
          )}
          {filtered.map((s: any) => {
            const isInstance = s.kind === "instance";
            const inst: VultrInstance | undefined = isInstance ? instances.find((i) => i.id === s.id) : undefined;
            const region = regions.find((r) => r.id === (inst?.region ?? s.region));
            return (
              <div key={`${s.kind}:${s.id}`} className="mb-1.5 rounded border border-line/60 bg-panel/40 p-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-gray-100">{s.label || s.id}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-gray-500">
                      {s.kind} · {region?.city ?? s.region ?? "—"} · {s.id.slice(0, 12)}
                    </div>
                    {inst && (
                      <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-gray-400">
                        <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />{inst.vcpu_count} vCPU</span>
                        <span className="flex items-center gap-1"><Server className="h-3 w-3" />{Math.round((inst.ram ?? 0) / 1024)} GB</span>
                        <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />{inst.disk} GB</span>
                        <span className="flex items-center gap-1"><Wifi className="h-3 w-3" />{inst.main_ip || "—"}</span>
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest",
                        s.status === "active" ? "bg-ok/15 text-ok" :
                          s.status === "pending" ? "bg-warn/15 text-warn" :
                            s.status ? "bg-line/40 text-gray-400" : "bg-line/40 text-gray-500",
                      )}>{s.status ?? "?"}</span>
                      {s.endpoint && <span className="font-mono text-[10px] text-gray-500">{s.endpoint}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {isInstance && (
                      <>
                        <button title="Reboot" disabled={busy === s.id || isDemo} onClick={() => instanceAction(s.id, "reboot_instance")} className="rounded border border-line p-1 text-gray-400 hover:border-accent hover:text-accent disabled:opacity-40">
                          <RotateCcw className="h-3 w-3" />
                        </button>
                        <button title={inst?.power_status === "running" ? "Stop" : "Start"} disabled={busy === s.id || isDemo} onClick={() => instanceAction(s.id, inst?.power_status === "running" ? "stop_instance" : "start_instance")} className="rounded border border-line p-1 text-gray-400 hover:border-warn hover:text-warn disabled:opacity-40">
                          <Power className="h-3 w-3" />
                        </button>
                      </>
                    )}
                    <button title={isDemo ? "Demo session is read-only" : "Delete"} disabled={busy === s.id || isDemo} onClick={() => destroy(s, s.kind)} className="rounded border border-line p-1 text-gray-400 hover:border-danger hover:text-danger disabled:opacity-40">
                      {busy === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CapTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel/60 p-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-accent">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold leading-tight">{value}</div>
      <div className="mt-0.5 text-[11px] text-gray-500">{sub}</div>
    </div>
  );
}
