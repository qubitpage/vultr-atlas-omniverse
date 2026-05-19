"use client";
import { useEffect } from "react";
import { useAtlas, type DeployStatus } from "@/lib/store";

/**
 * Cross-frame bridge so the embedded VS Code / Copilot Chat iframe can drive
 * the Atlas cockpit. The iframe is same-origin (https://atlas.qubitpage.com/code)
 * so window.postMessage works without origin restrictions.
 *
 * Supported messages (all from iframe -> parent):
 *   { type: "atlas:focus", region: "fra" }
 *   { type: "atlas:open-region", region: "fra" }
 *   { type: "atlas:close-region" }
 *   { type: "atlas:autorotate", on: true | false }
 *   { type: "atlas:add-to-cart", region, plan, os_id?, app_id?, label?, hostname?, enable_ipv6?, backups?, monthly_cost? }
 *   { type: "atlas:clear-cart" }
 *   { type: "atlas:deploy-cart" }
 *   { type: "atlas:get-state" }     -> replies on the source window with { type: "atlas:state", ... }
 *
 * Parent -> iframe broadcasts on state change (best-effort):
 *   { type: "atlas:state", cart, deployQueue, regions, instances, selectedRegion }
 */
export function CopilotBridge() {
  const store = useAtlas;

  useEffect(() => {
    function broadcast(target?: MessageEventSource | null) {
      const s = store.getState();
      const payload = {
        type: "atlas:state",
        selectedRegion: s.selectedRegion,
        configuratorRegion: s.configuratorRegion,
        cart: s.cart,
        deployQueue: s.deployQueue,
        regions: s.regions.map((r) => ({ id: r.id, city: r.city, country: r.country })),
        instances: s.instances.map((i) => ({ id: i.id, label: i.label, region: i.region, plan: i.plan })),
      };
      try {
        if (target && "postMessage" in target) {
          (target as Window).postMessage(payload, "*");
        } else {
          // broadcast to all same-origin frames
          document.querySelectorAll("iframe").forEach((f) => {
            try { f.contentWindow?.postMessage(payload, "*"); } catch {/*ignore*/}
          });
        }
      } catch {/*ignore*/}
    }

    async function onMessage(e: MessageEvent) {
      const data = e?.data;
      if (!data || typeof data !== "object" || typeof data.type !== "string") return;
      if (!data.type.startsWith("atlas:")) return;

      const s = store.getState();
      switch (data.type) {
        case "atlas:focus":
          if (typeof data.region === "string") s.focusRegion(data.region);
          break;
        case "atlas:open-region":
          if (typeof data.region === "string") s.openConfigurator(data.region);
          break;
        case "atlas:close-region":
          s.openConfigurator(null);
          break;
        case "atlas:autorotate":
          s.setAutoRotate(!!data.on);
          break;
        case "atlas:add-to-cart": {
          if (!data.region || !data.plan) return;
          s.addToCart({
            region: data.region,
            plan: data.plan,
            os_id: data.os_id,
            app_id: data.app_id,
            label: data.label ?? "atlas-instance",
            hostname: data.hostname,
            enable_ipv6: data.enable_ipv6 ?? true,
            backups: !!data.backups,
            monthly_cost: data.monthly_cost ?? 0,
          });
          break;
        }
        case "atlas:clear-cart":
          s.clearCart();
          break;
        case "atlas:deploy-cart": {
          const cart = s.cart;
          if (cart.length === 0) return;
          const queue: DeployStatus[] = cart.map((c) => ({ id: c.id, label: c.label, status: "pending" }));
          s.setDeployQueue(queue);
          for (let i = 0; i < cart.length; i++) {
            const c = cart[i];
            try {
              const r = await fetch("/api/vultr", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  action: "create_instance",
                  region: c.region,
                  plan: c.plan,
                  os_id: c.os_id,
                  app_id: c.app_id,
                  label: c.label,
                  hostname: c.hostname,
                  enable_ipv6: c.enable_ipv6,
                  backups: c.backups ? "enabled" : "disabled",
                }),
              });
              const j = await r.json();
              queue[i] = { id: c.id, label: c.label, status: j.ok ? "ok" : "error", msg: j.ok ? j.instance?.id : (j.error ?? "failed") };
            } catch (err: any) {
              queue[i] = { id: c.id, label: c.label, status: "error", msg: err?.message ?? String(err) };
            }
            s.setDeployQueue([...queue]);
          }
          break;
        }
        case "atlas:get-state":
          broadcast(e.source);
          return;
      }
      // After any state-mutating command, push fresh state to the source frame.
      broadcast(e.source);
    }

    window.addEventListener("message", onMessage);
    // Push state periodically so the iframe can detect cockpit changes.
    const unsub = store.subscribe(() => broadcast());
    return () => {
      window.removeEventListener("message", onMessage);
      unsub();
    };
  }, [store]);

  return null;
}
