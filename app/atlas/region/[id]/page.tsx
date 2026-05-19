"use client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RegionConfigurator } from "@/components/atlas/RegionConfigurator";

export default function RegionPage() {
  const params = useParams<{ id: string }>();
  const regionId = (params?.id ?? "").toLowerCase();
  const router = useRouter();
  return (
    <main className="h-screen p-3">
      <div className="flex h-full flex-col rounded-xl border border-line bg-bg/50">
        <div className="flex items-center gap-3 border-b border-line/60 px-4 py-2">
          <Link href="/atlas" className="flex items-center gap-1 rounded-md border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-gray-300 hover:border-accent hover:text-accent">
            <ArrowLeft className="h-3 w-3" /> globe
          </Link>
          <div className="font-mono text-[10px] uppercase tracking-widest text-accent">
            Region · {regionId.toUpperCase()}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <RegionConfigurator regionId={regionId} onClose={() => router.push("/atlas")} variant="page" />
        </div>
      </div>
    </main>
  );
}
