"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAtlas } from "@/lib/store";
import { Mic, MicOff, Send, Shield, Sparkles, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VultrPlan, VultrRegion } from "@/lib/types";

type Proposal = {
  summary: string;
  reasoning: string;
  actions: any[];
  requires_human_approval: true;
};

type AtlasCmd = {
  focus?: string;
  open?: "region" | "compare" | "globe";
  region?: string;
  navigate?: string;
  autorotate?: boolean;
  compare?: string[];
  filter?: Record<string, unknown>;
};

type VoiceChoice = {
  region: VultrRegion;
  plan: VultrPlan;
  label: string;
  osId?: number;
};

const CMD_REGEX = /<atlas-cmd>\s*([\s\S]*?)\s*<\/atlas-cmd>/gi;
const DEPLOY_WORDS = /\b(build|create|deploy|spin up|provision|launch)\b/i;
const NAV_WORDS = /\b(spin|fly|go|open|focus|show|zoom|move)\b/i;
const DATA_WORDS = /\b(data|status|capacity|datacenter|data center|fleet|plans|instances|servers)\b/i;

function stripAndExtractCmds(text: string): { clean: string; cmds: AtlasCmd[] } {
  const cmds: AtlasCmd[] = [];
  const clean = text.replace(CMD_REGEX, (_full, body) => {
    try {
      const obj = JSON.parse(body);
      if (obj && typeof obj === "object") cmds.push(obj as AtlasCmd);
    } catch {
      /* ignore */
    }
    return "";
  });
  return { clean: clean.replace(/\n{3,}/g, "\n\n").trim(), cmds };
}

function tryExtractProposal(text: string): Proposal | null {
  const m = text.match(/```json\s*([\s\S]+?)```/i);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1]);
    if (obj && typeof obj === "object" && Array.isArray(obj.actions)) return obj as Proposal;
  } catch {
    /* ignore */
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findRegionInText(text: string, regions: VultrRegion[], selectedRegion: string | null): VultrRegion | null {
  const value = text.toLowerCase();
  const exact = regions.find((region) =>
    [region.id, region.city, region.country]
      .filter(Boolean)
      .some((part) => new RegExp(`\\b${escapeRegExp(part.toLowerCase())}\\b`).test(value)),
  );
  if (exact) return exact;
  if (selectedRegion) return regions.find((region) => region.id === selectedRegion) ?? null;
  return null;
}

function availablePlans(regionId: string, plans: VultrPlan[], text: string): VultrPlan[] {
  const wantsGpu = /\b(gpu|cuda|ai|model|inference)\b/i.test(text);
  const wantsHighFrequency = /\b(vhf|high frequency|fast cpu)\b/i.test(text);
  const wantsShared = /\b(cheap|cheapest|smallest|budget|shared)\b/i.test(text);
  return plans
    .filter((plan) => plan.locations?.includes(regionId) && plan.ram >= 1024)
    .filter((plan) => (wantsGpu ? /^vcg/i.test(plan.type) || !!plan.gpu_type : true))
    .filter((plan) => (wantsHighFrequency ? /^vhf/i.test(plan.type) : true))
    .sort((a, b) => {
      if (wantsShared) return a.monthly_cost - b.monthly_cost;
      const familyScore = (plan: VultrPlan) => (/^vhf/i.test(plan.type) ? 0 : /^vc2/i.test(plan.type) ? 1 : 2);
      return familyScore(a) - familyScore(b) || a.monthly_cost - b.monthly_cost;
    })
    .slice(0, 4);
}

function formatPlan(plan: VultrPlan): string {
  const ramGb = Math.round(plan.ram / 1024);
  const gpu = plan.gpu_type ? ` · ${plan.gpu_type} ${plan.gpu_vram_gb ?? ""}GB VRAM` : "";
  return `${plan.id}: ${plan.vcpu_count} vCPU · ${ramGb} GB RAM · ${plan.disk} GB disk · $${plan.monthly_cost}/mo${gpu}`;
}

function makeCreateProposal(choice: VoiceChoice): Proposal {
  const action: any = {
    kind: "create_instance",
    region: choice.region.id,
    plan: choice.plan.id,
    label: choice.label,
    hostname: choice.label.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""),
    enable_ipv6: true,
    backups: false,
    tags: ["atlas-voice"],
  };
  if (choice.osId) action.os_id = choice.osId;
  return {
    summary: `Deploy ${choice.plan.id} in ${choice.region.city}`,
    reasoning: `${formatPlan(choice.plan)} is available in ${choice.region.city}. Atlas will create it through the existing Vultr API route after approval.`,
    actions: [action],
    requires_human_approval: true,
  };
}

