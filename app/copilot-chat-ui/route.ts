import { requireRole } from "@/lib/auth";

const CHAT_ONLY_CSS = `<style id="atlas-server-chat-only">
:root{color-scheme:dark!important;--atlas-chat-surface:#0b1020;--atlas-chat-input:#0f1b2e;--atlas-chat-input-soft:#112033;--atlas-chat-line:#20304f;--atlas-chat-accent:#5eead4;--vscode-editor-background:#0b1020!important;--vscode-sideBar-background:#0b1020!important;--vscode-panel-background:#0b1020!important;--vscode-foreground:#dbeafe!important;--vscode-descriptionForeground:#94a3b8!important;--vscode-input-background:#0f1b2e!important;--vscode-input-foreground:#e5f7ff!important;--vscode-input-border:#20304f!important;--vscode-button-background:#5eead4!important;--vscode-button-foreground:#020617!important;--vscode-focusBorder:#5eead4!important}
html,body,.monaco-workbench{background:#0b1020!important;color:#dbeafe!important;width:100%!important;height:100dvh!important;min-width:0!important;overflow:hidden!important}
.monaco-workbench,.monaco-workbench .part{background:#0b1020!important}
.monaco-workbench .part.titlebar,.monaco-workbench .part.activitybar,.monaco-workbench .part.statusbar,.monaco-workbench .part.sidebar,.monaco-workbench .part.panel,.monaco-workbench .part.banner,.monaco-workbench .part.editor{display:none!important}
.monaco-workbench .part.auxiliarybar{position:fixed!important;inset:0!important;width:100vw!important;max-width:100vw!important;min-width:0!important;height:100dvh!important;border:0!important;z-index:5!important}
.monaco-workbench .part.auxiliarybar .composite.title{background:#07111f!important;border-bottom:1px solid #1c2440!important;color:#5eead4!important}
.monaco-workbench .part.auxiliarybar,.monaco-workbench .part.auxiliarybar .content,.monaco-workbench .part.auxiliarybar .composite,.monaco-workbench .part.auxiliarybar .monaco-pane-view,.monaco-workbench .part.auxiliarybar .monaco-split-view2,.monaco-workbench .part.auxiliarybar .monaco-scrollable-element,.monaco-workbench .part.auxiliarybar .split-view-container,.monaco-workbench .part.auxiliarybar .split-view-view,.monaco-workbench .part.auxiliarybar .pane,.monaco-workbench .part.auxiliarybar .pane-body,.monaco-workbench .part.auxiliarybar .chat-controls-container,.monaco-workbench .part.auxiliarybar .interactive-session{left:0!important;right:0!important;width:100%!important;min-width:100%!important;max-width:100%!important}
.monaco-workbench .part.auxiliarybar .interactive-session,.monaco-workbench .part.auxiliarybar .interactive-session-editor,.monaco-workbench .part.auxiliarybar .interactive-session-list,.monaco-workbench .part.auxiliarybar .chat-list-container,.monaco-workbench .part.auxiliarybar .interactive-list{height:calc(100dvh - 42px)!important;background:#0b1020!important;color:#dbeafe!important}
.monaco-workbench .part.auxiliarybar .interactive-session .monaco-list,.monaco-workbench .part.auxiliarybar .interactive-session .monaco-list-rows,.monaco-workbench .part.auxiliarybar .interactive-session .monaco-list-row,.monaco-workbench .part.auxiliarybar .interactive-item-container,.monaco-workbench .part.auxiliarybar .chat-message,.monaco-workbench .part.auxiliarybar .chat-response,.monaco-workbench .part.auxiliarybar .interactive-response,.monaco-workbench .part.auxiliarybar .value,.monaco-workbench .part.auxiliarybar .rendered-markdown,.monaco-workbench .part.auxiliarybar p,.monaco-workbench .part.auxiliarybar span{background:#0b1020!important;color:#dbeafe!important}
.monaco-workbench .part.auxiliarybar .interactive-input-part,.monaco-workbench .part.auxiliarybar .interactive-input-and-side-toolbar,.monaco-workbench .part.auxiliarybar .interactive-input-and-execute-toolbar,.monaco-workbench .part.auxiliarybar .interactive-input-part .monaco-editor,.monaco-workbench .part.auxiliarybar .interactive-input-part textarea{width:calc(100% - 24px)!important;min-width:0!important;max-width:calc(100% - 24px)!important;background:var(--atlas-chat-input)!important;color:#e5f7ff!important}
.monaco-workbench .part.auxiliarybar .interactive-input-part,.monaco-workbench .part.auxiliarybar .chat-input-part,.monaco-workbench .part.auxiliarybar .chat-editor-container{align-self:stretch!important;margin-left:12px!important;margin-right:12px!important;border:1px solid var(--atlas-chat-line)!important;border-radius:8px!important;background:var(--atlas-chat-input)!important;box-shadow:0 0 0 1px rgba(94,234,212,.14),0 12px 30px rgba(2,6,23,.18)!important}
.monaco-workbench .part.auxiliarybar .chat-input-toolbars,.monaco-workbench .part.auxiliarybar .interactive-input-part .chat-input-toolbars,.monaco-workbench .part.auxiliarybar .chat-editor-overflow,.monaco-workbench .part.auxiliarybar .interactive-input-toolbar{background:var(--atlas-chat-input-soft)!important;border-color:var(--atlas-chat-line)!important;color:#dbeafe!important}
.monaco-workbench .part.auxiliarybar .monaco-editor,.monaco-workbench .part.auxiliarybar .monaco-editor .overflow-guard,.monaco-workbench .part.auxiliarybar .monaco-editor-background,.monaco-workbench .part.auxiliarybar .margin,.monaco-workbench .part.auxiliarybar .inputarea,.monaco-workbench .part.auxiliarybar textarea,.monaco-workbench .part.auxiliarybar .view-lines,.monaco-workbench .part.auxiliarybar .view-line{background:var(--atlas-chat-input)!important;color:#e5f7ff!important}
.monaco-workbench .part.auxiliarybar .placeholder-text,.monaco-workbench .part.auxiliarybar .monaco-placeholder{color:#7dd3fc!important}
.monaco-workbench .part.auxiliarybar a{color:#5eead4!important}
.monaco-workbench .part.auxiliarybar button,.monaco-workbench .part.auxiliarybar .monaco-button{background:#112033!important;color:#dbeafe!important;border-color:#1c2440!important}
.monaco-workbench .part.auxiliarybar .monaco-button.default,.monaco-workbench .part.auxiliarybar .codicon-send{color:#020617!important;background:#5eead4!important}
::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:#1c2440;border-radius:8px}
@media(max-width:480px){.monaco-workbench .part.auxiliarybar .composite.title{min-height:34px!important}.monaco-workbench .part.auxiliarybar .interactive-session,.monaco-workbench .part.auxiliarybar .interactive-session-editor,.monaco-workbench .part.auxiliarybar .interactive-session-list,.monaco-workbench .part.auxiliarybar .chat-list-container,.monaco-workbench .part.auxiliarybar .interactive-list{height:calc(100dvh - 34px)!important}.monaco-workbench .part.auxiliarybar .interactive-input-part,.monaco-workbench .part.auxiliarybar .chat-input-part,.monaco-workbench .part.auxiliarybar .chat-editor-container{margin-left:6px!important;margin-right:6px!important;border-radius:7px!important}.monaco-workbench .part.auxiliarybar .interactive-input-part,.monaco-workbench .part.auxiliarybar .interactive-input-and-side-toolbar,.monaco-workbench .part.auxiliarybar .interactive-input-and-execute-toolbar,.monaco-workbench .part.auxiliarybar .interactive-input-part .monaco-editor,.monaco-workbench .part.auxiliarybar .interactive-input-part textarea{width:calc(100% - 12px)!important;max-width:calc(100% - 12px)!important}}
</style>`;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const role = await requireRole();
  if (role !== "admin") {
    return Response.redirect(new URL("/login?next=/atlas", request.url));
  }

  const url = new URL(request.url);
  const upstream = new URL("http://127.0.0.1:8080/code");
  url.searchParams.forEach((value, key) => upstream.searchParams.set(key, value));

  const response = await fetch(upstream, { cache: "no-store" });
  const publicUrl = new URL(request.url);
  const publicHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "atlas.qubitpage.com";
  const publicProto = request.headers.get("x-forwarded-proto") || "https";
  const publicOrigin = `${publicProto}://${publicHost}`;
  const publicWsOrigin = `${publicProto === "https" ? "wss" : "ws"}://${publicHost}`;
  let html = await response.text();
  html = html
    .replaceAll("http://127.0.0.1:8080", publicOrigin)
    .replaceAll("https://127.0.0.1:8080", publicOrigin)
    .replaceAll("ws://127.0.0.1:8080", publicWsOrigin)
    .replaceAll("wss://127.0.0.1:8080", publicWsOrigin)
    .replaceAll("127.0.0.1:8080", publicHost)
    .replaceAll("http://localhost:3030", publicOrigin)
    .replaceAll("https://localhost:3030", publicOrigin)
    .replaceAll("ws://localhost:3030", publicWsOrigin)
    .replaceAll("wss://localhost:3030", publicWsOrigin)
    .replaceAll("localhost:3030", publicHost);
  const injected = html.includes("</head>")
    ? html.replace("</head>", `${CHAT_ONLY_CSS}</head>`)
    : `${CHAT_ONLY_CSS}${html}`;

  return new Response(injected, {
    status: response.ok ? 200 : response.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "frame-ancestors 'self' https://atlas.qubitpage.com;",
    },
  });
}
