"use client";
import { useEffect, useMemo, useState } from "react";
import { Cpu, HardDrive, Wifi, Server, Zap, ShieldCheck, Loader2, Check, X, ShoppingCart, Plus, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAtlas } from "@/lib/store";
import type { CatalogSnapshot, FleetSnapshot, VultrApplication, VultrOs, VultrPlan, VultrMetalPlan } from "@/lib/types";
import { osBlockReason, appBlockReason } from "@/lib/vultr-rules";
import { useIsDemo } from "@/lib/role";

type PlanKind = "cloud" | "metal";

const FAMILY_LABEL: Record<string, string> = {
  vc2: "Cloud Compute (vc2 · regular Intel)",
  vhf: "High Frequency (vhf · 3+ GHz Intel)",
  vhp: "High Performance (vhp · AMD EPYC / Intel Xeon)",
  voc: "Optimized Cloud (voc · dedicated CPU)",
  vbm: "Bare Metal (vbm)",
  vcg: "Cloud GPU (vcg · NVIDIA)",
  vdc: "Dedicated Cloud (vdc)",
};

function planFamily(type: string): string {
  return type?.split("-")[0]?.toLowerCase() || "other";
}
function isGpuPlan(plan: VultrPlan | VultrMetalPlan): boolean {
  return !!plan.gpu_vram_gb || !!plan.gpu_type || /vcg|gpu/i.test(plan.type);
}

