"use client";

import type { NormalizedSession } from "@crafter/jsonl-debug-core";
import { perTurnCost, sessionCost } from "@crafter/jsonl-debug-core/analyze";
import { useMemo, useState } from "react";
import { useSessionStore } from "@/lib/store";

const COLORS = {
  cacheRead: "var(--color-token-cache-read)",
  cacheWrite: "var(--color-token-cache-write)",
  input: "var(--color-token-input)",
  output: "var(--color-token-output)",
};

export function CostFlame({ session }: { session: NormalizedSession }) {
  const turns = useMemo(() => perTurnCost(session), [session]);
  const summary = useMemo(() => sessionCost(session), [session]);
  const [hover, setHover] = useState<number | null>(null);
  const setSelected = useSessionStore((s) => s.setSelected);
  const setView = useSessionStore((s) => s.setView);

  if (turns.length === 0) {
    return (
      <div className="px-6 py-12 text-sm text-muted-foreground">
        No assistant turns with usage data in this session.
      </div>
    );
  }

  const maxTokens = Math.max(
    ...turns.map(
      (t) =>
        t.usage.inputTokens +
        t.usage.outputTokens +
        t.usage.cacheReadInputTokens +
        t.usage.cacheCreationInputTokens,
    ),
  );

  const hovered = hover != null ? turns[hover] : null;

  return (
    <div className="px-6 py-6 space-y-6">
      <Summary summary={summary} turnCount={turns.length} />
      <Legend />
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-xs text-muted-foreground mb-3">
          {turns.length} assistant turns. Click a bar to jump to it in the timeline.
        </div>
        <div className="relative h-72">
          <div className="absolute inset-0 flex items-end gap-px">
            {turns.map((turn, i) => {
              const total =
                turn.usage.inputTokens +
                turn.usage.outputTokens +
                turn.usage.cacheReadInputTokens +
                turn.usage.cacheCreationInputTokens;
              const heightPct = (total / maxTokens) * 100;
              const cacheReadPct =
                total > 0 ? (turn.usage.cacheReadInputTokens / total) * 100 : 0;
              const cacheWritePct =
                total > 0 ? (turn.usage.cacheCreationInputTokens / total) * 100 : 0;
              const inputPct = total > 0 ? (turn.usage.inputTokens / total) * 100 : 0;
              const outputPct = total > 0 ? (turn.usage.outputTokens / total) * 100 : 0;
              return (
                <button
                  type="button"
                  key={turn.uuid}
                  onClick={() => {
                    setSelected(turn.uuid);
                    setView("timeline");
                  }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                  className="flex-1 min-w-[3px] flex flex-col-reverse items-stretch transition-opacity hover:opacity-100"
                  style={{ height: `${heightPct}%`, opacity: hover == null || hover === i ? 1 : 0.45 }}
                  title={`Turn ${i + 1} · $${turn.costUsd.toFixed(3)} · ${total.toLocaleString()} tok`}
                >
                  <span style={{ height: `${cacheReadPct}%`, background: COLORS.cacheRead }} />
                  <span style={{ height: `${cacheWritePct}%`, background: COLORS.cacheWrite }} />
                  <span style={{ height: `${inputPct}%`, background: COLORS.input }} />
                  <span style={{ height: `${outputPct}%`, background: COLORS.output }} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
          <span>turn 1</span>
          <span>turn {turns.length}</span>
        </div>
      </div>

      {hovered && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm">
          <div className="text-xs text-muted-foreground">turn {turns.indexOf(hovered) + 1}</div>
          <div className="mt-1 font-medium">
            ${hovered.costUsd.toFixed(4)} · {hovered.model ?? "unknown model"}
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Cell color={COLORS.output} label="output" value={hovered.usage.outputTokens} />
            <Cell color={COLORS.input} label="input" value={hovered.usage.inputTokens} />
            <Cell
              color={COLORS.cacheRead}
              label="cache read"
              value={hovered.usage.cacheReadInputTokens}
            />
            <Cell
              color={COLORS.cacheWrite}
              label="cache write"
              value={hovered.usage.cacheCreationInputTokens}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({
  summary,
  turnCount,
}: {
  summary: ReturnType<typeof sessionCost>;
  turnCount: number;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <BigStat label="total cost" value={`$${summary.totalUsd.toFixed(2)}`} highlight />
      <BigStat label="turns" value={turnCount.toString()} />
      <BigStat
        label="output tokens"
        value={summary.totalOutput.toLocaleString()}
        accent="output"
      />
      <BigStat
        label="cache read"
        value={summary.totalCacheRead.toLocaleString()}
        accent="cacheRead"
      />
    </div>
  );
}

function BigStat({
  label,
  value,
  highlight,
  accent,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  accent?: keyof typeof COLORS;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold tabular-nums ${
          highlight ? "text-accent" : ""
        }`}
        style={accent ? { color: COLORS[accent] } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <Swatch color={COLORS.output} label="output" />
      <Swatch color={COLORS.input} label="input" />
      <Swatch color={COLORS.cacheWrite} label="cache write" />
      <Swatch color={COLORS.cacheRead} label="cache read" />
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-3 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Cell({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="size-2 rounded-sm" style={{ background: color }} />
        {label}
      </div>
      <div className="mt-0.5 font-medium tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}
