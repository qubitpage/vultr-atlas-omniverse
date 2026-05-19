"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Activity, ClipboardList, ShieldCheck, ServerCog } from "lucide-react";
import { useAtlas } from "@/lib/store";
import { cn } from "@/lib/utils";

type Tab = "ops" | "maintenance" | "sla";

const healthClass = {
  ok: "border-ok/30 text-ok bg-ok/5",
  watch: "border-warn/40 text-warn bg-warn/5",
  degraded: "border-danger/50 text-danger bg-danger/5",
  maintenance: "border-accent2/50 text-accent2 bg-accent2/5",
};

export function OperationsPanel() {
  const {
    regions,
    instances,
    services,
    regionStatus,
    maintenanceEvents,
    selectedRegion,
    sla,
    fetchedAt,
    apiConnected,
    apiError,
  } = useAtlas();
  const [tab, setTab] = useState<Tab>("ops");
  const region = regions.find((item) => item.id === selectedRegion) ?? regions[0];
  const regionId = region?.id;

  const zoneInstances = useMemo(
    () => (regionId ? instances.filter((instance) => instance.region === regionId) : []),
    [instances, regionId],
  );
  const zoneServices = useMemo(
    () => services.filter((service) => !regionId || !service.region || service.region === regionId),
    [services, regionId],
  );
  const zoneEvents = useMemo(
    () => maintenanceEvents.filter((event) => !regionId || !event.region_id || event.region_id === regionId),
    [maintenanceEvents, regionId],
  );
  const zoneStatus = regionStatus.find((status) => status.region_id === regionId);
  const attention = [
    ...zoneInstances.flatMap((instance) => (instance.attention ?? []).map((item) => `${instance.label}: ${item}`)),
    ...zoneServices.flatMap((service) => service.attention.map((item) => `${service.label}: ${item}`)),
    ...zoneEvents.filter((event) => event.status === "planned" || event.status === "active").map((event) => `${event.city}: ${event.title}`),
  ];

  const knownTemps = zoneInstances.map((instance) => instance.temp_c).filter((value): value is number => typeof value === "number");
  const knownCpu = zoneInstances.map((instance) => instance.cpu).filter((value): value is number => typeof value === "number");
  const avgTemp = knownTemps.length ? knownTemps.reduce((sum, value) => sum + value, 0) / knownTemps.length : null;
  const avgCpu = knownCpu.length ? knownCpu.reduce((sum, value) => sum + value, 0) / knownCpu.length : null;

  return (
    <div className="rounded-lg border border-line bg-panel/75 p-3 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-accent2">
            Zone Operations
          </div>
          <h3 className="text-sm font-semibold">
            {region ? `${region.city}, ${region.country}` : "Fleet overview"}
          </h3>
          <div className="mt-0.5 text-[10px] text-gray-500">
            {apiConnected ? "Vultr API" : "not connected"} · refreshed {fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : "—"}
          </div>
        </div>
        <div className={cn("rounded-md border px-2 py-1 text-[10px] font-mono uppercase", statusTone(zoneStatus?.status))}>
          {zoneStatus?.status ?? "unknown"}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5 text-[10px]">
        <Stat label="Servers" value={String(zoneInstances.length)} />
        <Stat label="Services" value={String(zoneServices.length)} />
        <Stat label="Avg CPU" value={avgCpu === null ? "N/A" : `${avgCpu.toFixed(0)}%`} />
        <Stat label="Thermal" value={avgTemp === null ? "N/A" : `${avgTemp.toFixed(0)}°C`} />
      </div>

      <div className="mt-3 flex overflow-hidden rounded-md border border-line bg-bg/40 text-[10px] font-mono uppercase tracking-widest">
        <TabButton active={tab === "ops"} onClick={() => setTab("ops")} icon={<Activity className="h-3 w-3" />} label="Ops" />
        <TabButton active={tab === "maintenance"} onClick={() => setTab("maintenance")} icon={<ClipboardList className="h-3 w-3" />} label="Maint" />
        <TabButton active={tab === "sla"} onClick={() => setTab("sla")} icon={<ShieldCheck className="h-3 w-3" />} label="SLA" />
      </div>

      <div className="mt-3 max-h-64 overflow-auto pr-1 scrollbar-thin">
        {tab === "ops" && (
          <div className="space-y-2">
            {attention.length > 0 ? (
              <div className="rounded-md border border-warn/40 bg-warn/5 p-2">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-warn">
                  <AlertTriangle className="h-3 w-3" /> Needs Attention
                </div>
                <ul className="space-y-1 text-[11px] text-gray-300">
                  {attention.slice(0, 6).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-md border border-ok/30 bg-ok/5 p-2 text-[11px] text-ok">
                {apiConnected ? "No immediate attention items in this zone." : apiError ?? "Connect VULTR_API_KEY to load real account infrastructure."}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Active infrastructure</div>
              {zoneServices.length === 0 && (
                <div className="rounded border border-line/60 bg-bg/40 p-2 text-[11px] text-gray-400">
                  {apiConnected ? "No services returned by the Vultr API for this zone." : "No placeholder inventory. Add a real Vultr API key to populate this list."}
                </div>
              )}
              {zoneServices.slice(0, 14).map((service) => (
                <div key={`${service.kind}-${service.id}`} className="flex items-center justify-between gap-2 rounded border border-line/60 bg-bg/40 p-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] text-gray-200">{service.label}</div>
                    <div className="text-[10px] text-gray-500">{service.kind.replace(/_/g, " ")} · {service.region ?? "global"}</div>
                  </div>
                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px]", healthClass[service.health])}>
                    {service.health}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "maintenance" && (
          <div className="space-y-2">
            {zoneEvents.length === 0 ? (
              <div className="rounded-md border border-line/60 bg-bg/40 p-2 text-[11px] text-gray-400">
                No current maintenance events for this zone from Vultr status.
              </div>
            ) : (
              zoneEvents.map((event) => (
                <div key={event.id} className="rounded-md border border-line/70 bg-bg/40 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-accent">{event.id}</div>
                    <span className={cn("rounded border px-1.5 py-0.5 text-[10px]", event.impact === "high" ? "border-warn/50 text-warn" : "border-line text-gray-400")}>
                      {event.impact}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-gray-200">{event.title}</div>
                  <div className="mt-1 text-[10px] text-gray-500">{event.event_type}</div>
                  <div className="mt-1 text-[10px] text-gray-400">{event.starts_at ?? "start unknown"} → {event.ends_at ?? "end unknown"}</div>
                  <p className="mt-1 text-[10px] leading-relaxed text-gray-500">{event.summary}</p>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "sla" && sla && (
          <div className="space-y-2 text-[11px] text-gray-300">
            <div className="rounded-md border border-ok/30 bg-ok/5 p-2 text-ok">
              {sla.uptime_guarantee}
            </div>
            <p className="text-gray-400">{sla.scope}</p>
            <div>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-gray-500">Exclusions</div>
              <ul className="space-y-1 text-gray-400">
                {sla.exclusions.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {sla.credits.map((credit) => (
                <div key={credit.outage} className="rounded border border-line/60 bg-bg/40 p-1.5">
                  <div className="text-[10px] text-gray-500">{credit.outage}</div>
                  <div className="font-mono text-[10px] text-accent">{credit.credit}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line/60 bg-bg/40 p-1.5">
      <div className="font-mono text-[9px] uppercase tracking-widest text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-100">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn("flex flex-1 items-center justify-center gap-1 px-2 py-1.5 transition", active ? "bg-accent2 text-bg" : "text-gray-400 hover:bg-line/40")}
    >
      {icon}
      {label}
    </button>
  );
}

function statusTone(status?: string) {
  switch (status) {
    case "ok":
      return "border-ok/30 bg-ok/5 text-ok";
    case "planned":
      return "border-accent2/40 bg-accent2/5 text-accent2";
    case "degraded":
      return "border-danger/50 bg-danger/5 text-danger";
    case "resolved":
      return "border-warn/40 bg-warn/5 text-warn";
    default:
      return "border-line bg-bg/40 text-gray-400";
  }
}