export function RegionConfigurator({
  regionId,
  onClose,
  variant = "overlay",
}: {
  regionId: string;
  onClose: () => void;
  variant?: "overlay" | "page";
}) {
  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null);
  const [fleet, setFleet] = useState<FleetSnapshot | null>(null);
  const [kind, setKind] = useState<PlanKind>("cloud");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedOs, setSelectedOs] = useState<number | null>(null);
  const [selectedApp, setSelectedApp] = useState<number | null>(null);
  const [boot, setBoot] = useState<"os" | "app">("os");
  const [label, setLabel] = useState("atlas-instance");
  const [hostname, setHostname] = useState("");
  const [enableIpv6, setEnableIpv6] = useState(true);
  const [backups, setBackups] = useState(false);
  const [filter, setFilter] = useState({ gpu: false, minRam: 0, maxMonthly: 0 });
  const [added, setAdded] = useState(false);
  const addToCart = useAtlas((s) => s.addToCart);
  const isDemo = useIsDemo();

  useEffect(() => {
    (async () => {
      const [cR, fR] = await Promise.all([fetch("/api/vultr/catalog"), fetch("/api/vultr")]);
      if (cR.ok) setCatalog(await cR.json());
      if (fR.ok) setFleet(await fR.json());
    })();
  }, []);

  const region = catalog?.regions.find((r) => r.id === regionId) ?? fleet?.regions.find((r) => r.id === regionId);
  const allCloud = catalog?.plans ?? [];
  const allMetal = catalog?.metalPlans ?? [];
  const cloudInRegion = useMemo(() => allCloud.filter((p) => (p.locations ?? []).includes(regionId)), [allCloud, regionId]);
  const metalInRegion = useMemo(() => allMetal.filter((p) => (p.locations ?? []).includes(regionId)), [allMetal, regionId]);
  const plans: (VultrPlan | VultrMetalPlan)[] = kind === "cloud" ? cloudInRegion : metalInRegion;
  const filteredPlans = useMemo(() => plans.filter((p) => {
    if (filter.gpu && !isGpuPlan(p)) return false;
    if (filter.minRam && p.ram / 1024 < filter.minRam) return false;
    if (filter.maxMonthly && p.monthly_cost > filter.maxMonthly) return false;
    return true;
  }), [plans, filter]);
  const byFamily = useMemo(() => {
    const m: Record<string, (VultrPlan | VultrMetalPlan)[]> = {};
    for (const p of filteredPlans) (m[planFamily(p.type)] ??= []).push(p);
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.monthly_cost - b.monthly_cost);
    return m;
  }, [filteredPlans]);
  const linuxOs = useMemo(() => (catalog?.os ?? []).filter((o) => /linux|ubuntu|debian|centos|alma|rocky|fedora|alpine/i.test(o.family + " " + o.name)), [catalog]);
  const windowsOs = useMemo(() => (catalog?.os ?? []).filter((o) => /windows/i.test(o.family + " " + o.name)), [catalog]);
  const planObj = filteredPlans.find((p) => p.id === selectedPlan) ?? null;
  // Clear OS/app if no longer compatible with the chosen plan.
  useEffect(() => {
    if (!planObj) return;
    if (selectedOs) {
      const os = (catalog?.os ?? []).find((o) => o.id === selectedOs);
      if (os && osBlockReason(planObj, os)) setSelectedOs(null);
    }
    if (selectedApp) {
      const app = (catalog?.applications ?? []).find((a) => a.id === selectedApp);
      if (app && appBlockReason(planObj, app)) setSelectedApp(null);
    }
  }, [planObj, selectedOs, selectedApp, catalog]);
  const ready = !!selectedPlan && (boot === "os" ? !!selectedOs : !!selectedApp);

  function handleAddToCart() {
    if (!ready || !planObj) return;
    addToCart({
      region: regionId,
      plan: planObj.id,
      os_id: boot === "os" ? (selectedOs ?? undefined) : undefined,
      app_id: boot === "app" ? (selectedApp ?? undefined) : undefined,
      label,
      hostname: hostname || undefined,
      enable_ipv6: enableIpv6,
      backups,
      monthly_cost: planObj.monthly_cost,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  if (!catalog || !region) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin text-accent" /> Loading region…
      </div>
    );
  }

  const fleetInstancesHere = fleet?.instances.filter((i) => i.region === regionId) ?? [];
  const status = fleet?.regionStatus.find((s) => s.region_id === regionId);

  return (
    <div className={cn("flex h-full flex-col gap-3", variant === "overlay" ? "p-3" : "")}>
      <header className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel/80 px-3 py-2 backdrop-blur sm:gap-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-widest text-accent">{regionId.toUpperCase()} · configurator</div>
          <h2 className="truncate text-base font-semibold leading-tight sm:text-lg">{region.city}, {region.country}</h2>
        </div>
        <div className="order-3 flex w-full flex-wrap items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest sm:order-none sm:ml-auto sm:w-auto">
          <span className={cn("rounded border px-2 py-0.5",
            status?.status === "ok" && "border-ok/40 text-ok",
            status?.status === "planned" && "border-warn/40 text-warn",
            status?.status === "degraded" && "border-danger/40 text-danger",
            (!status || status.status === "unknown" || status.status === "resolved") && "border-line text-gray-400",
          )}>{status?.status ?? "unknown"}</span>
          <span className="rounded border border-line px-2 py-0.5 text-gray-400">{fleetInstancesHere.length} yours here</span>
          <span className="rounded border border-line px-2 py-0.5 text-gray-400">{cloudInRegion.length + metalInRegion.length} plans</span>
        </div>
        <button onClick={onClose} className="rounded-md border border-line p-1.5 text-gray-400 hover:border-accent hover:text-accent" title="Close">
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto md:grid-cols-[200px_1fr] md:overflow-hidden xl:grid-cols-[240px_1fr_280px]">
        <div className="flex flex-col gap-2 overflow-auto pr-1">
          <Panel title="Plan family">
            <div className="inline-flex w-full overflow-hidden rounded-md border border-line">
              <button onClick={() => setKind("cloud")} className={cn("flex-1 py-1.5 text-[11px] font-mono uppercase tracking-widest", kind === "cloud" ? "bg-accent text-bg" : "text-gray-300 hover:bg-line/40")}>cloud · {cloudInRegion.length}</button>
              <button onClick={() => setKind("metal")} className={cn("flex-1 py-1.5 text-[11px] font-mono uppercase tracking-widest", kind === "metal" ? "bg-accent2 text-bg" : "text-gray-300 hover:bg-line/40")}>metal · {metalInRegion.length}</button>
            </div>
          </Panel>
          <Panel title="Filters">
            <label className="flex items-center justify-between gap-2 text-xs text-gray-300">
              <span className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-accent2" /> GPU only</span>
              <input type="checkbox" checked={filter.gpu} onChange={(e) => setFilter((f) => ({ ...f, gpu: e.target.checked }))} />
            </label>
            <label className="mt-2 block text-xs text-gray-300">
              <span className="text-[10px] uppercase text-gray-500">min RAM (GB)</span>
              <input type="number" min={0} value={filter.minRam || ""} onChange={(e) => setFilter((f) => ({ ...f, minRam: Number(e.target.value) || 0 }))} className="mt-1 w-full rounded border border-line bg-bg/60 px-2 py-1 text-xs" />
            </label>
            <label className="mt-2 block text-xs text-gray-300">
              <span className="text-[10px] uppercase text-gray-500">max $/mo</span>
              <input type="number" min={0} value={filter.maxMonthly || ""} onChange={(e) => setFilter((f) => ({ ...f, maxMonthly: Number(e.target.value) || 0 }))} className="mt-1 w-full rounded border border-line bg-bg/60 px-2 py-1 text-xs" />
            </label>
          </Panel>
          <Panel title="Boot from">
            <div className="inline-flex w-full overflow-hidden rounded-md border border-line">
              <button onClick={() => setBoot("os")} className={cn("flex-1 py-1.5 text-[11px] font-mono uppercase tracking-widest", boot === "os" ? "bg-accent text-bg" : "text-gray-300 hover:bg-line/40")}>OS</button>
              <button onClick={() => setBoot("app")} className={cn("flex-1 py-1.5 text-[11px] font-mono uppercase tracking-widest", boot === "app" ? "bg-accent text-bg" : "text-gray-300 hover:bg-line/40")}>App</button>
            </div>
            {boot === "os" ? (
              <div className="mt-2 max-h-80 space-y-1 overflow-auto pr-1">
                <OsGroup title="Linux" items={linuxOs} selected={selectedOs} onSelect={setSelectedOs} plan={planObj} />
                <OsGroup title="Windows" items={windowsOs} selected={selectedOs} onSelect={setSelectedOs} plan={planObj} />
              </div>
            ) : (
              <div className="mt-2 max-h-80 space-y-1 overflow-auto pr-1">
                {(catalog.applications ?? []).map((a: VultrApplication) => {
                  const block = planObj ? appBlockReason(planObj, a) : null;
                  return (
                    <button
                      key={a.id}
                      disabled={!!block}
                      onClick={() => setSelectedApp(a.id)}
                      title={block ?? a.deploy_name}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left text-xs",
                        block && "cursor-not-allowed opacity-40",
                        selectedApp === a.id ? "border-accent bg-accent/10 text-accent" : "border-line/60 text-gray-300 hover:border-line",
                      )}
                    >
                      <span className="truncate">{a.deploy_name}</span>
                      <span className="text-[10px] text-gray-500">{block ? "✕" : a.type}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-3 overflow-auto">
          {Object.keys(byFamily).length === 0 && (
            <div className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-gray-400">
              No plans match filters in this region.
            </div>
          )}
          {Object.entries(byFamily).map(([family, list]) => (
            <div key={family} className="rounded-lg border border-line bg-panel/40">
              <div className="flex items-center justify-between border-b border-line/70 px-3 py-2">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-accent">{family}</div>
                  <div className="text-xs text-gray-300">{FAMILY_LABEL[family] ?? family}</div>
                </div>
                <div className="text-[10px] text-gray-500">{list.length} · from ${list[0]?.monthly_cost}/mo</div>
              </div>
              <div className="grid grid-cols-1 gap-1.5 p-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((p) => {
                  const sel = selectedPlan === p.id;
                  const gpu = isGpuPlan(p);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlan(p.id)}
                      className={cn(
                        "relative rounded-md border p-2.5 text-left transition",
                        sel ? "border-accent bg-accent/10 shadow-glow" : "border-line/60 bg-bg/40 hover:border-line",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-gray-300">{p.id}</div>
                        {gpu && <span className="rounded bg-accent2/20 px-1.5 py-0.5 text-[9px] font-bold text-accent2">GPU</span>}
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-lg font-semibold">${p.monthly_cost}</span>
                        <span className="text-[10px] text-gray-500">/mo</span>
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10px] text-gray-400">
                        <SpecLine icon={<Cpu className="h-3 w-3" />}>{("vcpu_count" in p ? p.vcpu_count : (p as VultrMetalPlan).cpu_count)} vCPU</SpecLine>
                        <SpecLine icon={<Server className="h-3 w-3" />}>{Math.round(p.ram / 1024)} GB</SpecLine>
                        <SpecLine icon={<HardDrive className="h-3 w-3" />}>{p.disk} GB</SpecLine>
                        <SpecLine icon={<Wifi className="h-3 w-3" />}>{p.bandwidth} TB</SpecLine>
                      </div>
                      {gpu && (p as any).gpu_vram_gb && (
                        <div className="mt-1 text-[10px] text-accent2">{(p as any).gpu_vram_gb} GB · {(p as any).gpu_type ?? "GPU"}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 overflow-auto">
          <Panel title="Summary">
            <Row label="Region">{region.city} ({regionId})</Row>
            <Row label="Plan">{planObj ? <span className="text-accent">{planObj.id}</span> : <span className="text-gray-500">— pick a plan</span>}</Row>
            {planObj && (
              <>
                <Row label="Specs">{("vcpu_count" in planObj ? planObj.vcpu_count : (planObj as VultrMetalPlan).cpu_count)}c · {Math.round(planObj.ram / 1024)}GB · {planObj.disk}GB</Row>
                <Row label="Price"><span className="text-accent">${planObj.monthly_cost}/mo</span></Row>
              </>
            )}
            <Row label={boot === "os" ? "OS" : "App"}>
              {boot === "os"
                ? (selectedOs ? catalog.os.find((o: VultrOs) => o.id === selectedOs)?.name ?? `os ${selectedOs}` : <span className="text-gray-500">— pick</span>)
                : (selectedApp ? catalog.applications.find((a: VultrApplication) => a.id === selectedApp)?.deploy_name ?? `app ${selectedApp}` : <span className="text-gray-500">— pick</span>)}
            </Row>
          </Panel>
          <Panel title="Options">
            <label className="block text-xs text-gray-300">
              <span className="text-[10px] uppercase text-gray-500">Label</span>
              <input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 w-full rounded border border-line bg-bg/60 px-2 py-1 text-xs" />
            </label>
            <label className="mt-2 block text-xs text-gray-300">
              <span className="text-[10px] uppercase text-gray-500">Hostname</span>
              <input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder={label} className="mt-1 w-full rounded border border-line bg-bg/60 px-2 py-1 text-xs" />
            </label>
            <label className="mt-2 flex items-center justify-between text-xs text-gray-300">
              <span>IPv6</span>
              <input type="checkbox" checked={enableIpv6} onChange={(e) => setEnableIpv6(e.target.checked)} />
            </label>
            <label className="mt-2 flex items-center justify-between text-xs text-gray-300">
              <span>Backups (+20%)</span>
              <input type="checkbox" checked={backups} onChange={(e) => setBackups(e.target.checked)} />
            </label>
          </Panel>
          <button
            disabled={!ready || isDemo}
            onClick={handleAddToCart}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold transition",
              !ready || isDemo
                ? "cursor-not-allowed bg-line/40 text-gray-500"
                : "bg-accent text-bg shadow-glow hover:bg-teal-300",
            )}
            title={isDemo ? "Demo session is read-only — sign in as admin to provision" : undefined}
          >
            {isDemo ? <Lock className="h-4 w-4" /> : added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isDemo ? "Demo — sign in to provision" : added ? "Added to cart" : "Add to cart"}
          </button>
          <div className="rounded-md border border-line/60 bg-bg/30 p-2 text-[10px] text-gray-500">
            <ShoppingCart className="mr-1 inline h-3 w-3" /> Open the cart (top-right) to review and deploy. Copilot can also drive this via <span className="font-mono text-accent">atlas:add-to-cart</span> / <span className="font-mono text-accent">atlas:deploy-cart</span>.
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-panel/40 p-3">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-accent">{title}</div>
      {children}
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line/40 py-1.5 text-xs last:border-b-0">
      <span className="text-[10px] uppercase tracking-widest text-gray-500">{label}</span>
      <span className="text-right text-gray-200">{children}</span>
    </div>
  );
}
function SpecLine({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <span className="flex items-center gap-1">{icon}{children}</span>;
}
function OsGroup({ title, items, selected, onSelect, plan }: { title: string; items: VultrOs[]; selected: number | null; onSelect: (id: number) => void; plan: VultrPlan | VultrMetalPlan | null }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mt-1 px-1 font-mono text-[10px] uppercase tracking-widest text-gray-500">{title}</div>
      {items.map((o) => {
        const block = plan ? osBlockReason(plan, o) : null;
        return (
          <button
            key={o.id}
            disabled={!!block}
            onClick={() => onSelect(o.id)}
            title={block ?? o.name}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded border px-2 py-1 text-left text-xs",
              block && "cursor-not-allowed opacity-40",
              selected === o.id ? "border-accent bg-accent/10 text-accent" : "border-line/60 text-gray-300 hover:border-line",
            )}
          >
            <span className="truncate">{o.name}</span>
            <span className="text-[10px] text-gray-500">{block ? "✕ " + block.split(" ").slice(-2).join(" ") : o.arch}</span>
          </button>
        );
      })}
    </div>
  );
}
