import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_BASE_URL = "https://asr.api.speechmatics.com/v2";
const DEFAULT_LANGUAGE = "en";

function speechmaticsKey(): string | null {
  const value = process.env.SPEECHMATICS_API_KEY?.trim();
  return value ? value : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function speechmaticsFetch(path: string, init?: RequestInit) {
  const baseUrl = (process.env.SPEECHMATICS_API_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const key = speechmaticsKey();
  if (!key) throw new Error("SPEECHMATICS_API_KEY is not configured on the Atlas server.");
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const language = String(form.get("language") || process.env.SPEECHMATICS_LANGUAGE || DEFAULT_LANGUAGE);

    if (!(audio instanceof Blob)) {
      return NextResponse.json({ error: "audio file is required" }, { status: 400 });
    }

    const jobForm = new FormData();
    jobForm.set("data_file", audio, "atlas-voice.webm");
    jobForm.set(
      "config",
      JSON.stringify({
        type: "transcription",
        transcription_config: {
          language,
          operating_point: "enhanced",
        },
      }),
    );

    const submit = await speechmaticsFetch("/jobs", { method: "POST", body: jobForm });
    if (!submit.ok) {
      return NextResponse.json(
        { error: `speechmatics submit failed: ${submit.status}`, detail: await submit.text().catch(() => "") },
        { status: submit.status },
      );
    }

    const created = (await submit.json()) as { id?: string; job?: { id?: string } };
    const jobId = created.id ?? created.job?.id;
    if (!jobId) return NextResponse.json({ error: "speechmatics did not return a job id" }, { status: 502 });

    const deadline = Date.now() + 35_000;
    let status = "running";
    while (Date.now() < deadline) {
      await sleep(1250);
      const job = await speechmaticsFetch(`/jobs/${jobId}`);
      if (!job.ok) continue;
      const body = (await job.json()) as { job?: { status?: string }; status?: string };
      status = body.job?.status ?? body.status ?? status;
      if (["done", "completed"].includes(status)) break;
      if (["rejected", "failed"].includes(status)) {
        return NextResponse.json({ error: `speechmatics job ${status}`, jobId }, { status: 502 });
      }
    }

    if (!["done", "completed"].includes(status)) {
      return NextResponse.json({ error: "speechmatics transcription timed out", jobId, status }, { status: 504 });
    }

    const transcript = await speechmaticsFetch(`/jobs/${jobId}/transcript?format=txt`);
    if (!transcript.ok) {
      return NextResponse.json(
        { error: `speechmatics transcript failed: ${transcript.status}`, detail: await transcript.text().catch(() => ""), jobId },
        { status: transcript.status },
      );
    }

    const text = (await transcript.text()).trim();
    return NextResponse.json({ ok: true, text, jobId, language });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? String(error) }, { status: 500 });
  }
}
