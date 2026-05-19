// lib/vultr.ts
// Server-only Vultr API client + real fleet snapshot enrichment.
import type {
  CatalogSnapshot,
  FleetSnapshot,
  InfrastructureService,
  MaintenanceEvent,
  RegionOperationalStatus,
  SlaPolicy,
  VultrApplication,
  VultrInferenceSub,
  VultrInstance,
  VultrMetalPlan,
  VultrOs,
  VultrPlan,
  VultrRegion,
} from "./types";

const BASE = "https://api.vultr.com/v2";
const STATUS_URL = "https://status.vultr.com/";

function apiKey(): string | null {
  const value = process.env.VULTR_API_KEY?.trim();
  return value ? value : null;
}

function requireApiKey(): string {
  const value = apiKey();
  if (!value) throw new Error("VULTR_API_KEY is not set; Atlas cannot show account infrastructure without it.");
  return value;
}

// Typed error so the route handler can map upstream HTTP status (404/409/etc.)
// instead of always returning a generic 500.
export class VultrApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly body: string;
  constructor(status: number, path: string, body: string) {
    super(`vultr ${status} ${path}: ${body.slice(0, 300)}`);
    this.name = "VultrApiError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

async function vultrFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new VultrApiError(res.status, path, body);
  }
  // DELETE/204 endpoints return empty body; guard JSON parse.
  if (res.status === 204) return undefined as unknown as T;
  const text = await res.text();
  if (!text) return undefined as unknown as T;
  try { return JSON.parse(text) as T; } catch { return undefined as unknown as T; }
}

async function safeVultrFetch<T>(path: string): Promise<T | null> {
  try {
    return await vultrFetch<T>(path);
  } catch {
    return null;
  }
}

async function instanceBandwidthGb(instanceId: string): Promise<number | undefined> {
  const data = await safeVultrFetch<{ bandwidth?: Record<string, { incoming_bytes?: number; outgoing_bytes?: number }> }>(
    `/instances/${instanceId}/bandwidth`,
  );
  const days = Object.values(data?.bandwidth ?? {});
  if (!days.length) return undefined;
  const bytes = days.reduce((sum, day) => sum + (day.incoming_bytes ?? 0) + (day.outgoing_bytes ?? 0), 0);
  return Number((bytes / 1024 / 1024 / 1024).toFixed(2));
}

async function enrichInstance(instance: VultrInstance, plan?: VultrPlan): Promise<VultrInstance> {
  const bandwidth_gb = await instanceBandwidthGb(instance.id);
  const monthly_bandwidth_gb = plan?.bandwidth ?? undefined;
  const attention: string[] = [];
  let health: VultrInstance["health"] = "ok";

  if (instance.status !== "active") attention.push(`status is ${instance.status}`);
  if (instance.power_status !== "running") attention.push(`power is ${instance.power_status}`);
  if (instance.server_status !== "ok") attention.push(`server status is ${instance.server_status}`);
  if (monthly_bandwidth_gb && typeof bandwidth_gb === "number" && bandwidth_gb > monthly_bandwidth_gb * 0.75) attention.push("bandwidth usage nearing monthly plan allowance");

  if (attention.some((item) => /status|power|server/.test(item))) health = "degraded";
  else if (attention.length) health = "watch";

  return {
    ...instance,
    bandwidth_gb,
    monthly_bandwidth_gb,
    attention,
    health,
    sla_covered: !plan?.type.includes("vcg"),
  };
}

function serviceHealth(status?: string): InfrastructureService["health"] {
  const value = (status ?? "").toLowerCase();
  if (!value) return "ok";
  if (/running|active|ok|available|ready|enabled|attached/.test(value)) return "ok";
  if (/pending|new|installing|creating|maintenance|updating|migrating|upgrading/.test(value)) return "watch";
  return "degraded";
}

function serviceFromRaw(kind: InfrastructureService["kind"], raw: Record<string, unknown>, index: number): InfrastructureService {
  const id = String(raw.id ?? raw.ID ?? raw.name ?? `${kind}-${index}`);
  const label = String(raw.label ?? raw.name ?? raw.hostname ?? raw.description ?? id);
  const region = String(raw.region ?? raw.location ?? raw.region_id ?? "").toLowerCase() || undefined;
  const status = String(raw.status ?? raw.state ?? raw.power_status ?? "");
  const health = serviceHealth(status);
  return {
    id,
    kind,
    label,
    region,
    status,
    health,
    endpoint: typeof raw.ipv4 === "string" ? raw.ipv4 : typeof raw.hostname === "string" ? raw.hostname : undefined,
    attention: health === "degraded" ? [`${kind.replace(/_/g, " ")} state: ${status || "unknown"}`] : [],
    raw,
  };
}

