// lib/types.ts
export type VultrRegion = {
  id: string;
  city: string;
  country: string;
  continent: string;
  options: string[];
};

export type VultrPlan = {
  id: string;
  vcpu_count: number;
  ram: number; // MB
  disk: number; // GB
  bandwidth: number; // GB
  monthly_cost: number;
  hourly_cost?: number;
  type: string;
  locations: string[];
  gpu_vram_gb?: number;
  gpu_type?: string;
  disk_count?: number;
};

export type VultrMetalPlan = {
  id: string;
  cpu_count: number;
  cpu_model: string;
  cpu_threads?: number;
  ram: number;
  disk: number;
  bandwidth: number;
  monthly_cost: number;
  hourly_cost?: number;
  type: string;
  locations: string[];
  gpu_vram_gb?: number;
  gpu_type?: string;
};

export type VultrOs = {
  id: number;
  name: string;
  arch: string;
  family: string;
};

export type VultrApplication = {
  id: number;
  name: string;
  short_name: string;
  deploy_name: string;
  type: string;
  vendor?: string;
  image_id?: string;
};

export type VultrInferenceSub = {
  id: string;
  date_created?: string;
  label?: string;
  api_key?: string;
  usage?: { chat_tokens?: number; audio_seconds?: number };
};

export type VultrInstance = {
  id: string;
  os: string;
  ram: number;
  disk: number;
  main_ip: string;
  vcpu_count: number;
  region: string;
  plan: string;
  status: string;
  power_status: string;
  server_status: string;
  label: string;
  tag: string;
  date_created: string;
  // Vultr API does not expose guest CPU or physical host temperature.
  // These remain undefined unless a future guest telemetry agent supplies them.
  cpu?: number;
  load?: number;
  temp_c?: number;
  bandwidth_gb?: number;
  monthly_bandwidth_gb?: number;
  health?: "ok" | "watch" | "degraded" | "maintenance";
  attention?: string[];
  sla_covered?: boolean;
  rack?: string;
  slot?: number;
};

export type RegionOperationalStatus = {
  region_id: string;
  city: string;
  country?: string;
  status: "ok" | "planned" | "degraded" | "resolved" | "unknown";
  priority: "low" | "normal" | "high";
  notifications: number;
  source: "vultr-status" | "derived";
  last_checked: string;
};

export type MaintenanceEvent = {
  id: string;
  region_id?: string;
  city: string;
  title: string;
  event_type: string;
  status: "planned" | "active" | "resolved" | "unknown";
  starts_at?: string;
  ends_at?: string;
  created_at?: string;
  impact: "low" | "normal" | "high";
  summary: string;
};

export type InfrastructureService = {
  id: string;
  kind:
    | "instance"
    | "load_balancer"
    | "database"
    | "kubernetes"
    | "block_storage"
    | "object_storage"
    | "firewall"
    | "reserved_ip"
    | "vpc"
    | "snapshot"
    | "dns_domain"
    | "container_registry"
    | "serverless_inference"
    | "unknown";
  label: string;
  region?: string;
  status?: string;
  health: "ok" | "watch" | "degraded" | "maintenance";
  endpoint?: string;
  monthly_cost?: number;
  attention: string[];
  raw?: Record<string, unknown>;
};

export type SlaPolicy = {
  title: string;
  uptime_guarantee: string;
  scope: string;
  exclusions: string[];
  credits: { outage: string; credit: string }[];
  requires_ticket: boolean;
  source_url: string;
};

export type FleetSnapshot = {
  apiConnected: boolean;
  apiError?: string;
  regions: VultrRegion[];
  plans: VultrPlan[];
  metalPlans: VultrMetalPlan[];
  instances: VultrInstance[];
  services: InfrastructureService[];
  regionStatus: RegionOperationalStatus[];
  maintenanceEvents: MaintenanceEvent[];
  sla: SlaPolicy;
  fetchedAt: string;
};

export type CatalogSnapshot = {
  apiConnected: boolean;
  apiError?: string;
  os: VultrOs[];
  applications: VultrApplication[];
  plans: VultrPlan[];
  metalPlans: VultrMetalPlan[];
  regions: VultrRegion[];
  fetchedAt: string;
};

export type RegionGeo = {
  id: string;
  lat: number;
  lon: number;
};

export type RecommendationInput = {
  intent: string;
  workload: "web" | "api" | "db" | "worker" | "ml" | "static";
  rps?: number;
  storage_gb?: number;
  ram_gb_min?: number;
  vcpu_min?: number;
  region_hint?: string;
  budget_monthly?: number;
};

export type RecommendationPick = {
  plan_id: string;
  region_id: string;
  monthly_cost: number;
  rationale: string;
  score: number;
};

export type AgentAction =
  | { kind: "create_instance"; region: string; plan: string; os_id: number; label: string }
  | { kind: "destroy_instance"; id: string }
  | { kind: "reboot_instance"; id: string }
  | { kind: "resize_instance"; id: string; plan: string }
  | { kind: "no_op"; reason: string };

export type AgentProposal = {
  summary: string;
  reasoning: string;
  actions: AgentAction[];
  requires_human_approval: true;
};
