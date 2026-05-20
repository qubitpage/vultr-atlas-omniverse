"use client";
import { useState } from "react";
import { ShoppingCart, X, Loader2, Check, AlertTriangle, Trash2 } from "lucide-react";
import { useAtlas, type DeployStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

export function CartPanel() {
  const cart = useAtlas((s) => s.cart);
  const removeFromCart = useAtlas((s) => s.removeFromCart);
  const clearCart = useAtlas((s) => s.clearCart);
  const deployQueue = useAtlas((s) => s.deployQueue);
  const setDeployQueue = useAtlas((s) => s.setDeployQueue);
  const [open, setOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const total = cart.reduce((a, c) => a + (c.monthly_cost || 0), 0);

  async function deployAll() {
    if (cart.length === 0 || deploying) return;
    setDeploying(true);
    const queue: DeployStatus[] = cart.map((c) => ({ id: c.id, label: c.label, status: "pending" }));
    setDeployQueue(queue);
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
      } catch (e: any) {
        queue[i] = { id: c.id, label: c.label, status: "error", msg: e?.message ?? String(e) };
      }
      setDeployQueue([...queue]);
    }
    setDeploying(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex items-center gap-1.5 rounded-md border bg-panel/80 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest backdrop-blur",
          cart.length > 0 ? "border-accent/60 text-accent shadow-glow" : "border-line text-gray-400 hover:border-line/80 hover:text-gray-200",
        )}
        title="Cart"
      >
        <ShoppingCart className="h-3 w-3" />
        cart · {cart.length}
        {cart.length > 0 && <span className="text-gray-400">· ${total}/mo</span>}
      </button>

      {open && (
        <>
          {/* Backdrop so the cart isn't lost behind globe + topbar metrics when deploying. */}
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-bg/60 backdrop-blur-sm"
          />
          <div className="fixed inset-x-2 bottom-2 top-14 z-50 flex w-auto flex-col rounded-lg border border-accent/40 bg-panel/95 p-3 shadow-glow backdrop-blur sm:bottom-auto sm:left-auto sm:right-4 sm:top-16 sm:max-h-[calc(100dvh-5rem)] sm:w-[min(520px,calc(100vw-2rem))] sm:p-4">
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-accent" />
                <div className="font-mono text-xs uppercase tracking-widest text-accent">Provisioning cart</div>
                <span className="rounded-full border border-line bg-bg/60 px-2 py-0.5 font-mono text-[10px] text-gray-400">
                  {cart.length} item{cart.length === 1 ? "" : "s"}
                </span>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-200"><X className="h-4 w-4" /></button>
            </div>
            {cart.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-500">
                Empty. Click a region on the globe, configure a server, and press <span className="text-accent">Add to cart</span>.
                <div className="mt-2 text-[10px] text-gray-600">Copilot can also add items via <span className="font-mono text-gray-400">atlas:add-to-cart</span>.</div>
              </div>
            ) : (
              <>
                <div className="mt-3 flex-1 space-y-2 overflow-auto pr-1">
                  {cart.map((c) => {
                    const st = deployQueue.find((q) => q.id === c.id);
                    return (
                      <div key={c.id} className="rounded border border-line/60 bg-bg/40 p-3 text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-gray-100">{c.label}</div>
                            <div className="mt-1 font-mono text-[10px] text-gray-500">
                              {c.region} · {c.plan}
                              {typeof c.os_id === "number" ? ` · os ${c.os_id}` : ""}
                              {typeof c.app_id === "number" ? ` · app ${c.app_id}` : ""}
                              {c.backups ? " · backups" : ""}
                              {c.enable_ipv6 ? " · ipv6" : ""}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-sm text-accent">${c.monthly_cost}/mo</div>
                            {!deploying && !st && (
                              <button onClick={() => removeFromCart(c.id)} className="mt-1 text-gray-500 hover:text-danger" title="Remove">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        {st && (
                          <div className={cn(
                            "mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest",
                            st.status === "pending" && "text-gray-400",
                            st.status === "ok" && "text-ok",
                            st.status === "error" && "text-danger",
                          )}>
                            {st.status === "pending" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {st.status === "ok" && <Check className="h-3.5 w-3.5" />}
                            {st.status === "error" && <AlertTriangle className="h-3.5 w-3.5" />}
                            <span className="break-all">{st.status}{st.msg ? ` · ${st.msg}` : ""}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-col gap-3 border-t border-line/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-gray-300">
                    Total <span className="text-base font-semibold text-accent">${total}/mo</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={clearCart}
                      disabled={deploying}
                      className="rounded border border-line px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest text-gray-400 hover:border-danger hover:text-danger disabled:opacity-40"
                    >clear</button>
                    <button
                      onClick={deployAll}
                      disabled={deploying || cart.length === 0}
                      className="rounded bg-accent px-4 py-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-bg shadow-glow hover:bg-teal-300 disabled:bg-line/40 disabled:text-gray-500 disabled:shadow-none"
                    >
                      {deploying ? "deploying…" : `deploy all (${cart.length})`}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
