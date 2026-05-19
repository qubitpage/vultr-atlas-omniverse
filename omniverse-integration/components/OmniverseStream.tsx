"use client";
/**
 * OmniverseStream — embeds NVIDIA Isaac Sim / Omniverse streaming into the
 * Atlas cockpit via WebRTC.
 *
 * Two modes:
 *  1. Native WebRTC signaling (NEXT_PUBLIC_OMNIVERSE_SIGNAL_URL = ws://host:port)
 *     → connects directly to Isaac Sim's built-in WebRTC signaling server.
 *  2. Web viewer iframe (NEXT_PUBLIC_OMNIVERSE_STREAM_URL = https://host)
 *     → embeds the Isaac Sim Docker Compose web viewer page.
 *
 * If both are unset, renders an inert "GPU not provisioned" placeholder.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, Power, ServerCog, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const STREAM_URL = process.env.NEXT_PUBLIC_OMNIVERSE_STREAM_URL ?? "";
const SIGNAL_URL = process.env.NEXT_PUBLIC_OMNIVERSE_SIGNAL_URL ?? "";

type StreamState = "idle" | "loading" | "connecting" | "live" | "error";

export function OmniverseStream({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<StreamState>("idle");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    if (!SIGNAL_URL && !STREAM_URL) return;
    if (STREAM_URL && !SIGNAL_URL) return; // iframe mode, no WebRTC needed

    // --- native WebRTC signaling to Isaac Sim ---
    let cancelled = false;
    setState("connecting");
    setMsg(`Connecting to ${SIGNAL_URL}…`);

    const ws = new WebSocket(SIGNAL_URL);
    wsRef.current = ws;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    pc.ontrack = (ev) => {
      if (cancelled || !videoRef.current) return;
      videoRef.current.srcObject = ev.streams[0] || new MediaStream([ev.track]);
      setState("live");
      setMsg("live");
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ice", candidate: ev.candidate }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (cancelled) return;
      const s = pc.iceConnectionState;
      if (s === "connected" || s === "completed") { setState("live"); setMsg("live"); }
      if (s === "failed" || s === "disconnected") { setState("error"); setMsg(`ICE ${s}`); }
    };

    ws.onopen = async () => {
      if (cancelled) return;
      // Isaac Sim signaling: send offer request
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
    };

    ws.onmessage = async (ev) => {
      if (cancelled) return;
      const data = JSON.parse(ev.data);
      if (data.type === "answer" && data.sdp) {
        await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
      } else if (data.type === "ice" && data.candidate) {
        await pc.addIceCandidate(data.candidate);
      }
    };

    ws.onerror = () => {
      if (cancelled) return;
      setState("error");
      setMsg("WebSocket error");
    };

    ws.onclose = () => {
      if (cancelled) return;
      if (state !== "live") { setState("error"); setMsg("WebSocket closed"); }
    };

    return () => {
      cancelled = true;
      try { ws.close(); } catch { /* */ }
      try { pc.close(); } catch { /* */ }
      wsRef.current = null;
      pcRef.current = null;
    };
  }, []);

  // -------- no config: placeholder --------
  if (!STREAM_URL && !SIGNAL_URL) {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center gap-4 p-6 text-center", className)}>
        <div className="rounded-full border border-accent/40 bg-panel/60 p-4 text-accent shadow-glow">
          <ServerCog className="h-8 w-8" />
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-accent">
            NVIDIA Omniverse · offline
          </div>
          <h3 className="mt-1 text-lg font-semibold">No GPU instance provisioned</h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-400">
            Run <code className="rounded bg-line/40 px-1 text-accent">scripts/akash_deploy.py</code>{" "}
            to deploy Isaac Sim on Akash GPU, then mount with{" "}
            <code className="rounded bg-line/40 px-1 text-accent">scripts/mount_in_cockpit.py</code>.
          </p>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          <Zap className="mr-1 inline h-3 w-3 text-warn" />
          NEXT_PUBLIC_OMNIVERSE_STREAM_URL / SIGNAL_URL unset
        </div>
      </div>
    );
  }

  // -------- iframe mode (web viewer) --------
  if (STREAM_URL && !SIGNAL_URL) {
    return (
      <div className={cn("relative h-full w-full bg-black", className)}>
        <iframe
          src={STREAM_URL}
          className="h-full w-full border-0"
          allow="autoplay; fullscreen; microphone; camera"
          title="NVIDIA Omniverse Stream"
        />
        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-2 rounded border border-line bg-bg/80 px-2 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-ok" />
          <span className="text-ok">Omniverse · Isaac Sim</span>
        </div>
      </div>
    );
  }

  // -------- native WebRTC stream view --------
  return (
    <div className={cn("relative h-full w-full bg-black", className)}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-contain"
      />
      <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-2 rounded border border-line bg-bg/80 px-2 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur">
        {state === "live" ? (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-ok" />
            <span className="text-ok">Omniverse · Isaac Sim</span>
          </>
        ) : state === "error" ? (
          <>
            <Power className="h-3 w-3 text-danger" />
            <span className="text-danger">Omniverse · {msg.slice(0, 40)}</span>
          </>
        ) : (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-accent" />
            <span className="text-accent">{msg || state}</span>
          </>
        )}
      </div>
    </div>
  );
}
