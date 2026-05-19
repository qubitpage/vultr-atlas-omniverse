"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginInner() {
  const search = useSearchParams();
  const next = search.get("next") || "/atlas";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function go(href: string) {
    // If we are inside the right-rail iframe, navigate the top window so the
    // whole cockpit reloads with the new session cookie. Otherwise navigate
    // the current window normally.
    try {
      if (typeof window !== "undefined" && window.top && window.top !== window.self) {
        (window.top as Window).location.href = href;
        return;
      }
    } catch {
      /* cross-origin top — fall through */
    }
    window.location.href = href;
  }

  async function submit(pwd: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? "login failed");
        setBusy(false);
        return;
      }
      go(next);
    } catch (e: any) {
      setError(e?.message ?? "network error");
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#05070d] text-gray-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(800px 600px at 50% 30%, rgba(82,160,255,0.12), transparent 70%), radial-gradient(600px 400px at 70% 70%, rgba(160,82,255,0.08), transparent 70%)",
        }}
      />
      <div className="relative z-10 flex w-[min(420px,92vw)] flex-col gap-4 rounded-2xl border border-line bg-panel/70 p-6 shadow-2xl backdrop-blur">
        <div className="flex flex-col gap-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">vultr atlas</div>
          <h1 className="text-xl font-semibold text-white">3D Infrastructure Cockpit</h1>
          <p className="text-xs text-gray-400">Sign in to continue.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(password);
          }}
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-gray-400">admin password</span>
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-line bg-bg/70 px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="••••••••"
            />
          </label>
          {error ? <div className="text-xs text-red-400">{error}</div> : null}
          <button
            type="submit"
            disabled={busy || !password}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-black transition hover:bg-accent/90 disabled:opacity-40"
          >
            {busy ? "Signing in…" : "Sign in as admin"}
          </button>
        </form>

        <div className="my-1 h-px bg-line" />

        <button
          onClick={() => void submit("demo")}
          disabled={busy}
          className="rounded-md border border-line bg-bg/40 px-3 py-2 text-sm text-gray-200 transition hover:bg-bg/70"
        >
          Continue as demo (read-only preview)
        </button>
        <p className="text-[10px] leading-relaxed text-gray-500">
          The demo session can browse the globe and configurator but cannot create or destroy
          infrastructure, see instance IPs, or open the IDE. Admin password gates real operations
          and the embedded VS Code.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
