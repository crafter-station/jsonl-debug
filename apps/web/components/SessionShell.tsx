"use client";

import { sessionCost } from "@crafter/jsonl-debug-core";
import { useMemo } from "react";
import { useSessionStore } from "@/lib/store";
import { CostFlame } from "./views/CostFlame";
import { Timeline } from "./views/Timeline";
import { ToolHeatmap } from "./views/ToolHeatmap";
import { Tree } from "./views/Tree";

const TABS: { id: "timeline" | "tree" | "cost" | "heatmap"; label: string; hint: string }[] = [
  { id: "timeline", label: "Timeline", hint: "every event in order" },
  { id: "tree", label: "Tree", hint: "subagent branches" },
  { id: "cost", label: "Cost flame", hint: "tokens by turn" },
  { id: "heatmap", label: "Tool heatmap", hint: "tools across time" },
];

export function SessionShell() {
  const status = useSessionStore((s) => s.status);
  const view = useSessionStore((s) => s.view);
  const setView = useSessionStore((s) => s.setView);
  const reset = useSessionStore((s) => s.reset);

  const costSummary = useMemo(() => {
    if (status.kind !== "ready") return null;
    return sessionCost(status.session);
  }, [status]);

  if (status.kind !== "ready") return null;
  const { session, fileName, sizeBytes, parseMs } = status;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="px-6 h-12 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={reset}
              className="font-mono text-[13px] font-semibold tracking-tight hover:text-accent transition-colors shrink-0"
            >
              jsonl-debug
            </button>
            <span className="text-muted-foreground/40 select-none">/</span>
            <span
              className="font-mono text-[12px] text-muted-foreground truncate"
              title={fileName}
            >
              {fileName}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-5 text-[11px] shrink-0 font-mono tabular-nums">
            <Stat label="events" value={session.events.length.toString()} />
            <Stat label="size" value={formatBytes(sizeBytes)} />
            <Stat label="parse" value={`${parseMs.toFixed(0)}ms`} />
            {costSummary && (
              <Stat label="cost" value={`$${costSummary.totalUsd.toFixed(2)}`} highlight />
            )}
          </div>
        </div>
        <nav className="px-4 flex gap-0 border-t border-border/60">
          {TABS.map((tab) => {
            const active = view === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`relative px-3 h-10 text-[13px] transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="font-medium">{tab.label}</span>
                <span className="ml-2 text-[11px] text-muted-foreground/60 hidden sm:inline font-mono">
                  {tab.hint}
                </span>
                {active && (
                  <span
                    className="absolute inset-x-3 -bottom-px h-px bg-foreground"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </nav>
      </header>
      <div className="flex-1 min-h-0">
        {view === "timeline" && <Timeline session={session} />}
        {view === "tree" && <Tree session={session} />}
        {view === "cost" && <CostFlame session={session} />}
        {view === "heatmap" && <ToolHeatmap session={session} />}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px]">
        {label}
      </span>
      <span
        className={highlight ? "text-accent font-medium" : "text-foreground font-medium"}
      >
        {value}
      </span>
    </span>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}
