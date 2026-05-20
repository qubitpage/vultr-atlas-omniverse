"use client";

import { useEffect, useRef, useState } from "react";
import { AgentSidebar } from "./AgentSidebar";
import { Bot, Code2, Lock, Maximize2, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/role";

const CHAT_CODE_URL =
  process.env.NEXT_PUBLIC_VSCODE_WEB_CHAT_URL ??
  "/copilot-chat-ui?tkn=atlas-frankfurt-2026-9k7Q3xLp&folder=/opt/atlas-workspace-presentation";
const IDE_CODE_URL =
  process.env.NEXT_PUBLIC_VSCODE_WEB_IDE_URL ??
  "/code?tkn=atlas-frankfurt-2026-9k7Q3xLp&folder=/opt/atlas-workspace-presentation";

type Pane = "chat" | "ide" | "gemini";

function SignInGate({ label, role }: { label: string; role: "admin" | "demo" | null }) {
  const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/atlas";
  const href = `/login?next=${encodeURIComponent(next)}`;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Lock className="h-6 w-6 text-accent" />
      <div className="font-mono text-[10px] uppercase tracking-widest text-accent">{label}</div>
      <div className="text-sm text-gray-200">
        {role === "demo" ? "Sign in as admin to access this panel." : "Sign in to access this panel."}
      </div>
      <a
        href={href}
        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black transition hover:bg-accent/90"
      >
        Sign in as admin
      </a>
    </div>
  );
}

export function RightRail() {
  const role = useRole();
  const isAdmin = role === "admin";
  const [pane, setPane] = useState<Pane>("chat");
  const [reloadKey, setReloadKey] = useState(0);
  const [ideMounted, setIdeMounted] = useState(false);
  const chatIframeRef = useRef<HTMLIFrameElement | null>(null);
  const ideIframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (pane === "ide" && isAdmin) setIdeMounted(true);
  }, [isAdmin, pane]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-lg border border-line bg-panel/60 p-1 font-mono text-[10px] uppercase tracking-widest scrollbar-thin">
        <button
          onClick={() => setPane("chat")}
          className={cn(
            "flex min-w-8 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 transition",
            pane === "chat" ? "bg-accent/15 text-accent" : "text-gray-500 hover:text-gray-200",
          )}
          title="GitHub Copilot Chat only"
        >
          <Bot className="h-3 w-3 shrink-0" /> <span className="max-[380px]:hidden">Copilot</span>
        </button>
        <button
          onClick={() => setPane("ide")}
          className={cn(
            "flex min-w-8 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 transition",
            pane === "ide" ? "bg-accent/15 text-accent" : "text-gray-500 hover:text-gray-200",
          )}
          title="Full VS Code editor"
        >
          <Code2 className="h-3 w-3 shrink-0" /> <span className="max-[380px]:hidden">IDE</span>
        </button>
        <button
          onClick={() => setPane("gemini")}
          className={cn(
            "flex min-w-8 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 transition",
            pane === "gemini" ? "bg-accent2/15 text-accent2" : "text-gray-500 hover:text-gray-200",
          )}
          title="Gemini Orchestrator"
        >
          <Sparkles className="h-3 w-3 shrink-0" /> <span className="max-[380px]:hidden">Gemini</span>
        </button>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="flex shrink-0 items-center justify-center rounded-md px-1.5 py-1.5 text-gray-500 hover:text-gray-200"
          title="Reload panel"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
        <a
          href={pane === "chat" ? CHAT_CODE_URL : IDE_CODE_URL}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center justify-center rounded-md px-1.5 py-1.5 text-gray-500 hover:text-gray-200"
          title="Open in a full tab"
        >
          <Maximize2 className="h-3 w-3" />
        </a>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-line bg-panel/40">
        {isAdmin ? (
          <iframe
            key={`chat-${reloadKey}`}
            ref={chatIframeRef}
            src={CHAT_CODE_URL}
            title="GitHub Copilot Chat"
            className={cn(
              "absolute inset-0 h-full w-full border-0 bg-[#0b1020] transition-opacity",
              pane === "chat" ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            allow="clipboard-read; clipboard-write; fullscreen; cross-origin-isolated"
          />
        ) : pane === "chat" ? (
          <SignInGate label="GitHub Copilot Chat" role={role} />
        ) : null}

        {isAdmin && ideMounted ? (
          <iframe
            key={`ide-${reloadKey}`}
            ref={ideIframeRef}
            src={IDE_CODE_URL}
            title="VS Code Web IDE"
            className={cn(
              "absolute inset-0 h-full w-full border-0 bg-[#0b1020] transition-opacity",
              pane === "ide" ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            allow="clipboard-read; clipboard-write; fullscreen; cross-origin-isolated"
          />
        ) : pane === "ide" && !isAdmin ? (
          <SignInGate label="VS Code IDE" role={role} />
        ) : null}

        <div className={cn("absolute inset-0", pane === "gemini" ? "block" : "hidden")}>
          <AgentSidebar />
        </div>
      </div>
    </div>
  );
}



