import Link from "next/link";
import { ArrowRight, Github, Globe2, MessageSquare, ShieldCheck, Zap, Server, Activity, MapPin, Sparkles, Coffee, Building2 } from "lucide-react";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_0%,rgba(94,234,212,0.08),transparent_50%),radial-gradient(circle_at_80%_60%,rgba(167,139,250,0.06),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(28,36,64,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(28,36,64,0.18)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <nav className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2 font-mono text-sm tracking-widest">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-accent/40 bg-accent/10 text-accent">A</span>
          <span className="text-gray-100">VULTR · ATLAS</span>
          <span className="ml-2 hidden rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.25em] text-emerald-300 sm:inline">Milano Edition</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <a href="https://github.com/qubitpage/vultr-atlas-omniverse" target="_blank" rel="noreferrer" className="hidden rounded-md border border-line bg-panel/60 px-3 py-1.5 font-mono uppercase tracking-widest text-gray-300 hover:border-accent hover:text-accent md:inline-flex">
            Source ↗
          </a>
          <a href="https://www.aiweek.it/en/" target="_blank" rel="noreferrer" className="hidden rounded-md border border-line bg-panel/60 px-3 py-1.5 font-mono uppercase tracking-widest text-gray-300 hover:border-accent hover:text-accent md:inline-flex">
            AI Week Milan 2026 ↗
          </a>
          <Link href="/atlas" className="rounded-md border border-line bg-panel/60 px-3 py-1.5 font-mono uppercase tracking-widest text-gray-300 hover:border-accent hover:text-accent">
            Open Cockpit →
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-8 pt-16 md:pt-24">
        <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-mono uppercase tracking-widest text-emerald-300 backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" />
          Vultr Atlas · Milano Edition · AI Week Italy 2026
        </div>
        <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
          Your entire Vultr <span className="text-accent">network</span>,<br />
          on a single rotating <span className="text-accent2">globe</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-300">
          Atlas is a real-time 3D operations cockpit for Vultr. See every active region,
          every server, every load balancer, every database, every maintenance event — and a
          Gemini orchestrator on the right rail that flies the globe for you, opens specs, compares
          plans, and proposes deploys. <span className="text-accent2">You stay in command. Every action is human-approved.</span>
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/atlas" className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 font-semibold text-bg shadow-glow transition hover:bg-teal-300">
            Enter Atlas <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="https://www.vultr.com/docs/vultr-api/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-line px-5 py-3 font-semibold text-gray-200 hover:border-accent">
            Vultr API Reference
          </a>
          <a href="https://github.com/qubitpage/vultr-atlas-omniverse" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-line px-5 py-3 font-semibold text-gray-200 hover:border-accent">
            <Github className="h-4 w-4" /> Source Code
          </a>
        </div>

        <div className="mt-16 grid gap-3 text-center sm:grid-cols-4">
          {[
            { v: "32+", l: "Vultr regions on the globe" },
            { v: "11", l: "service kinds tracked live" },
            { v: "100%", l: "uptime SLA visualised" },
            { v: "0", l: "writes without your click" },
          ].map((s) => (
            <div key={s.l} className="rounded-lg border border-line bg-panel/40 px-3 py-4 backdrop-blur">
              <div className="font-mono text-2xl text-accent">{s.v}</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-gray-500">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-32 grid max-w-7xl gap-3 px-8 md:grid-cols-3">
        {[
          { icon: <Globe2 className="h-5 w-5" />, t: "Live 3D Network Map", d: "Every Vultr region on a rotating Earth. Markers light up with your real instances, services, status, and maintenance windows pulled live from /v2 and Vultr Status." },
          { icon: <Server className="h-5 w-5" />, t: "Click → Provision", d: "Click any region: full spec page. Filter Cloud Compute / High-Frequency / Optimized / Bare Metal / Cloud GPU. Compare plans, pick OS or marketplace app, deploy in one click." },
          { icon: <MessageSquare className="h-5 w-5" />, t: "Gemini Orchestrator", d: "Right-rail copilot streams Gemini 2.0 Flash. Ask it to fly to Frankfurt, compare two plans, find the cheapest GPU in Europe — it moves the globe and opens the right panels for you." },
          { icon: <Activity className="h-5 w-5" />, t: "Maintenance & SLA aware", d: "Status-page scraping surfaces planned and degraded zones on the globe. SLA policy and credit ladder are inline so you can act on real incidents, not guesswork." },
          { icon: <Zap className="h-5 w-5" />, t: "All Vultr services", d: "Instances, Bare Metal, Load Balancers, Managed Databases, Kubernetes, Block & Object Storage, VPCs, Firewalls, Reserved IPs, Snapshots, DNS, Container Registry, Serverless Inference." },
          { icon: <ShieldCheck className="h-5 w-5" />, t: "Human-gated writes", d: "The AI proposes a JSON action. You read it and click APPROVE. No silent writes, no agent loops, no surprises. Built for production operators." },
        ].map((f) => (
          <div key={f.t} className="rounded-lg border border-line bg-panel/40 p-5 backdrop-blur">
            <div className="inline-flex items-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-2 py-1 text-accent">{f.icon}</div>
            <div className="mt-3 text-base font-semibold text-gray-100">{f.t}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-400">{f.d}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto my-24 max-w-7xl px-8">
        <div className="grid gap-6 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/5 via-panel/40 to-amber-300/5 p-8 backdrop-blur md:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.25em] text-emerald-300">
              <MapPin className="h-3 w-3" /> Milano · 45.4642° N, 9.1900° E
            </div>
            <h2 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
              Benvenuti a <span className="text-emerald-300">Milano</span>.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-gray-300">
              Atlas debuts at <a href="https://www.aiweek.it/en/" target="_blank" rel="noreferrer" className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">AI Week Italy 2026</a> —
              the largest AI gathering in Southern Europe. Italy's design capital is also a
              quiet hub of cloud infrastructure: Vultr's Milan (<span className="font-mono text-emerald-300">mxp</span>) region
              sits minutes from Linate and the Navigli, serving Northern Italy, the Alps, and
              the Adriatic with low single-digit latency.
            </p>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-gray-300">
              Spin the globe to Milan during our talk and watch the cockpit light up the
              region marker, surface live capacity, and propose a deploy — all in real time,
              human-approved, zero theatrics.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/atlas" className="inline-flex items-center gap-2 rounded-md bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black shadow-glow transition hover:bg-emerald-300">
                Fly to Milano <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="https://www.aiweek.it/en/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2.5 text-sm font-semibold text-gray-200 hover:border-emerald-400 hover:text-emerald-300">
                AI Week agenda ↗
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <Building2 className="h-4 w-4" />, t: "Duomo di Milano", d: "135 marble spires, six centuries of work — the most photographed roof in Italy." },
              { icon: <Sparkles className="h-4 w-4" />, t: "La Scala", d: "The opera house where Verdi premiered. Two minutes from the Galleria." },
              { icon: <Coffee className="h-4 w-4" />, t: "Navigli at dusk", d: "Canal-side aperitivo: Spritz, focaccia, jazz spilling out of the bars." },
              { icon: <MapPin className="h-4 w-4" />, t: "Brera & Pinacoteca", d: "Cobblestones, galleries, Caravaggio and Hayez within five blocks." },
              { icon: <Building2 className="h-4 w-4" />, t: "Bosco Verticale", d: "Two residential towers planted with 800 trees — vertical reforestation." },
              { icon: <Sparkles className="h-4 w-4" />, t: "Last Supper", d: "Leonardo's fresco at Santa Maria delle Grazie. Book weeks ahead." },
            ].map((p) => (
              <div key={p.t} className="rounded-lg border border-line bg-panel/50 p-3 backdrop-blur">
                <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-emerald-300">{p.icon}</div>
                <div className="mt-2 text-sm font-semibold text-gray-100">{p.t}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-400">{p.d}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-3 text-center sm:grid-cols-4">
          {[
            { v: "1.4M", l: "Milano metro citizens" },
            { v: "<8ms", l: "MXP → Frankfurt RTT" },
            { v: "May 2026", l: "AI Week Italy" },
            { v: "1 click", l: "deploy in Milano" },
          ].map((s) => (
            <div key={s.l} className="rounded-lg border border-line bg-panel/40 px-3 py-4 backdrop-blur">
              <div className="font-mono text-2xl text-emerald-300">{s.v}</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-gray-500">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto my-24 max-w-3xl px-8 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Ready to fly your fleet?</h2>
        <p className="mt-3 text-gray-400">No fake data. Live Vultr API. Real maintenance feed. Open the cockpit.</p>
        <Link href="/atlas" className="mt-6 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 font-semibold text-bg shadow-glow transition hover:bg-teal-300">
          Enter Atlas <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