async function listInfrastructureServices(): Promise<InfrastructureService[]> {
  const requests: Array<{ path: string; key: string; kind: InfrastructureService["kind"] }> = [
    { path: "/load-balancers?per_page=500", key: "load_balancers", kind: "load_balancer" },
    { path: "/databases?per_page=500", key: "databases", kind: "database" },
    { path: "/kubernetes/clusters?per_page=500", key: "vke_clusters", kind: "kubernetes" },
    { path: "/blocks?per_page=500", key: "blocks", kind: "block_storage" },
    { path: "/object-storage?per_page=500", key: "object_storages", kind: "object_storage" },
    { path: "/firewalls?per_page=500", key: "firewall_groups", kind: "firewall" },
    { path: "/reserved-ips?per_page=500", key: "reserved_ips", kind: "reserved_ip" },
    { path: "/vpcs?per_page=500", key: "vpcs", kind: "vpc" },
    { path: "/snapshots?per_page=500", key: "snapshots", kind: "snapshot" },
    { path: "/dns/domains?per_page=500", key: "domains", kind: "dns_domain" },
    { path: "/container-registry?per_page=500", key: "registries", kind: "container_registry" },
    { path: "/inference", key: "subscriptions", kind: "serverless_inference" },
  ];
  const services: InfrastructureService[] = [];
  await Promise.all(
    requests.map(async ({ path, key: responseKey, kind }) => {
      const data = await safeVultrFetch<Record<string, unknown>>(path);
      const list = data?.[responseKey];
      if (!Array.isArray(list)) return;
      list.forEach((raw, index) => {
        if (raw && typeof raw === "object") services.push(serviceFromRaw(kind, raw as Record<string, unknown>, index));
      });
    }),
  );
  return services;
}

function normalizeStatusText(text: string): RegionOperationalStatus["status"] {
  if (/planned service|scheduled maintenance/i.test(text)) return "planned";
  if (/degraded|outage|issue|unreachable|incident/i.test(text)) return "degraded";
  if (/completed|resolved/i.test(text)) return "resolved";
  if (/\bOK\b/i.test(text)) return "ok";
  return "unknown";
}

async function fetchStatusPage(): Promise<string> {
  const res = await fetch(STATUS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`status page ${res.status}`);
  return await res.text();
}

async function listRegionStatus(regions: VultrRegion[]): Promise<RegionOperationalStatus[]> {
  const checked = new Date().toISOString();
  try {
    const html = await fetchStatusPage();
    const haystack = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    return regions.map((region) => {
      const index = haystack.toLowerCase().indexOf(`${region.city.toLowerCase()} -`);
      const segment = index >= 0 ? haystack.slice(index, index + 900) : "";
      const status = normalizeStatusText(segment);
      const notifications = Number(segment.match(/Notifications?\s+(\d+)/i)?.[1] ?? 0);
      const priority = /High/i.test(segment) ? "high" : /Low/i.test(segment) ? "low" : "normal";
      return {
        region_id: region.id,
        city: region.city,
        country: region.country,
        status,
        priority,
        notifications,
        source: "vultr-status",
        last_checked: checked,
      } satisfies RegionOperationalStatus;
    });
  } catch {
    return regions.map((region) => ({
      region_id: region.id,
      city: region.city,
      country: region.country,
      status: "unknown",
      priority: "normal",
      notifications: 0,
      source: "derived",
      last_checked: checked,
    }));
  }
}

