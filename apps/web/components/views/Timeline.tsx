"use client";

import type { NormalizedSession } from "@crafter/jsonl-debug-core";
import {
  type AssistantTurn,
  type GroupedTurn,
  type UserMessage,
  groupTurns,
  costForUsage,
  priceFor,
} from "@crafter/jsonl-debug-core/analyze";
import { Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useSessionStore } from "@/lib/store";
import { ToolCard } from "./timeline/ToolCard";

type RoleFilter = "all" | "user" | "assistant";

export function Timeline({ session }: { session: NormalizedSession }) {
  const grouped = useMemo(() => groupTurns(session), [session]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [activeTurn, setActiveTurn] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return grouped.filter((g) => {
      if (roleFilter !== "all" && g.kind !== roleFilter) return false;
      if (!q) return true;
      return turnMatches(g, q);
    });
  }, [grouped, query, roleFilter]);

  const assistantIdxs = useMemo(
    () =>
      filtered
        .map((g, i) => (g.kind === "assistant" ? i : -1))
        .filter((i): i is number => i >= 0),
    [filtered],
  );

  const jump = useCallback(
    (delta: number) => {
      if (assistantIdxs.length === 0) return;
      const next = Math.min(
        Math.max(0, activeTurn + delta),
        assistantIdxs.length - 1,
      );
      setActiveTurn(next);
      virtuosoRef.current?.scrollToIndex({
        index: assistantIdxs[next]!,
        align: "start",
        behavior: "smooth",
      });
    },
    [activeTurn, assistantIdxs],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA")) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        jump(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        jump(-1);
      } else if (e.key === "g") {
        virtuosoRef.current?.scrollToIndex({ index: 0, behavior: "smooth" });
        setActiveTurn(0);
      } else if (e.key === "G") {
        virtuosoRef.current?.scrollToIndex({
          index: filtered.length - 1,
          behavior: "smooth",
        });
        setActiveTurn(assistantIdxs.length - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jump, filtered.length, assistantIdxs.length]);

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="px-6 h-12 border-b border-border flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[16rem] max-w-xl">
          <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search content, tool names, paths"
            className="w-full pl-9 pr-9 h-8 rounded-md border border-border bg-card text-[13px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5 text-[11px] font-mono">
          {(["all", "user", "assistant"] as RoleFilter[]).map((r) => {
            const active = roleFilter === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-2.5 h-7 rounded-md transition-colors uppercase tracking-wider ${
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
        <span className="text-[11px] text-muted-foreground ml-auto tabular-nums font-mono">
          turn{" "}
          <span className="text-foreground font-medium">
            {assistantIdxs.length === 0 ? 0 : activeTurn + 1}
          </span>
          <span className="text-muted-foreground/40"> / </span>
          {assistantIdxs.length}
          <span className="hidden md:inline ml-3 text-muted-foreground/60">
            j/k · ↑↓ · g/G
          </span>
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <Virtuoso
          ref={virtuosoRef}
          data={filtered}
          itemContent={(i, turn) => (
            <TurnCard
              turn={turn}
              isActive={
                turn.kind === "assistant" && i === assistantIdxs[activeTurn]
              }
            />
          )}
          increaseViewportBy={400}
        />
      </div>
    </div>
  );
}

function TurnCard({ turn, isActive }: { turn: GroupedTurn; isActive: boolean }) {
  if (turn.kind === "user") return <UserCard msg={turn} />;
  return <AssistantCard turn={turn} isActive={isActive} />;
}

function UserCard({ msg }: { msg: UserMessage }) {
  const setSelected = useSessionStore((s) => s.setSelected);
  const selected = useSessionStore((s) => s.selectedUuid === msg.uuid);
  return (
    <div
      className={`px-6 py-4 border-b border-border/50 transition-colors ${
        selected ? "bg-card" : ""
      }`}
    >
      <div className="flex items-start gap-3 max-w-5xl mx-auto">
        <RolePill role="user" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 text-[11px] text-muted-foreground font-mono tabular-nums">
            <span>{formatTime(msg.ts)}</span>
            {msg.isImage && <span>[image]</span>}
          </div>
          <div className="mt-1.5 text-[14px] text-foreground/95 whitespace-pre-wrap break-words leading-relaxed">
            {msg.text}
          </div>
          <button
            type="button"
            onClick={() => setSelected(selected ? null : msg.uuid)}
            className="mt-2 text-[10px] text-muted-foreground hover:text-foreground font-mono uppercase tracking-wider"
          >
            {selected ? "hide raw" : "show raw"}
          </button>
          {selected && (
            <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted/40 p-2.5 text-[11px] font-mono">
              {JSON.stringify(msg.raw, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function AssistantCard({ turn, isActive }: { turn: AssistantTurn; isActive: boolean }) {
  const setSelected = useSessionStore((s) => s.setSelected);
  const selected = useSessionStore((s) => s.selectedUuid === turn.uuid);
  const cost = useMemo(
    () => (turn.usage ? costForUsage(turn.usage, priceFor(turn.model)) : 0),
    [turn.usage, turn.model],
  );

  return (
    <div
      className={`px-6 py-4 border-b border-border/50 transition-colors ${
        isActive ? "bg-card ring-1 ring-ring/30 ring-inset" : ""
      }`}
    >
      <div className="flex items-start gap-3 max-w-5xl mx-auto">
        <RolePill role="assistant" sidechain={turn.isSidechain} />
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-baseline gap-x-3 gap-y-1 text-[11px] text-muted-foreground flex-wrap font-mono tabular-nums">
            <span>{formatTime(turn.ts)}</span>
            {turn.model && (
              <span className="text-muted-foreground/80">{turn.model}</span>
            )}
            {turn.usage && (
              <span className="text-muted-foreground/80">
                {fmt(turn.usage.outputTokens)} out
                {turn.usage.cacheReadInputTokens > 0 && (
                  <span className="text-token-cache-read">
                    {" · "}
                    {fmt(turn.usage.cacheReadInputTokens)} cache
                  </span>
                )}
              </span>
            )}
            {cost > 0 && (
              <span className="text-token-output">
                ${cost.toFixed(3)}
              </span>
            )}
            {turn.stopReason &&
              turn.stopReason !== "end_turn" &&
              turn.stopReason !== "tool_use" && (
                <span className="text-accent">stop:{turn.stopReason}</span>
              )}
          </div>
          {turn.text && (
            <div className="text-[14px] text-foreground/95 whitespace-pre-wrap break-words leading-relaxed">
              {turn.text}
            </div>
          )}
          {turn.toolCalls.length > 0 && (
            <div className="space-y-1.5">
              {turn.toolCalls.map((pair) => (
                <ToolCard key={pair.toolUse.id} pair={pair} />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setSelected(selected ? null : turn.uuid)}
            className="text-[10px] text-muted-foreground hover:text-foreground font-mono uppercase tracking-wider"
          >
            {selected ? "hide raw" : "show raw"}
          </button>
          {selected && (
            <pre className="max-h-72 overflow-auto rounded-md bg-muted/40 p-2.5 text-[11px] font-mono">
              {JSON.stringify(turn.raw, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function RolePill({
  role,
  sidechain,
}: {
  role: "user" | "assistant";
  sidechain?: boolean;
}) {
  const cls =
    role === "assistant"
      ? "border-accent/40 text-accent bg-accent/5"
      : "border-token-input/40 text-token-input bg-token-input/5";
  return (
    <span
      className={`shrink-0 px-1.5 py-0.5 rounded-md border text-[9px] font-mono font-medium uppercase tracking-widest ${cls}`}
    >
      {sidechain ? "↳ " : ""}
      {role}
    </span>
  );
}

function turnMatches(g: GroupedTurn, q: string): boolean {
  if (g.kind === "user") return g.text.toLowerCase().includes(q);
  if (g.text.toLowerCase().includes(q)) return true;
  for (const pair of g.toolCalls) {
    if (pair.toolUse.name.toLowerCase().includes(q)) return true;
    try {
      if (JSON.stringify(pair.toolUse.input).toLowerCase().includes(q)) return true;
    } catch {
      // ignore
    }
    if (pair.result?.content.toLowerCase().includes(q)) return true;
  }
  return false;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmt(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
