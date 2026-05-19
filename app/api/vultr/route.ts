// app/api/vultr/route.ts — multiplexed Vultr proxy
import { NextResponse } from "next/server";
import { createInference, createInstance, destroyInstance, destroyService, fleetSnapshot, rebootInstance, startInstance, stopInstance, VultrApiError } from "@/lib/vultr";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function redactForDemo(snap: any) {
  const inst = (snap.instances ?? []).map((i: any) => ({
    ...i,
    main_ip: i.main_ip ? "•••.•••.•••.•••" : i.main_ip,
    label: i.label,
  }));
  const services = (snap.services ?? []).map((s: any) => ({
    ...s,
    endpoint: s.endpoint ? "hidden in demo" : s.endpoint,
    raw: undefined,
  }));
  return { ...snap, instances: inst, services };
}

export async function GET() {
  try {
    const session = await getSession();
    const snap = await fleetSnapshot();
    return NextResponse.json(session?.role === "demo" ? redactForDemo(snap) : snap);
  } catch (e: any) {
    if (e instanceof VultrApiError) {
      return NextResponse.json({ error: e.message, vultr_status: e.status }, { status: e.status });
    }
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (session?.role === "demo") {
      return NextResponse.json(
        { error: "demo session is read-only — sign in as admin to perform operations" },
        { status: 403 },
      );
    }
    const body = await req.json();
    const action = body?.action as string;
    switch (action) {
      case "create_instance": {
        const rawBackups = body.backups;
        const backups: "enabled" | "disabled" | undefined =
          typeof rawBackups === "string"
            ? (rawBackups === "enabled" ? "enabled" : "disabled")
            : typeof rawBackups === "boolean"
              ? (rawBackups ? "enabled" : "disabled")
              : undefined;
        const r = await createInstance({
          region: body.region,
          plan: body.plan,
          os_id: body.os_id,
          app_id: body.app_id,
          image_id: body.image_id,
          snapshot_id: body.snapshot_id,
          iso_id: body.iso_id,
          label: body.label ?? "atlas-instance",
          hostname: body.hostname,
          enable_ipv6: body.enable_ipv6,
          backups,
          ddos_protection: body.ddos_protection,
          sshkey_id: body.sshkey_id,
          user_data: body.user_data,
          tags: body.tags,
        });
        return NextResponse.json({ ok: true, instance: r });
      }
      case "create_inference": {
        const r = await createInference({ label: body.label ?? "atlas-inference" });
        return NextResponse.json({ ok: true, subscription: r });
      }
      case "destroy_instance":
        await destroyInstance(body.id);
        return NextResponse.json({ ok: true });
      case "destroy_service":
        await destroyService(body.kind, body.id);
        return NextResponse.json({ ok: true });
      case "reboot_instance":
        await rebootInstance(body.id);
        return NextResponse.json({ ok: true });
      case "start_instance":
        await startInstance(body.id);
        return NextResponse.json({ ok: true });
      case "stop_instance":
        await stopInstance(body.id);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
    }
  } catch (e: any) {
    // Preserve upstream Vultr HTTP status (404/409/etc.) instead of a generic 500
    // so the cart UI + browser devtools surface a precise signal. Vultr's
    // "Server is currently locked" / "already pending destruction" arrive here
    // as 500 from Vultr and stay 500; client-side errors stay accurate.
    if (e instanceof VultrApiError) {
      let body: unknown;
      try { body = JSON.parse(e.body); } catch { body = e.body; }
      const message =
        (typeof body === "object" && body && "error" in body && typeof (body as any).error === "string"
          ? (body as any).error
          : undefined) ?? e.message;
      return NextResponse.json({ error: message, vultr_status: e.status, path: e.path }, { status: e.status });
    }
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