async function listMaintenanceEvents(regions: VultrRegion[]): Promise<MaintenanceEvent[]> {
  try {
    const html = await fetchStatusPage();
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    const events: MaintenanceEvent[] = [];
    const regex = /([A-Za-z ,]+?) Scheduled Maintenance - (\d{4}-\d{2}-\d{2}) - (ALRT-[A-Z0-9]+)(.{0,1000}?)(?=\s+[A-Z][A-Za-z ,]+ Scheduled Maintenance|\s+Products\s+|$)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) && events.length < 30) {
      const city = match[1].trim();
      const region = regions.find((item) => city.toLowerCase().includes(item.city.toLowerCase()));
      const body = match[4];
      const starts = body.match(/Start Time:\s*([0-9:\- ]+UTC)/i)?.[1];
      const ends = body.match(/End Time:\s*([0-9:\- ]+UTC)/i)?.[1];
      events.push({
        id: match[3],
        region_id: region?.id,
        city,
        title: `${city} Scheduled Maintenance`,
        event_type: body.match(/Event Type:\s*([^\.]+?)(?:We are|Start Time|$)/i)?.[1]?.trim() ?? "Network Upgrade",
        status: /completed|resolved/i.test(body) ? "resolved" : "planned",
        starts_at: starts,
        ends_at: ends,
        impact: /unreachable|network|firmware|host upgrades/i.test(body) ? "high" : "normal",
        summary: body.slice(0, 340).trim(),
      });
    }
    return events;
  } catch {
    return [];
  }
}

export function slaPolicy(): SlaPolicy {
  return {
    title: "Vultr SLA overview",
    uptime_guarantee: "100% uptime guarantee for network and host-node availability",
    scope: "Applied per service item; does not apply to customer software, OS, misconfiguration, control panel/API/DNS availability, or Cloud GPU under the standard SLA.",
    exclusions: [
      "Scheduled maintenance with at least 24h notice, unless outage or packet loss exceeds 10 minutes",
      "Customer-side software, operating system, firewall or configuration failures",
      "Cloud GPU is excluded from the standard SLA and handled on a best-effort downtime refund basis",
      "Credits require a support ticket and explicit credit request",
    ],
    credits: [
      { outage: "Less than 9 minutes", credit: "12 hours" },
      { outage: "10-59 minutes", credit: "24 hours" },
      { outage: "60-119 minutes", credit: "48 hours" },
      { outage: "120-239 minutes", credit: "120 hours" },
      { outage: "240-419 minutes", credit: "240 hours" },
      { outage: "420+ minutes", credit: "672 hours / 1 month" },
    ],
    requires_ticket: true,
    source_url: "https://www.vultr.com/legal/sla/",
  };
}

export async function listRegions(): Promise<VultrRegion[]> {
  const data = await vultrFetch<{ regions: VultrRegion[] }>("/regions");
  return data.regions;
}

export async function listPlans(): Promise<VultrPlan[]> {
  const data = await vultrFetch<{ plans: VultrPlan[] }>("/plans?per_page=500");
  return data.plans;
}

export async function listMetalPlans(): Promise<VultrMetalPlan[]> {
  const data = await safeVultrFetch<{ plans_metal: VultrMetalPlan[] }>("/plans-metal?per_page=500");
  return data?.plans_metal ?? [];
}

export async function listOs(): Promise<VultrOs[]> {
  const data = await safeVultrFetch<{ os: VultrOs[] }>("/os?per_page=500");
  return data?.os ?? [];
}

export async function listApplications(): Promise<VultrApplication[]> {
  const data = await safeVultrFetch<{ applications: VultrApplication[] }>("/applications?per_page=500");
  return data?.applications ?? [];
}

export async function listInferenceSubs(): Promise<VultrInferenceSub[]> {
  // Account-scoped inference subscriptions; absent on accounts without inference.
  const data = await safeVultrFetch<{ subscriptions?: VultrInferenceSub[] }>("/inference");
  return data?.subscriptions ?? [];
}

export async function catalogSnapshot(): Promise<CatalogSnapshot> {
  if (!apiKey()) {
    return {
      apiConnected: false,
      apiError: "VULTR_API_KEY is not configured.",
      os: [],
      applications: [],
      plans: [],
      metalPlans: [],
      regions: [],
      fetchedAt: new Date().toISOString(),
    };
  }
  const [os, applications, plans, metalPlans, regions] = await Promise.all([
    listOs(),
    listApplications(),
    listPlans(),
    listMetalPlans(),
    listRegions(),
  ]);
  return { apiConnected: true, os, applications, plans, metalPlans, regions, fetchedAt: new Date().toISOString() };
}

export async function listInstances(): Promise<VultrInstance[]> {
  const [instancesData, plans] = await Promise.all([
    vultrFetch<{ instances: VultrInstance[] }>("/instances?per_page=500"),
    listPlans().catch(() => [] as VultrPlan[]),
  ]);
  return Promise.all(instancesData.instances.map((instance) => enrichInstance(instance, plans.find((plan) => plan.id === instance.plan))));
}

