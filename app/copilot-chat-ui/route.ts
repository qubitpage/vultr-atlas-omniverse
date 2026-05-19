import { requireRole } from "@/lib/auth";

const CHAT_ONLY_CSS = `<style id="atlas-server-chat-only">
.monaco-workbench,.monaco-workbench .part{background:#0b1020!important}
.monaco-workbench .part.titlebar,.monaco-workbench .part.activitybar,.monaco-workbench .part.statusbar,.monaco-workbench .part.sidebar,.monaco-workbench .part.panel,.monaco-workbench .part.banner,.monaco-workbench .part.editor{display:none!important}
.monaco-workbench .part.auxiliarybar{position:fixed!important;inset:0!important;width:100vw!important;max-width:100vw!important;min-width:100vw!important;height:100vh!important;border:0!important;z-index:5!important}
.monaco-workbench .part.auxiliarybar .composite.title{background:transparent!important;border-bottom:1px solid #1c2440!important}
.monaco-workbench .part.auxiliarybar,.monaco-workbench .part.auxiliarybar .content,.monaco-workbench .part.auxiliarybar .composite,.monaco-workbench .part.auxiliarybar .monaco-pane-view,.monaco-workbench .part.auxiliarybar .monaco-split-view2,.monaco-workbench .part.auxiliarybar .monaco-scrollable-element,.monaco-workbench .part.auxiliarybar .split-view-container,.monaco-workbench .part.auxiliarybar .split-view-view,.monaco-workbench .part.auxiliarybar .pane,.monaco-workbench .part.auxiliarybar .pane-body,.monaco-workbench .part.auxiliarybar .chat-controls-container,.monaco-workbench .part.auxiliarybar .interactive-session{left:0!important;right:0!important;width:100%!important;min-width:100%!important;max-width:100%!important}
.monaco-workbench .part.auxiliarybar .interactive-session{height:calc(100vh - 36px)!important}
.monaco-workbench .part.auxiliarybar .interactive-input-part,.monaco-workbench .part.auxiliarybar .interactive-input-and-side-toolbar,.monaco-workbench .part.auxiliarybar .interactive-input-and-execute-toolbar,.monaco-workbench .part.auxiliarybar .interactive-input-part .monaco-editor,.monaco-workbench .part.auxiliarybar .interactive-input-part textarea{width:calc(100% - 24px)!important;min-width:0!important;max-width:calc(100% - 24px)!important}
.monaco-workbench .part.auxiliarybar .interactive-input-part{align-self:stretch!important;margin-left:12px!important;margin-right:12px!important}
::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:#1c2440;border-radius:8px}
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
  const html = await response.text();
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