function proposalMarkdown(proposal: Proposal): string {
  return `${proposal.summary}\n\n${proposal.reasoning}\n\n\`\`\`json\n${JSON.stringify(proposal, null, 2)}\n\`\`\``;
}

export function AgentSidebar() {
  const {
    chat,
    appendChat,
    patchLastModel,
    regions,
    instances,
    plans,
    services,
    regionStatus,
    maintenanceEvents,
    sla,
    apiConnected,
    apiError,
    selectedRegion,
    selectedInstance,
    focusRegion,
    openConfigurator,
    setAutoRotate,
  } = useAtlas();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "transcribing" | "acting">("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceChoices, setVoiceChoices] = useState<VoiceChoice[]>([]);
  const [voicePendingAction, setVoicePendingAction] = useState<any | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const appliedCmdIndexRef = useRef<Set<string>>(new Set());
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const regionLookup = useMemo(() => new Map(regions.map((region) => [region.id, region])), [regions]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [chat, voiceChoices]);

  useEffect(() => {
    const last = chat[chat.length - 1];
    if (!last || last.role !== "model") return;
    const { cmds } = stripAndExtractCmds(last.text);
    cmds.forEach((cmd, idx) => {
      const key = `${last.ts}:${idx}:${JSON.stringify(cmd)}`;
      if (appliedCmdIndexRef.current.has(key)) return;
      appliedCmdIndexRef.current.add(key);
      if (typeof cmd.autorotate === "boolean") setAutoRotate(cmd.autorotate);
      const target = cmd.focus ?? cmd.region;
      if (target && typeof target === "string") focusRegion(target.toLowerCase());
      if (cmd.open === "region" && (cmd.region || cmd.focus)) {
        const r = (cmd.region ?? cmd.focus)!.toLowerCase();
        router.push(`/atlas/region/${r}`);
      } else if (cmd.navigate) {
        router.push(cmd.navigate);
      }
    });
  }, [chat, focusRegion, setAutoRotate, router]);

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const clean = stripAndExtractCmds(text)
      .clean.replace(/```[\s\S]*?```/g, "")
      .replace(/[`*_#]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean.slice(0, 420));
    utterance.rate = 1.02;
    utterance.pitch = 0.98;
    window.speechSynthesis.speak(utterance);
  }

  function regionSummary(region: VultrRegion): string {
    const status = regionStatus.find((item) => item.region_id === region.id);
    const regionInstances = instances.filter((instance) => instance.region === region.id);
    const regionServices = services.filter((service) => service.region === region.id);
    const regionPlans = plans.filter((plan) => plan.locations?.includes(region.id));
    const cheapest = [...regionPlans].sort((a, b) => a.monthly_cost - b.monthly_cost)[0];
    const liveCpu = regionInstances.reduce((sum, instance) => sum + (instance.vcpu_count ?? 0), 0);
    const liveRam = Math.round(regionInstances.reduce((sum, instance) => sum + (instance.ram ?? 0), 0) / 1024);
    return [
      `${region.city} (${region.id}) is ${status?.status ?? "status unknown"}.`,
      `${regionInstances.length} instances and ${regionServices.length} regional services are visible in this account.`,
      regionInstances.length ? `Current compute there totals ${liveCpu} vCPU and ${liveRam} GB RAM.` : "No live instances are currently pinned to that datacenter.",
      cheapest ? `The lowest available instance plan I see is ${formatPlan(cheapest)}.` : "No deployable plan catalog is loaded for that datacenter.",
    ].join(" ");
  }

  async function osIdForVoiceDeploy(): Promise<number | undefined> {
    try {
      const res = await fetch("/api/vultr/catalog", { cache: "no-store" });
      const catalog = await res.json();
      const os = Array.isArray(catalog.os) ? catalog.os : [];
      return (
        os.find((item: any) => /debian\s*12/i.test(`${item.name} ${item.family}`))?.id ??
        os.find((item: any) => /ubuntu\s*24/i.test(`${item.name} ${item.family}`))?.id ??
        os.find((item: any) => /ubuntu\s*22/i.test(`${item.name} ${item.family}`))?.id ??
        os.find((item: any) => /debian|ubuntu/i.test(`${item.name} ${item.family}`))?.id
      );
    } catch {
      return undefined;
    }
  }

  function appendVoiceModel(text: string) {
    appendChat({ role: "model", text, ts: Date.now() });
    speak(text);
  }

  async function proposeChoice(choice: VoiceChoice) {
    const normalizedChoice = choice.osId ? choice : { ...choice, osId: await osIdForVoiceDeploy() };
    const proposal = makeCreateProposal(normalizedChoice);
    const action = proposal.actions[0];
    setVoicePendingAction(action);
    setVoiceChoices([]);
    appendVoiceModel(proposalMarkdown(proposal));
  }

  async function handleVoiceCommand(transcript: string): Promise<boolean> {
    const text = transcript.trim();
    const lower = text.toLowerCase();
    const selectedChoice = lower.match(/\b(?:choose|select|pick|option)\s*(one|two|three|four|1|2|3|4)\b/);
    const optionNumber = selectedChoice?.[1]
      ? { one: 1, two: 2, three: 3, four: 4 }[selectedChoice[1] as "one" | "two" | "three" | "four"] ?? Number(selectedChoice[1])
      : null;

    if (optionNumber && voiceChoices[optionNumber - 1]) {
      await proposeChoice(voiceChoices[optionNumber - 1]);
      return true;
    }

    if (/\b(approve|confirm)\b/i.test(text) && /\b(deploy|create|build|launch|it)\b/i.test(text) && voicePendingAction) {
      appendVoiceModel(`Approval received by voice for ${voicePendingAction.kind} in ${voicePendingAction.region ?? "the selected region"}. Deploying now.`);
      await approve(voicePendingAction);
      setVoicePendingAction(null);
      return true;
    }

    const region = findRegionInText(text, regions, selectedRegion);
    if (region && (NAV_WORDS.test(text) || DATA_WORDS.test(text))) {
      setAutoRotate(false);
      focusRegion(region.id);
      if (/\b(open|configure|configurator|build|deploy|create)\b/i.test(text)) openConfigurator(region.id);
      appendVoiceModel(`Globe focused on ${region.city}. ${regionSummary(region)}`);
      if (!DEPLOY_WORDS.test(text)) return true;
    }

    if (DEPLOY_WORDS.test(text)) {
      const deployRegion = region ?? (selectedRegion ? regionLookup.get(selectedRegion) ?? null : null);
      if (!deployRegion) {
        appendVoiceModel("Tell me the datacenter first, for example: build a small instance in Frankfurt.");
        return true;
      }
      const choices = availablePlans(deployRegion.id, plans, text).map((plan, index) => ({
        region: deployRegion,
        plan,
        label: `atlas-voice-${deployRegion.id}-${index + 1}`,
      }));
      if (!choices.length) {
        appendVoiceModel(`I cannot see an available plan for ${deployRegion.city} in the current catalog.`);
        return true;
      }
      setVoiceChoices(choices);
      openConfigurator(deployRegion.id);
      const options = choices.map((choice, index) => `${index + 1}. ${formatPlan(choice.plan)}`).join("\n");
      appendVoiceModel(`I found deployable instance choices in ${deployRegion.city}.\n\n${options}\n\nSay or click one option, then approve deploy.`);
      return true;
    }

    return false;
  }

  async function send(messageOverride?: string, options?: { speakReply?: boolean; appendUser?: boolean }) {
    const msg = (messageOverride ?? input).trim();
    if (!msg || busy) return;
    setInput("");
    if (options?.appendUser !== false) appendChat({ role: "user", text: msg, ts: Date.now() });
    appendChat({ role: "model", text: "", ts: Date.now() });
    setBusy(true);

    const context = JSON.stringify({
      api_connected: apiConnected,
      api_error: apiError,
      regions: regions.length,
      instances_total: instances.length,
      services_total: services.length,
      selected_region: selectedRegion,
      selected_instance: selectedInstance,
      region_status: selectedRegion ? regionStatus.find((status) => status.region_id === selectedRegion) : regionStatus.slice(0, 12),
      maintenance_events: maintenanceEvents.slice(0, 10),
      sla,
      attention: [
        ...instances.flatMap((instance) => (instance.attention ?? []).map((item) => `${instance.label}: ${item}`)),
        ...services.flatMap((service) => service.attention.map((item) => `${service.label}: ${item}`)),
      ].slice(0, 20),
      instances_in_selected: selectedRegion
        ? instances.filter((i) => i.region === selectedRegion).map((i) => ({ id: i.id, label: i.label, plan: i.plan, status: i.status, power_status: i.power_status, server_status: i.server_status, bandwidth_gb: i.bandwidth_gb, health: i.health, attention: i.attention }))
        : undefined,
      plans_sample: plans.slice(0, 6).map((p) => ({ id: p.id, vcpu: p.vcpu_count, ram_gb: p.ram / 1024, monthly: p.monthly_cost })),
      voice_commands: {
        enabled: true,
        speech_to_text: "Speechmatics",
        spoken_reply: "browser speechSynthesis",
        can_focus_globe: true,
        can_offer_instance_choices: true,
        deploy_requires_explicit_approval: true,
      },
    });

    let spokenReply = "";
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          history: chat.map((c) => ({ role: c.role, text: c.text })),
          message: msg,
          context,
        }),
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const ev of events) {
          const lines = ev.split("\n");
          const evt = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
          const data = lines.find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (evt === "chunk" && data) {
            try {
              const o = JSON.parse(data);
              const chunk = o.text ?? "";
              spokenReply += chunk;
              patchLastModel(chunk);
            } catch {}
          }
        }
      }
      if (options?.speakReply) speak(spokenReply);
    } catch (e: any) {
      const error = `\n\n[error: ${e.message ?? String(e)}]`;
      patchLastModel(error);
      if (options?.speakReply) speak(error);
    } finally {
      setBusy(false);
    }
  }

  async function approve(action: any) {
    setApproving(JSON.stringify(action));
    try {
      const res = await fetch("/api/vultr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: action.kind, ...action }),
      });
      const j = await res.json();
      const text = j.ok
        ? `\n✓ Executed \`${action.kind}\`. ${j.instance?.id ? "Instance " + j.instance.id : ""}`
        : `\n✗ Failed: ${j.error ?? "unknown"}`;
      appendChat({ role: "model", text, ts: Date.now() });
      speak(text);
    } catch (e: any) {
      const text = `\n✗ Error: ${e.message}`;
      appendChat({ role: "model", text, ts: Date.now() });
      speak(text);
    } finally {
      setApproving(null);
    }
  }

  async function transcribeAudio(audio: Blob) {
    const form = new FormData();
    form.set("audio", audio, "atlas-voice.webm");
    const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok || !body.text) throw new Error(body.error ?? "Speechmatics did not return a transcript.");
    return String(body.text);
  }

  async function startVoice() {
    if (voiceState !== "idle") return;
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const audio = new Blob(audioChunksRef.current, { type: mimeType });
        if (!audio.size) {
          setVoiceState("idle");
          return;
        }
        setVoiceState("transcribing");
        try {
          const transcript = await transcribeAudio(audio);
          appendChat({ role: "user", text: `🎙 ${transcript}`, ts: Date.now() });
          setVoiceState("acting");
          const handled = await handleVoiceCommand(transcript);
          if (!handled) await send(transcript, { speakReply: true, appendUser: false });
        } catch (error: any) {
          setVoiceError(error?.message ?? String(error));
          appendVoiceModel(`Voice command failed: ${error?.message ?? String(error)}`);
        } finally {
          setVoiceState("idle");
        }
      };
      recorder.start();
      setVoiceState("recording");
    } catch (error: any) {
      setVoiceError(error?.message ?? String(error));
      setVoiceState("idle");
    }
  }

  function stopVoice() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  const voiceBusy = voiceState !== "idle";

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-line bg-panel/70 backdrop-blur">
      <div className="flex shrink-0 items-center gap-2 border-b border-line p-2.5 sm:p-3">
        <Sparkles className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold">Atlas Copilot</span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-bg/60 px-2 py-0.5 text-[10px] text-gray-400">
          <Shield className="h-3 w-3 text-ok" /> human-gated
        </span>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-auto scrollbar-thin p-2.5 text-sm sm:p-3">
        {chat.length === 0 && (
          <div className="rounded-md border border-dashed border-line p-3 text-xs text-gray-400">
            Try: <em>“Suggest the cheapest plan for a Postgres-heavy API in Frankfurt under $40/mo.”</em><br />
            Or: <em>“My API in EWR is at 71% CPU — what should I do?”</em><br />
            Or: <em>“Spin up a Debian 12 instance in Frankfurt on the smallest VHF plan.”</em>
          </div>
        )}
        {chat.map((m, i) => {
          const proposal = m.role === "model" ? tryExtractProposal(m.text) : null;
          const display = m.role === "model" ? stripAndExtractCmds(m.text).clean : m.text;
          return (
            <div
              key={i}
              className={cn(
                "rounded-md p-2.5 text-xs leading-relaxed",
                m.role === "user"
                  ? "ml-2 bg-accent/10 text-gray-100 sm:ml-6"
                  : "mr-2 bg-bg/50 text-gray-200 sm:mr-6",
              )}
            >
              <div className="whitespace-pre-wrap">{display || (m.role === "model" ? "…" : "")}</div>
              {proposal && (
                <div className="mt-2 rounded-md border border-accent2/40 bg-accent2/5 p-2">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-accent2">
                    Proposed actions · click to approve
                  </div>
                  <div className="space-y-1">
                    {proposal.actions.map((a, ai) => (
                      <div
                        key={ai}
                        className="flex items-center justify-between gap-2 rounded border border-line/60 bg-bg/40 p-1.5"
                      >
                        <code className="truncate text-[10px] text-gray-300">
                          {a.kind} {Object.entries(a)
                            .filter(([k]) => k !== "kind")
                            .map(([k, v]) => `${k}=${v}`)
                            .join(" ")}
                        </code>
                        {a.kind !== "no_op" && (
                          <button
                            disabled={approving === JSON.stringify(a)}
                            onClick={() => approve(a)}
                            className="rounded bg-ok px-2 py-0.5 text-[10px] font-bold text-bg hover:bg-emerald-300 disabled:opacity-50"
                          >
                            {approving === JSON.stringify(a) ? "…" : "APPROVE"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {voiceChoices.length > 0 && (
          <div className="mr-2 rounded-md border border-accent/40 bg-accent/5 p-2 text-xs text-gray-200 sm:mr-6">
            <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-accent">
              <Volume2 className="h-3 w-3" /> Voice instance choices
            </div>
            <div className="space-y-1.5">
              {voiceChoices.map((choice, index) => (
                <button
                  key={choice.plan.id}
                  onClick={() => proposeChoice(choice)}
                  className="block w-full rounded border border-line/70 bg-bg/40 px-2 py-1.5 text-left text-[11px] hover:border-accent hover:bg-accent/10"
                >
                  <span className="font-semibold text-accent">Option {index + 1}</span> · {formatPlan(choice.plan)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line p-2">
        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Ask Atlas… (Enter to send)"
            className="min-w-0 flex-1 rounded-md border border-line bg-bg/60 px-2.5 py-1.5 text-xs outline-none focus:border-accent"
          />
          <button
            disabled={voiceState === "transcribing" || voiceState === "acting"}
            onClick={voiceState === "recording" ? stopVoice : startVoice}
            title={voiceState === "recording" ? "Stop voice command" : "Start voice command"}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border border-line bg-bg/60 text-gray-200 hover:border-accent hover:text-accent disabled:opacity-50",
              voiceState === "recording" && "border-red-400 bg-red-500/15 text-red-200",
            )}
          >
            {voiceState === "recording" ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
          <button
            disabled={busy || !input.trim()}
            onClick={() => send()}
            className={cn(
              "flex items-center justify-center rounded-md bg-accent px-3 text-bg",
              (busy || !input.trim()) && "opacity-50",
            )}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-gray-500">
          <span>
            <span className="hidden sm:inline">Powered by Gemini · Speechmatics voice · </span><span className="text-accent">You approve every action.</span>
          </span>
          {voiceBusy && <span className="text-accent">{voiceState === "recording" ? "listening" : voiceState}</span>}
        </div>
        {voiceError && <div className="mt-1 truncate text-[10px] text-red-300">{voiceError}</div>}
      </div>
    </div>
  );
}
