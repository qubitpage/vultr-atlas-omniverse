# Vultr Atlas + Omniverse — 3D Infrastructure Cockpit

> AI Agent Olympics submission · Vultr Track · Milan AI Week (May 13–20 2026)

Live cockpit: https://atlas.qubitpage.com  
Source repository: https://github.com/qubitpage/vultr-atlas-omniverse

A 3D cockpit for your real Vultr fleet. A spinning globe shows account regions as towers whose height = server count and color = operational health. Click a region to expand real Vultr servers, services, status, maintenance and SLA context. An always-on Gemini copilot ("Atlas") drafts plans, explains tradeoffs, and proposes infrastructure changes — **but never executes anything. Every action requires an explicit human click.**

This public release also includes the Omniverse/Isaac Sim integration layer used for GPU-hosted digital-twin streaming experiments. The repository has been exported from the live workspace, cleaned of build output and diagnostic scripts, and scanned for literal API keys/secrets before publication.

---

## Stack

- **Next.js 15** (App Router, React 19 RC, TypeScript)
- **Three.js + react-three-fiber + drei** — the 3D globe, region towers, pulsing rings, halo, starfield
- **Tailwind CSS** — dark cockpit palette (teal `#5eead4` accent, violet `#a78bfa` agent accent)
- **Zustand** — client-side fleet state
- **Gemini** (`@google/generative-ai`, model `gemini-2.0-flash-exp` by default) — streamed via SSE
- **Vultr v2 REST API** — `/regions`, `/plans`, `/instances` (list / create / destroy / reboot)
- **VS Code Web + GitHub Copilot** — embedded admin-only editor rail with a chat-only Copilot view and a full IDE view
- **NVIDIA Isaac Sim / Omniverse WebRTC** — optional GPU-hosted digital-twin streaming assets under `omniverse-integration/`

---

## Run it locally

```bash
cp .env.example .env.local
# Fill in VULTR_API_KEY for real account infrastructure.
# Without it, Atlas shows no account servers/services and asks you to connect the API.
npm install
npm run dev   # http://localhost:3030
```

### Environment

| Var | Purpose |
| --- | --- |
| `VULTR_API_KEY` | Real Vultr account token. Required for account infrastructure. |
| `GEMINI_API_KEY` | Required for the Atlas copilot chat. |
| `GEMINI_MODEL` | Override the Gemini model (default `gemini-2.0-flash-exp`). |
| `ATLAS_SESSION_SECRET` | Required for signed Atlas sessions. Use a long random value. |
| `ATLAS_ADMIN_PASSWORD` | Admin login password. The live demo uses `demo` by owner mandate. |
| `ATLAS_DEMO_PASSWORD` | Optional demo password. |
| `SPEECHMATICS_API_KEY` | Optional server-side voice command transcription. |

---

## What you see

- **Left**: 3D globe. Auto-rotates. Drag to orbit, scroll to zoom. Each region marker = a tower (height ∝ real server count) + a pulsing ring (color = operational health from instance state and Vultr status). City labels billboard above each tower.
- **Digital Twin**: selected Vultr zone expands into a 3D operational hall containing only real account servers and real account services returned by the Vultr API, plus public Vultr maintenance/SLA context.
- **Bottom-left, two cards**:
  - **Region Panel** — clicked region's instances with status, IP, plan, bandwidth and availability data. CPU/load/temperature show `N/A` unless future guest telemetry supplies them.
  - **Recommend** — describe a workload (web / api / db / worker / ml / static), set min RAM / vCPU / budget, optionally a region hint. The recommendation engine scores Vultr plans by workload-weighted utility ÷ log(price).
- **Right**: **Atlas Copilot** chat sidebar. Streams Gemini responses. When Gemini emits a fenced ```json``` proposal block, it renders inline as an action list with an **APPROVE** button per action. Nothing happens until you click.

---

## The "human-gated agent" design

Three layers of defense:

1. **Model-side**: `lib/gemini.ts` `SYSTEM_PROMPT` declares Atlas as propose-only.
2. **UI-side**: `components/atlas/AgentSidebar.tsx` extracts proposals from streamed text and renders an explicit approval button per action. There is no auto-execute path.
3. **API-side**: `/api/vultr` only accepts POSTs with an explicit `action` field; the chat endpoint is a separate route that has no side-effect tools.

---

## Vultr API + Digital-Twin Data Model

Atlas uses Vultr API v2 for real account inventory when `VULTR_API_KEY` is set:

- `/regions` and `/plans` — datacenter map, plan availability, price, RAM/vCPU/bandwidth class.
- `/instances` — active cloud servers, OS, plan, region, IP, status/power/server state.
- Best-effort inventory collectors: `/load-balancers`, `/databases`, `/kubernetes/clusters`, `/blocks`, `/object-storage`, `/firewalls`, `/reserved-ips`, `/vpcs`, `/snapshots`, `/dns/domains`, `/container-registry`.
- Public `status.vultr.com` — regional OK / planned service / degraded state and scheduled maintenance windows.
- Public Vultr SLA page — 100% uptime guarantee summary, exclusions and outage-credit table.

Vultr does **not** expose guest CPU load or physical host temperature for VPS instances through the public account API. Atlas therefore does **not** invent those values. CPU, load and temperature fields display `N/A` until a guest telemetry agent or another real metric source is added.

---

## Project layout

```
app/
  page.tsx              Landing page
  atlas/page.tsx        Main 3D cockpit
  api/
    vultr/route.ts      GET fleet snapshot · POST create/destroy/reboot
    agent/
      chat/route.ts     SSE Gemini stream
      recommend/route.ts  Plan scoring
components/atlas/
  Globe.tsx             react-three-fiber 3D globe + region markers
  RegionPanel.tsx       Per-region instance list with live bars
  AgentSidebar.tsx      Gemini chat + proposal approval
  RecommendCard.tsx     Workload form + ranked picks
lib/
  vultr.ts              Server-only Vultr API client (real account data only)
  gemini.ts             Gemini system prompt + streaming chat helper
  recommend.ts          Workload-weighted plan scorer
  regions.ts            Vultr region → lat/lon + sphere math
  store.ts              Zustand client store
  types.ts              Shared types
  utils.ts              cn() class merger
omniverse-integration/
  components/OmniverseStream.tsx  WebRTC stream embed component
  server/                       GPU host nginx/docker setup
  akash/                        Akash deployment manifests with placeholder credentials
```

---

## Security notes

- The release folder was scanned before push with `SECRET_SCAN_FINDINGS=0` for literal tokens, API keys, private keys, and hardcoded passwords.
- `.env.example` contains empty placeholders only. Real Vultr, Gemini, Speechmatics, NGC, and session secrets must be provided through environment variables.
- Old one-off diagnostic scripts from the private deployment workspace are intentionally excluded because they contained server-specific operational details.

---

## Deploying to a Vultr VM (production)

```bash
npm run build
npm run start  # listens on PORT 3030
```

Front with Caddy / Nginx → port 443. The app uses no database; everything is in-memory client state + live calls to the Vultr API on each load.

---

## License

MIT. Built for the AI Agent Olympics.
