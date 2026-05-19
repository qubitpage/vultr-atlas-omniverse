// lib/store.ts
"use client";
import { create } from "zustand";
import type {
  InfrastructureService,
  MaintenanceEvent,
  RegionOperationalStatus,
  SlaPolicy,
  VultrInstance,
  VultrMetalPlan,
  VultrPlan,
  VultrRegion,
} from "./types";

type AgentMessage = { role: "user" | "model"; text: string; ts: number };

export type CartItem = {
  id: string;
  region: string;
  plan: string;
  os_id?: number;
  app_id?: number;
  label: string;
  hostname?: string;
  enable_ipv6: boolean;
  backups: boolean;
  monthly_cost: number;
  added_at: number;
};

export type DeployStatus = { id: string; label: string; status: "pending" | "ok" | "error"; msg?: string };

export type ServiceCategory =
  | "dashboard"
  | "compute"
  | "storage"
  | "network"
  | "orchestration"
  | "marketplace"
  | "help"
  | "quick-deploy";

type AtlasState = {
  regions: VultrRegion[];
  plans: VultrPlan[];
  metalPlans: VultrMetalPlan[];
  instances: VultrInstance[];
  services: InfrastructureService[];
  regionStatus: RegionOperationalStatus[];
  maintenanceEvents: MaintenanceEvent[];
  sla: SlaPolicy | null;
  fetchedAt: string | null;
  apiConnected: boolean;
  apiError: string | null;
  selectedRegion: string | null;
  selectedInstance: string | null;
  // Camera control driven by orchestrator chat or marker clicks.
  cameraTargetRegion: string | null;
  cameraTargetNonce: number;
  autoRotate: boolean;
  // Inline configurator overlay (replaces /atlas/region/[id] route navigation).
  configuratorRegion: string | null;
  // Active service category for the side navigator panel; null = closed.
  activeCategory: ServiceCategory | null;
  // Mobile rail drawer toggle.
  railOpen: boolean;
  cart: CartItem[];
  deployQueue: DeployStatus[];
  chat: AgentMessage[];
  loaded: boolean;
  setData: (
    d: Partial<
      Pick<
        AtlasState,
        | "regions"
        | "plans"
        | "metalPlans"
        | "instances"
        | "services"
        | "regionStatus"
        | "maintenanceEvents"
        | "sla"
        | "fetchedAt"
        | "apiConnected"
        | "apiError"
      >
    >,
  ) => void;
  selectRegion: (r: string | null) => void;
  selectInstance: (i: string | null) => void;
  focusRegion: (r: string | null) => void;
  setAutoRotate: (v: boolean) => void;
  openConfigurator: (r: string | null) => void;
  setActiveCategory: (c: ServiceCategory | null) => void;
  setRailOpen: (v: boolean) => void;
  addToCart: (item: Omit<CartItem, "id" | "added_at">) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  setDeployQueue: (q: DeployStatus[]) => void;
  appendChat: (m: AgentMessage) => void;
  patchLastModel: (delta: string) => void;
};

export const useAtlas = create<AtlasState>((set) => ({
  regions: [],
  plans: [],
  metalPlans: [],
  instances: [],
  services: [],
  regionStatus: [],
  maintenanceEvents: [],
  sla: null,
  fetchedAt: null,
  apiConnected: false,
  apiError: null,
  selectedRegion: null,
  selectedInstance: null,
  cameraTargetRegion: null,
  cameraTargetNonce: 0,
  autoRotate: true,
  configuratorRegion: null,
  activeCategory: null,
  railOpen: false,
  cart: [],
  deployQueue: [],
  chat: [],
  loaded: false,
  setData: (d) => set((s) => ({ ...s, ...d, loaded: true })),
  selectRegion: (r) => set({ selectedRegion: r }),
  selectInstance: (i) => set({ selectedInstance: i }),
  focusRegion: (r) =>
    set((s) => ({
      cameraTargetRegion: r,
      cameraTargetNonce: s.cameraTargetNonce + 1,
      autoRotate: r ? false : s.autoRotate,
      selectedRegion: r ?? s.selectedRegion,
    })),
  setAutoRotate: (v) => set({ autoRotate: v }),
  openConfigurator: (r) =>
    set((s) => ({
      configuratorRegion: r,
      activeCategory: r ? null : s.activeCategory,
      selectedRegion: r ?? s.selectedRegion,
      cameraTargetRegion: r ?? s.cameraTargetRegion,
      cameraTargetNonce: r ? s.cameraTargetNonce + 1 : s.cameraTargetNonce,
      autoRotate: r ? false : s.autoRotate,
    })),
  setActiveCategory: (c) => set((s) => ({ activeCategory: c, configuratorRegion: c ? null : s.configuratorRegion })),
  setRailOpen: (v) => set({ railOpen: v }),
  addToCart: (item) =>
    set((s) => ({
      cart: [
        ...s.cart,
        { ...item, id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, added_at: Date.now() },
      ],
    })),
  removeFromCart: (id) => set((s) => ({ cart: s.cart.filter((c) => c.id !== id) })),
  clearCart: () => set({ cart: [], deployQueue: [] }),
  setDeployQueue: (q) => set({ deployQueue: q }),
  appendChat: (m) => set((s) => ({ chat: [...s.chat, m] })),
  patchLastModel: (delta) =>
    set((s) => {
      const arr = [...s.chat];
      const last = arr[arr.length - 1];
      if (last && last.role === "model") {
        arr[arr.length - 1] = { ...last, text: last.text + delta };
      }
      return { chat: arr };
    }),
}));
