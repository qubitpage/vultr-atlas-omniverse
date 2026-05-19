"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAtlas } from "@/lib/store";
import { RightRail } from "@/components/atlas/RightRail";
import { CartPanel } from "@/components/atlas/CartPanel";
import { CopilotBridge } from "@/components/atlas/CopilotBridge";
import { RegionConfigurator } from "@/components/atlas/RegionConfigurator";
import { ServiceNavigator, ServicePanel } from "@/components/atlas/ServiceNavigator";
import { Activity, AlertTriangle, Bot, ChevronRight, Globe2, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { aggregateCapacity, fmtBytes } from "@/lib/vultr-rules";
import { useRole } from "@/lib/role";

const Globe = dynamic(() => import("@/components/atlas/Globe").then((m) => m.Globe), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">
      Initialising globe…
    </div>
  ),
});

const MIN_RAIL = 360;
const MAX_RAIL = 620;
const DEFAULT_RAIL = 420;
const MOBILE_QUERY = "(max-width: 900px)";

function RoleBadge() {
  const role = useRole();
  if (!role) return null;
  const isDemo = role === "demo";
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  }
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded border bg-panel/60 px-2 py-1",
        isDemo ? "border-warn/40 text-warn" : "border-accent/40 text-accent",
      )}
      title={isDemo ? "Demo session is read-only" : "Admin session"}
    >
      <span className="mr-0.5">{isDemo ? "demo" : "admin"}</span>
      <button onClick={logout} className="text-gray-400 hover:text-white" title="Sign out">
        <LogOut className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function AtlasPage() {
  const setData = useAtlas((s) => s.setData);
  const loaded = useAtlas((s) => s.loaded);
  const instances = useAtlas((s) => s.instances);
  const regions = useAtlas((s) => s.regions);
  const services = useAtlas((s) => s.services);
  const plans = useAtlas((s) => s.plans);
  const regionStatus = useAtlas((s) => s.regionStatus);
  const maintenanceEvents = useAtlas((s) => s.maintenanceEvents);
  const apiConnected = useAtlas((s) => s.apiConnected);
  const apiError = useAtlas((s) => s.apiError);
  const focusRegion = useAtlas((s) => s.focusRegion);
  const openConfigurator = useAtlas((s) => s.openConfigurator);
  const configuratorRegion = useAtlas((s) => s.configuratorRegion);
  const activeCategory = useAtlas((s) => s.activeCategory);
  const railOpen = useAtlas((s) => s.railOpen);
  const setRailOpen = useAtlas((s) => s.setRailOpen);

  const [railWidth, setRailWidth] = useState<number>(DEFAULT_RAIL);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const resizeDrag = useRef<{ pointerId: number; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const saved = Number(localStorage.getItem("atlas:railWidth") || 0);
    if (saved >= MIN_RAIL && saved <= MAX_RAIL) setRailWidth(saved);
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    localStorage.setItem("atlas:railWidth", String(railWidth));
  }, [railWidth]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/vultr");
      if (cancelled || !res.ok) return;
      const j = await res.json();
      setData({
        regions: j.regions,
        plans: j.plans,
        metalPlans: j.metalPlans,
        instances: j.instances,
        services: j.services,
        regionStatus: j.regionStatus,
        maintenanceEvents: j.maintenanceEvents,
        sla: j.sla,
        fetchedAt: j.fetchedAt,
        apiConnected: j.apiConnected,
        apiError: j.apiError ?? null,
      });
    }
    load();
    // Live refresh every 30s so created/destroyed servers appear without a manual reload.
    const t = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [setData]);

  function clearResizeState(target?: Element | null, pointerId?: number) {
    if (target instanceof HTMLElement && pointerId !== undefined && target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
    resizeDrag.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    if (isMobile) return;
    if (e.button !== 0 || !e.isPrimary) return;
    e.preventDefault();
    resizeDrag.current = { pointerId: e.pointerId, startX: e.clientX, startW: railWidth };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function moveResize(e: React.PointerEvent<HTMLDivElement>) {
    const drag = resizeDrag.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.preventDefault();
    const dx = drag.startX - e.clientX;
    const next = Math.min(MAX_RAIL, Math.max(MIN_RAIL, drag.startW + dx));
    setRailWidth(next);
  }

  function endResize(e: React.PointerEvent<HTMLDivElement>) {
    const drag = resizeDrag.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    clearResizeState(e.currentTarget, e.pointerId);
  }

  const degraded = regionStatus.filter((s) => s.status === "degraded");
  const planned = regionStatus.filter((s) => s.status === "planned");
  const yourZones = new Set(instances.map((i) => i.region));
  const cap = aggregateCapacity(instances, plans);

  return (
    <main
      className={cn(
        "h-screen p-1.5 sm:p-3",
        isMobile ? "flex flex-col" : "grid gap-0",
      )}
      style={
        isMobile
          ? undefined
          : { gridTemplateColumns: `1fr 6px ${railWidth}px` }
      }
    >
      <CopilotBridge />
      <section className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-line bg-bg/40">
        <header className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 border-b border-line/40 bg-bg/85 px-2 py-2 backdrop-blur sm:gap-3 sm:px-4 sm:py-2.5">
          <Link href="/" className="hidden rounded-md border border-line bg-panel/60 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-gray-400 hover:border-accent hover:text-accent sm:inline-block">
            ← home
          </Link>
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-widest text-accent sm:text-[10px]">Vultr Atlas · live cockpit</div>
            <h1 className="truncate text-sm font-semibold leading-tight sm:text-lg">
              {regions.length} regions · {instances.length} servers · {services.length} resources
            </h1>
          </div>

          <div className="ml-auto flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-[9px] font-mono uppercase tracking-widest sm:gap-2 sm:text-[10px]">
            {cap.count > 0 && (
              <span
                className="hidden rounded border border-accent/40 bg-panel/60 px-2 py-1 text-accent shadow-glow xl:inline-block"
                title="Total Vultr computational capacity across all your active instances"
              >
                Σ {cap.vcpu}c · {cap.ramGb}GB · {fmtBytes(cap.diskGb)} · {fmtBytes(cap.bandwidthGb)}/mo · ${cap.monthlyCost}/mo
              </span>
            )}
            {cap.count > 0 && (
              <span className="hidden rounded border border-accent/40 bg-panel/60 px-2 py-1 text-accent md:inline-block xl:hidden">
                Σ {cap.vcpu}c · {cap.ramGb}G
              </span>
            )}
            <span className={cn("rounded border bg-panel/60 px-2 py-1", apiConnected ? "border-ok/40 text-ok" : "border-danger/40 text-danger")}>
              <span className="mr-1">●</span>{apiConnected ? "API" : "off"}
            </span>
            <RoleBadge />
            {planned.length > 0 && (
              <span className="hidden rounded border border-warn/40 bg-panel/60 px-2 py-1 text-warn sm:inline-block">{planned.length} planned</span>
            )}
            {degraded.length > 0 && (
              <span className="hidden rounded border border-danger/40 bg-panel/60 px-2 py-1 text-danger sm:inline-block">{degraded.length} degraded</span>
            )}
            <div className="relative">
              <CartPanel />
            </div>
            {isMobile && (
              <button
                onClick={() => setRailOpen(true)}
                className="rounded-md border border-accent/40 bg-panel/80 px-2 py-1 text-accent"
                title="Open Copilot"
              >
                <Bot className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </header>

        <div className="absolute inset-0 pt-[48px] sm:pt-[52px]">
          <Globe />
        </div>

        <ServiceNavigator />
        <ServicePanel />

        {loaded && !apiConnected && (
          <div className="absolute left-1/2 top-1/2 z-20 w-[520px] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-warn/40 bg-panel/90 p-5 shadow-glow backdrop-blur">
            <div className="font-mono text-[10px] uppercase tracking-widest text-warn">Real Vultr API required</div>
            <h2 className="mt-1 text-xl font-semibold">No account infrastructure is being shown</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              {apiError ?? "Set VULTR_API_KEY on the server to load real instances, load balancers, databases, blocks, VPCs, firewalls and maintenance context."}
            </p>
          </div>
        )}

        {!configuratorRegion && !activeCategory && (
          <div className="absolute bottom-2 left-2 right-2 z-10 hidden flex-col items-stretch gap-2 sm:bottom-3 sm:left-3 sm:right-3 sm:flex-row sm:items-end sm:gap-3 sm:pl-16 lg:flex">
            <div className="w-full rounded-lg border border-line bg-panel/75 backdrop-blur sm:w-[280px]">
              <div className="flex items-center gap-2 border-b border-line/70 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-accent">
                <Globe2 className="h-3 w-3" /> regions · click to configure
              </div>
              <div className="max-h-44 overflow-auto sm:max-h-64">
                {regions
                  .slice()
                  .sort((a, b) => (yourZones.has(b.id) ? 1 : 0) - (yourZones.has(a.id) ? 1 : 0))
                  .map((r) => {
                    const here = instances.filter((i) => i.region === r.id).length;
                    const svc = services.filter((s) => s.region === r.id).length;
                    const st = regionStatus.find((s) => s.region_id === r.id);
                    return (
                      <button
                        key={r.id}
                        onMouseEnter={() => focusRegion(r.id)}
                        onClick={() => openConfigurator(r.id)}
                        className="flex w-full items-center justify-between gap-2 border-b border-line/40 px-3 py-1.5 text-left text-xs hover:bg-line/30"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            st?.status === "ok" && "bg-ok",
                            st?.status === "planned" && "bg-warn",
                            st?.status === "degraded" && "bg-danger",
                            (!st || st.status === "unknown" || st.status === "resolved") && "bg-line",
                          )} />
                          <span className="truncate text-gray-200">{r.city}</span>
                          <span className="font-mono text-[10px] text-gray-500">{r.id}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                          {here > 0 && <span className="rounded bg-accent/10 px-1 text-accent">{here}</span>}
                          {svc > 0 && <span>{svc} svc</span>}
                          <ChevronRight className="h-3 w-3" />
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="hidden flex-1 rounded-lg border border-line bg-panel/75 backdrop-blur sm:block">
              <div className="flex items-center gap-2 border-b border-line/70 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-accent">
                <AlertTriangle className="h-3 w-3" /> network signals · {maintenanceEvents.length} maintenance · {planned.length} planned · {degraded.length} degraded
              </div>
              <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-auto p-2 lg:grid-cols-3">
                {maintenanceEvents.slice(0, 9).map((m) => (
                  <div key={m.id} className="rounded border border-warn/30 bg-warn/5 p-2 text-[11px]">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-warn">{m.status}</div>
                    <div className="truncate text-gray-100">{m.city}</div>
                    <div className="mt-0.5 truncate text-gray-500">{m.event_type}</div>
                    {m.starts_at && <div className="mt-0.5 text-[10px] text-gray-500">{m.starts_at}</div>}
                  </div>
                ))}
                {maintenanceEvents.length === 0 && (
                  <div className="col-span-full flex items-center gap-2 px-2 py-3 text-[11px] text-gray-500">
                    <Activity className="h-3 w-3 text-ok" /> No active maintenance events from Vultr status feed.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {configuratorRegion && (
          <div className="absolute inset-1 top-[52px] z-30 rounded-xl border border-accent/40 bg-bg/95 shadow-glow backdrop-blur sm:inset-3 sm:top-[60px]">
            <RegionConfigurator regionId={configuratorRegion} onClose={() => openConfigurator(null)} />
          </div>
        )}
      </section>

      {!isMobile && (
        <div
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onLostPointerCapture={(e) => {
            if (resizeDrag.current?.pointerId === e.pointerId) clearResizeState();
          }}
          className="group flex cursor-col-resize items-center justify-center"
          style={{ touchAction: "none" }}
          title="Drag to resize chat panel"
        >
          <div className="h-12 w-[3px] rounded-full bg-line transition group-hover:bg-accent" />
        </div>
      )}

      {!isMobile && (
        <aside className="h-full min-h-0">
          <RightRail />
        </aside>
      )}

      {isMobile && railOpen && (
        <div className="fixed inset-0 z-50 flex bg-bg/80 backdrop-blur" onClick={() => setRailOpen(false)}>
          <div
            className="ml-auto flex h-full w-[92vw] max-w-[480px] flex-col border-l border-line bg-bg p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-accent">Copilot · IDE · Gemini</span>
              <button onClick={() => setRailOpen(false)} className="rounded-md border border-line p-1.5 text-gray-400">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <RightRail />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
