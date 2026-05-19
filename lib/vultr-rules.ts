// lib/vultr-rules.ts — Real Vultr availability rules + capacity aggregation.
import type { VultrApplication, VultrInstance, VultrMetalPlan, VultrOs, VultrPlan } from "./types";
import type { CartItem } from "./store";

// ---------- Plan family ----------
export type PlanFamily = "vc2" | "vhf" | "vhp" | "voc" | "vbm" | "vcg" | "vdc" | "other";

export function planFamily(type: string | undefined): PlanFamily {
  const f = (type ?? "").split("-")[0]?.toLowerCase() ?? "";
  if (["vc2", "vhf", "vhp", "voc", "vbm", "vcg", "vdc"].includes(f)) return f as PlanFamily;
  return "other";
}

export function isMetal(plan: VultrPlan | VultrMetalPlan): boolean {
  return planFamily(plan.type) === "vbm";
}
export function isGpu(plan: VultrPlan | VultrMetalPlan): boolean {
  return planFamily(plan.type) === "vcg" || !!plan.gpu_vram_gb || !!plan.gpu_type;
}
export function planVcpu(plan: VultrPlan | VultrMetalPlan): number {
  return "vcpu_count" in plan ? plan.vcpu_count : (plan as VultrMetalPlan).cpu_count;
}

// ---------- OS / app compatibility ----------
// Source: Vultr public docs + API limits.
// - Windows Server requires ≥ 2 GB RAM and ≥ 60 GB disk.
// - Custom ISO and snapshots require ≥ 1 GB RAM.
// - GPU plans support only Linux distros + select Windows.
// - Bare metal allows any OS but no apps marketplace.
// - Cloud GPU (vcg) does NOT support Windows.
// - cPanel / Plesk apps need ≥ 4 GB RAM.

export function isOsRegion(plan: VultrPlan | VultrMetalPlan, regionId: string): boolean {
  return (plan.locations ?? []).includes(regionId);
}

export function osBlockReason(plan: VultrPlan | VultrMetalPlan, os: VultrOs): string | null {
  const isWindows = /windows/i.test(`${os.family} ${os.name}`);
  if (isWindows) {
    if (plan.ram < 2048) return "Windows needs ≥ 2 GB RAM";
    if (plan.disk < 60) return "Windows needs ≥ 60 GB disk";
    if (planFamily(plan.type) === "vcg") return "Cloud GPU plans don't support Windows";
  }
  // Vultr enforces a 1000 MB minimum for the modern 64-bit Linux distros
  // (Ubuntu 22.04+, Debian 12+, Rocky 9, Alma 9, Fedora 38+).
  const isHeavyLinux = /ubuntu 22|ubuntu 24|debian 12|rocky linux 9|almalinux 9|fedora (3[8-9]|4[0-9])/i
    .test(`${os.family} ${os.name}`);
  if (isHeavyLinux && plan.ram < 1024) return `${os.name} needs ≥ 1 GB RAM`;
  if (os.arch === "x64" && /arm/i.test(plan.type)) return "OS arch x64 incompatible with ARM plan";
  return null;
}

export function appBlockReason(plan: VultrPlan | VultrMetalPlan, app: VultrApplication): string | null {
  if (isMetal(plan)) return "Bare metal does not support marketplace apps";
  if (/cpanel|plesk/i.test(app.short_name + " " + app.deploy_name) && plan.ram < 4096)
    return `${app.short_name} needs ≥ 4 GB RAM`;
  if (/windows/i.test(app.short_name) && plan.ram < 2048) return "Windows-based app needs ≥ 2 GB RAM";
  if (/(plesk|wordpress|nextcloud|gitlab)/i.test(app.short_name) && plan.disk < 25)
    return `${app.short_name} needs ≥ 25 GB disk`;
  return null;
}

export function osDisabledReason(
  plan: VultrPlan | VultrMetalPlan | null | undefined,
  os: VultrOs,
): string | null {
  if (!plan) return null;
  return osBlockReason(plan, os);
}

// ---------- Fleet capacity ----------
export type Capacity = {
  vcpu: number;
  ramGb: number;
  diskGb: number;
  bandwidthGb: number;
  monthlyCost: number;
  count: number;
};
export function aggregateCapacity(instances: VultrInstance[], plans: VultrPlan[]): Capacity {
  let vcpu = 0, ramGb = 0, diskGb = 0, bandwidthGb = 0, monthlyCost = 0;
  for (const i of instances) {
    vcpu += i.vcpu_count ?? 0;
    ramGb += (i.ram ?? 0) / 1024;
    diskGb += i.disk ?? 0;
    const p = plans.find((pp) => pp.id === i.plan);
    if (p) {
      bandwidthGb += (p.bandwidth ?? 0) * 1024; // bandwidth is TB; convert to GB
      monthlyCost += p.monthly_cost ?? 0;
    }
  }
  return {
    vcpu,
    ramGb: Math.round(ramGb),
    diskGb: Math.round(diskGb),
    bandwidthGb: Math.round(bandwidthGb),
    monthlyCost: Math.round(monthlyCost * 100) / 100,
    count: instances.length,
  };
}
export function cartCapacity(cart: CartItem[], plans: VultrPlan[]): Capacity {
  let vcpu = 0, ramGb = 0, diskGb = 0, bandwidthGb = 0, monthlyCost = 0;
  for (const c of cart) {
    const p = plans.find((pp) => pp.id === c.plan);
    if (p) {
      vcpu += p.vcpu_count;
      ramGb += p.ram / 1024;
      diskGb += p.disk;
      bandwidthGb += p.bandwidth * 1024;
      monthlyCost += p.monthly_cost;
    }
  }
  return {
    vcpu,
    ramGb: Math.round(ramGb),
    diskGb: Math.round(diskGb),
    bandwidthGb: Math.round(bandwidthGb),
    monthlyCost: Math.round(monthlyCost * 100) / 100,
    count: cart.length,
  };
}

export function fmtBytes(gb: number): string {
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
  return `${gb} GB`;
}

// ---------- Service category mapping ----------
export type ServiceCategory =
  | "dashboard"
  | "compute"
  | "storage"
  | "network"
  | "orchestration"
  | "marketplace"
  | "help"
  | "quick-deploy";

export function categoryForServiceKind(kind: string): ServiceCategory {
  switch (kind) {
    case "instance":
      return "compute";
    case "block_storage":
    case "object_storage":
    case "snapshot":
      return "storage";
    case "load_balancer":
    case "firewall":
    case "reserved_ip":
    case "vpc":
    case "dns_domain":
      return "network";
    case "kubernetes":
    case "database":
    case "container_registry":
    case "serverless_inference":
      return "orchestration";
    default:
      return "compute";
  }
}
