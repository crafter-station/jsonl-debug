"use client";

import type { NormalizedSession } from "@crafter/jsonl-debug-core";
import { toolFrequency, toolHeatmap } from "@crafter/jsonl-debug-core/analyze";
import { useMemo, useState } from "react";

const BUCKETS = 32;

export function ToolHeatmap({ session }: { session: NormalizedSession }) {
  const heatmap = useMemo(() => toolHeatmap(session, BUCKETS), [session]);
  const freq = useMemo(() => toolFrequency(session), [session]);
  const [hover, setHover] = useState<{ tool: string; bucket: number } | null>(null);

  if (heatmap.tools.length === 0) {
    return (
      <div className="px-6 py-12 text-sm text-muted-foreground">
        No tool calls in this session.
      </div>
    );
  }

  const sortedTools = [...heatmap.tools].sort((a, b) => {
    const ca = freq.find((f) => f.name === a)?.count ?? 0;
    const cb = freq.find((f) => f.name === b)?.count ?? 0;
    return cb - ca;
  });

  const totalCalls = freq.reduce((s, f) => s + f.count, 0);
  const totalErrors = freq.reduce((s, f) => s + f.errorCount, 0);

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="tool calls" value={totalCalls.toString()} />
        <Stat label="distinct tools" value={heatmap.tools.length.toString()} />
        <Stat label="errors" value={totalErrors.toString()} highlight={totalErrors > 0} />
        <Stat label="time buckets" value={BUCKETS.toString()} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-xs text-muted-foreground mb-4">
          Each row is one tool. Each column is a slice of session time.
        </div>
        <div className="overflow-x-auto">
          <div className="inline-grid gap-px" style={{ gridTemplateColumns: `8rem repeat(${BUCKETS}, minmax(14px, 1fr))` }}>
            {sortedTools.map((tool) => {
              const total = freq.find((f) => f.name === tool)?.count ?? 0;
              const errors = freq.find((f) => f.name === tool)?.errorCount ?? 0;
              return (
                <FragmentRow
                  key={tool}
                  tool={tool}
                  total={total}
                  errors={errors}
                  buckets={heatmap.buckets}
                  maxCount={heatmap.maxCount}
                  onHover={(bucket) => setHover({ tool, bucket })}
                  onLeave={() => setHover(null)}
                />
              );
            })}
            <div />
            {Array.from({ length: BUCKETS }).map((_, i) => (
              <div
                key={`tick-${i.toString()}`}
                className="h-3 text-[9px] text-muted-foreground/60 text-center tabular-nums"
              >
                {i % 4 === 0 ? i + 1 : ""}
              </div>
            ))}
          </div>
        </div>
        {hover && (
          <div className="mt-4 text-xs text-muted-foreground">
            <span className="text-foreground font-medium">{hover.tool}</span>
            <span> in slice {hover.bucket + 1}: </span>
            <span className="text-foreground font-medium tabular-nums">
              {heatmap.buckets[hover.bucket]?.byTool[hover.tool] ?? 0}
            </span>
            <span> calls</span>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-xs text-muted-foreground mb-3">Top tools by call count</div>
        <ol className="space-y-2 text-sm">
          {freq.slice(0, 10).map((f) => {
            const pct = totalCalls > 0 ? (f.count / totalCalls) * 100 : 0;
            return (
              <li key={f.name} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3">
                <span className="font-medium truncate">{f.name}</span>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: f.errorCount > 0 ? "var(--accent)" : "var(--color-token-output)",
                    }}
                  />
                </div>
                <span className="text-right tabular-nums text-muted-foreground">
                  {f.count}
                  {f.errorCount > 0 && (
                    <span className="text-accent"> ({f.errorCount}e)</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function FragmentRow({
  tool,
  total,
  errors,
  buckets,
  maxCount,
  onHover,
  onLeave,
}: {
  tool: string;
  total: number;
  errors: number;
  buckets: ReturnType<typeof toolHeatmap>["buckets"];
  maxCount: number;
  onHover: (bucket: number) => void;
  onLeave: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between pr-2 text-xs">
        <span className="truncate font-medium">{tool}</span>
        <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
          {total}
          {errors > 0 && <span className="text-accent">·{errors}e</span>}
        </span>
      </div>
      {buckets.map((b, i) => {
        const count = b.byTool[tool] ?? 0;
        const intensity = count === 0 ? 0 : Math.min(1, 0.18 + 0.82 * (count / maxCount));
        return (
          <div
            key={`${tool}-${i.toString()}`}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={onLeave}
            className="h-5 rounded-[3px] transition-transform hover:scale-110"
            style={{
              background:
                count === 0
                  ? "transparent"
                  : `color-mix(in oklch, var(--color-token-output) ${Math.round(intensity * 100)}%, transparent)`,
              border: count === 0 ? "1px solid var(--border)" : "none",
            }}
            title={count === 0 ? "" : `${count} calls`}
          />
        );
      })}
    </>
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
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold tabular-nums ${
          highlight ? "text-accent" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
