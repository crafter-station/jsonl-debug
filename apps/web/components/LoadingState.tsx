"use client";

import { useSessionStore } from "@/lib/store";

export function LoadingState() {
  const status = useSessionStore((s) => s.status);
  if (status.kind !== "loading") return null;
  const pct = status.totalBytes
    ? Math.min(100, Math.round((status.bytesRead / status.totalBytes) * 100))
    : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-12 text-center">
      <div className="text-base font-medium">Parsing {status.fileName ?? "session"}</div>
      <div className="mt-6 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 text-sm text-muted-foreground">
        {status.eventsParsed} events parsed
      </div>
    </div>
  );
}
