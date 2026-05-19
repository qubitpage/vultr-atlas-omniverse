"use client";
import { useMemo } from "react";
import { Thermometer, Network, ShieldCheck } from "lucide-react";
import { useAtlas } from "@/lib/store";
import { cn } from "@/lib/utils";

const healthTone = {
  ok: "border-ok/30 text-ok bg-ok/5",
  watch: "border-warn/40 text-warn bg-warn/5",
  degraded: "border-danger/50 text-danger bg-danger/5",
  maintenance: "border-accent2/50 text-accent2 bg-accent2/5",
};

export function RegionPanel() {
  const {
    regions,
    instances,
    plans,
    regionStatus,
    maintenanceEvents,
    selectedRegion,
    selectInstance,
    selectedInstance,
  } = useAtlas();
  const region = regions.find((item) => item.id === selectedRegion);
  const here = useMemo(
    () => instances.filter((instance) => instance.region === selectedRegion),
    [instances, selectedRegion],
  );
  const status = regionStatus.find((item) => item.region_id === selectedRegion);
  const events = maintenanceEvents.filter((event) => event.region_id === selectedRegion);

  if (!region) {
    return (
      <div className="rounded-lg border border-line bg-panel/60 p-4 text-sm text-gray-400 backdrop-blur">
        Click a real Vultr zone marker on the globe to expand that datacenter into servers, services, maintenance and SLA context.
      </div>
    );
  }

  const attentionCount = here.reduce((sum, instance) => sum + (instance.attention?.length ?? 0), 0) + events.length;

  return (
    <div className="rounded-lg border border-line bg-panel/75 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-xs uppercase tracking-widest text-accent">{region.id}</div>
          <h3 className="truncate text-lg font-semibold">
            {region.city}, {region.country}
          </h3>
          <div className="mt-1 text-[10px] text-gray-500">
            {region.continent} · {here.length} servers · {attentionCount} attention items
          </div>
        </div>
        <div className={cn("rounded-md border px-2 py-1 text-[10px] font-mono uppercase", statusTone(status?.status))}>
          {status?.status ?? "unknown"}
        </div>
      </div>

      {events.length > 0 && (
        <div className="mt-3 rounded-md border border-accent2/40 bg-accent2/5 p-2 text-[10px] text-accent2">
          {events[0].title} · {events[0].starts_at ?? "start unknown"}
        </div>
      )}

      {here.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-line p-4 text-center text-xs text-gray-500">
          No servers in this zone yet. Ask Atlas to propose a deployment plan.
        </div>
      ) : (
        <ul className="mt-3 max-h-80 space-y-1.5 overflow-auto pr-1 scrollbar-thin">
          {here.map((instance) => {
            const plan = plans.find((item) => item.id === instance.plan);
            const selected = instance.id === selectedInstance;
            const health = instance.health ?? "ok";
            const cpu = instance.cpu;
            const load = instance.load;
            const temp = instance.temp_c;
            return (
              <li
                key={instance.id}
                onClick={() => selectInstance(selected ? null : instance.id)}
                className={cn(
                  "cursor-pointer rounded-md border p-2 transition",
                  selected ? "border-accent2 bg-accent2/10" : "border-line/60 bg-bg/25 hover:border-accent hover:bg-line/30",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs text-gray-100">{instance.label}</div>
                    <div className="text-[10px] text-gray-500">
                      {instance.main_ip} · {instance.status}/{instance.power_status}
                    </div>
                  </div>
                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px]", healthTone[health])}>
                    {health}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                  <span>
                    {instance.vcpu_count} vCPU · {(instance.ram / 1024).toFixed(0)} GB · {plan?.id ?? instance.plan}
                  </span>
                  <span>${plan?.monthly_cost ?? "?"}/mo</span>
                </div>

                <div className="mt-2 grid grid-cols-4 gap-1 text-[10px]">
                  <Metric label="CPU" value={typeof cpu === "number" ? `${cpu.toFixed(0)}%` : "N/A"} barClass={bar(cpu ?? 0, "cpu")} pct={typeof cpu === "number" ? cpu : 0} />
                  <Metric label="LOAD" value={typeof load === "number" ? load.toFixed(1) : "N/A"} barClass="bg-accent" pct={typeof load === "number" ? Math.min(100, load * 25) : 0} />
                  <Metric label="TEMP" value={typeof temp === "number" ? `${temp.toFixed(0)}°C` : "N/A"} barClass={bar(temp ?? 0, "temp")} pct={typeof temp === "number" ? Math.min(100, temp) : 0} />
                  <Metric label="BAND" value={`${instance.bandwidth_gb ?? 0}G`} barClass="bg-accent2" pct={Math.min(100, ((instance.bandwidth_gb ?? 0) / (instance.monthly_bandwidth_gb || 1000)) * 100)} />
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-gray-500">
                  <Pill icon={<Thermometer className="h-3 w-3" />} label="thermal N/A" />
                  <Pill icon={<Network className="h-3 w-3" />} label={instance.server_status} />
                  <Pill icon={<ShieldCheck className="h-3 w-3" />} label={instance.sla_covered ? "SLA" : "GPU best-effort"} />
                </div>

                {(instance.attention?.length ?? 0) > 0 && (
                  <ul className="mt-2 space-y-0.5 text-[10px] text-warn">
                    {instance.attention?.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Metric({ label, value, pct, barClass }: { label: string; value: string; pct: number; barClass: string }) {
  return (
    <div>
      <div className="flex justify-between text-gray-500">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded bg-line">
        <div className={cn("h-full transition-all", barClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1 rounded border border-line/60 bg-bg/40 px-1.5 py-1">
      {icon}
      <span className="truncate">{label}</span>
    </div>
  );
}

function bar(value: number, kind: "cpu" | "temp") {
  if (kind === "temp") {
    if (value > 75) return "bg-danger";
    if (value > 62) return "bg-warn";
    return "bg-ok";
  }
  if (value > 78) return "bg-danger";
  if (value > 55) return "bg-warn";
  return "bg-ok";
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