export async function fleetSnapshot(): Promise<FleetSnapshot> {
  if (!apiKey()) {
    return {
      apiConnected: false,
      apiError: "VULTR_API_KEY is not configured. Account infrastructure is intentionally hidden until a real Vultr API token is connected.",
      regions: [],
      plans: [],
      metalPlans: [],
      instances: [],
      services: [],
      regionStatus: [],
      maintenanceEvents: await listMaintenanceEvents([]),
      sla: slaPolicy(),
      fetchedAt: new Date().toISOString(),
    };
  }

  const [regions, plans, metalPlans, instances, services] = await Promise.all([listRegions(), listPlans(), listMetalPlans(), listInstances(), listInfrastructureServices()]);
  const [regionStatus, maintenanceEvents] = await Promise.all([
    listRegionStatus(regions),
    listMaintenanceEvents(regions),
  ]);
  return {
    apiConnected: true,
    regions,
    plans,
    metalPlans,
    instances,
    services: [
      ...instances.map((instance) => ({
        id: instance.id,
        kind: "instance" as const,
        label: instance.label,
        region: instance.region,
        status: instance.status,
        health: instance.health ?? "ok",
        endpoint: instance.main_ip,
        attention: instance.attention ?? [],
      })),
      ...services,
    ],
    regionStatus,
    maintenanceEvents,
    sla: slaPolicy(),
    fetchedAt: new Date().toISOString(),
  };
}

export async function createInstance(input: {
  region: string;
  plan: string;
  os_id?: number;
  app_id?: number;
  image_id?: string;
  snapshot_id?: string;
  iso_id?: string;
  label?: string;
  hostname?: string;
  enable_ipv6?: boolean;
  backups?: "enabled" | "disabled";
  ddos_protection?: boolean;
  sshkey_id?: string[];
  user_data?: string;
  tags?: string[];
}): Promise<VultrInstance> {
  // Strip undefined keys so Vultr doesn't reject the payload.
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== "") payload[key] = value;
  }
  const data = await vultrFetch<{ instance: VultrInstance }>("/instances", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.instance;
}

export async function destroyInstance(id: string): Promise<void> {
  await vultrFetch(`/instances/${id}`, { method: "DELETE" });
}

export async function rebootInstance(id: string): Promise<void> {
  await vultrFetch(`/instances/${id}/reboot`, { method: "POST" });
}

export async function startInstance(id: string): Promise<void> {
  await vultrFetch(`/instances/${id}/start`, { method: "POST" });
}
export async function stopInstance(id: string): Promise<void> {
  await vultrFetch(`/instances/${id}/halt`, { method: "POST" });
}

// Generic delete dispatcher for non-instance services. The mapping mirrors
// kinds emitted by listInfrastructureServices() and the InfrastructureService
// type. Each branch hits the documented Vultr v2 DELETE endpoint.
const SERVICE_PATH: Record<string, (id: string) => string> = {
  instance: (id) => `/instances/${id}`,
  load_balancer: (id) => `/load-balancers/${id}`,
  database: (id) => `/databases/${id}`,
  kubernetes: (id) => `/kubernetes/clusters/${id}`,
  block_storage: (id) => `/blocks/${id}`,
  object_storage: (id) => `/object-storage/${id}`,
  firewall: (id) => `/firewalls/${id}`,
  reserved_ip: (id) => `/reserved-ips/${id}`,
  vpc: (id) => `/vpcs/${id}`,
  snapshot: (id) => `/snapshots/${id}`,
  dns_domain: (id) => `/domains/${id}`,
  container_registry: (id) => `/registries/${id}`,
  serverless_inference: (id) => `/inference/${id}`,
};
export async function destroyService(kind: string, id: string): Promise<void> {
  const make = SERVICE_PATH[kind];
  if (!make) throw new Error(`Unsupported service kind for delete: ${kind}`);
  await vultrFetch(make(id), { method: "DELETE" });
}

// --- Serverless Inference ---------------------------------------------------
export async function createInference(input: { label: string }): Promise<VultrInferenceSub> {
  const data = await vultrFetch<{ subscription: VultrInferenceSub }>("/inference", {
    method: "POST",
    body: JSON.stringify({ label: input.label }),
  });
  return data.subscription;
}
