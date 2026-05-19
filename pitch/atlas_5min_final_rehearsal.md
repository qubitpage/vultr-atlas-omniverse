# Vultr Atlas - 5 Minute Final Speech And Rehearsal Checklist

## Tested Demo URLs

- Main cockpit: https://atlas.qubitpage.com/atlas
- Embedded VS Code Web: open the right rail, then use Copilot or IDE
- Full VS Code tab: https://atlas.qubitpage.com/code?tkn=atlas-frankfurt-2026-9k7Q3xLp&folder=/opt/atlas-workspace-presentation

## Demo Order

1. Open https://atlas.qubitpage.com/atlas and sign in as admin.
2. Wait for the live fleet line: 33 regions, 7 servers, 19 resources, API green.
3. Start the speech on the left globe: only the live fleet labels should be prominent.
4. Point to the right rail: Copilot, IDE, Gemini.
5. Show Copilot first. It should load directly into VS Code Web agent chat with no trust or recommendation prompts.
6. Click IDE if you want to show the full official Microsoft VS Code editor.
7. Click Gemini and use: "Demo check only: say OK and mention Frankfurt. No write actions."

## Final Speech

Hi everyone.

This is Vultr Atlas: a live cloud management cockpit built for the AI Agent Olympics at Milan AI Week.

It is not a mockup and it is not a slide. It is running now on Vultr infrastructure, connected to the real Vultr API.

The first thing you see is the globe. Atlas turns cloud infrastructure into geography. Thirty-three Vultr regions are rendered on a real 3D Earth with continent geometry, region towers, network arcs, datacenter pins, and live fleet data. The interface shows which regions are active, where our servers are running, what resources exist, and whether the Vultr API is connected.

The point is simple: cloud operations should not feel like reading a spreadsheet. You should be able to see your infrastructure, understand it spatially, and move from global view to datacenter view without losing context.

But the important part is what sits beside the globe.

Atlas embeds the official Microsoft VS Code Web experience directly inside the platform. This is not a fake editor and not a clone. It is Microsoft's `code serve-web` running behind Atlas, mounted inside the right rail. In the same browser tab where you inspect your Vultr fleet, you can open real VS Code, use the terminal, inspect the workspace, and work with GitHub Copilot.

The workspace is preloaded for infrastructure work. It includes Atlas instructions for the agent, Vultr helper scripts, and the project context needed to operate the cockpit. So GitHub Copilot is not floating outside the product. It is sitting inside the cloud portal, next to the live globe, with the same operator context.

That gives Atlas two AI modes.

The first mode is GitHub Copilot inside VS Code. This is the code-level assistant: good for scripts, terminal workflows, infrastructure helpers, debugging, and precise edits.

The second mode is Gemini Orchestrator. In the Gemini panel, the model sees the fleet context: regions, instances, plans, status, services, and maintenance signals. It can recommend where to deploy, compare plans, explain fleet health, and produce structured proposals.

The safety rule is central: the AI proposes, the human approves.

Gemini does not directly create or destroy infrastructure. It returns structured proposals. The UI renders explicit approval controls. The backend only accepts explicit allowed actions, and demo sessions are read-only. We tested that: demo users can explore, but write operations return 403. Unknown admin actions return 400. No hidden side-effect path exists in chat.

So Atlas is not just an AI chatbot attached to a cloud API. It is a human-gated operating cockpit.

The stack is built for the hackathon providers:

Vultr powers the deployment and supplies the live infrastructure API. Atlas reads regions, plans, instances, services, status, and account resources server-side, so the API key is never exposed in the browser.

Microsoft provides the real VS Code Web layer and GitHub Copilot experience inside the product.

Google Gemini provides the reasoning layer for infrastructure recommendations and natural-language orchestration.

Speechmatics is connected in the Navigator panel for voice command workflows.

And the visual layer uses Next.js, TypeScript, Three.js, React Three Fiber, D3, and topojson to turn the live cloud into a real-time control surface.

The result is one browser tab where you can see the world, inspect your Vultr fleet, ask Gemini what to do, write or debug code with GitHub Copilot, and keep every real infrastructure change behind a human approval step.

That is Vultr Atlas.

It is a cloud cockpit for agentic infrastructure, where AI can reason and assist, but the operator remains in command.

Thank you.

## Verified Before Presentation

- Local `npm run typecheck` passes.
- Local `npm run build` passes.
- Live landing and login return 200.
- Live `/atlas` loads after admin login.
- Live `/api/vultr` returns API connected, 33 regions, 7 servers, 19 resources.
- Live `/atlas` renders a nonblank globe canvas beside the AI rail.
- Embedded VS Code Web loads without workspace trust or Copilot recommendation prompts.
- Copilot/agent chat input is visible inside VS Code Web.
- Gemini streams successfully with `gemini-2.5-flash`.
- Demo write attempts are blocked with 403.
- Unknown admin actions are rejected with 400.