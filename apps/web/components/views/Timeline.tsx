"use client";

import type {
  ContentBlock,
  NormalizedEvent,
  NormalizedSession,
} from "@crafter/jsonl-debug-core";
import { _eventCost } from "@crafter/jsonl-debug-core/analyze";
import { ChevronRight, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { useSessionStore } from "@/lib/store";

type RoleFilter = "all" | "user" | "assistant" | "tool_result" | "meta";

export function Timeline({ session }: { session: NormalizedSession }) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return session.events.filter((ev) => {
      if (roleFilter !== "all" && ev.role !== roleFilter) return false;
      if (!q) return true;
      return contentMatches(ev, q);
    });
  }, [session.events, query, roleFilter]);

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="px-6 py-3 border-b border-border flex items-center gap-3">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search content, tool names, paths"
            className="w-full pl-9 pr-9 py-2 rounded-md border border-border bg-card text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-accent/50"
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
        <div className="flex items-center gap-1 text-xs">
          {(["all", "user", "assistant", "tool_result"] as RoleFilter[]).map((r) => {
            const active = roleFilter === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-2.5 py-1.5 rounded-md transition-colors ${
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
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {session.events.length}
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <Virtuoso
          data={filtered}
          itemContent={(_, ev) => <Row event={ev} />}
          increaseViewportBy={400}
        />
      </div>
    </div>
  );
}

function Row({ event }: { event: NormalizedEvent }) {
  const selected = useSessionStore((s) => s.selectedUuid === event.uuid);
  const setSelected = useSessionStore((s) => s.setSelected);
  const summary = useMemo(() => buildSummary(event), [event]);
  const cost = useMemo(() => _eventCost(event), [event]);

  return (
    <div
      className={`group px-6 py-3 border-b border-border/60 cursor-pointer transition-colors ${
        selected ? "bg-card" : "hover:bg-card/60"
      }`}
      onClick={() => setSelected(selected ? null : event.uuid)}
    >
      <div className="flex items-start gap-3">
        <RolePill role={event.role} sidechain={event.isSidechain} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 text-xs text-muted-foreground">
            <span>{formatTime(event.ts)}</span>
            {event.model && <span className="text-muted-foreground/70">{event.model}</span>}
            {event.usage && (
              <span className="text-muted-foreground/70">
                {fmt(event.usage.outputTokens)} out
                {event.usage.cacheReadInputTokens > 0 && (
                  <span className="text-token-cache-read">
                    {" "}
                    · {fmt(event.usage.cacheReadInputTokens)} cache
                  </span>
                )}
              </span>
            )}
            {cost > 0 && (
              <span className="text-token-output">${cost.toFixed(3)}</span>
            )}
            {event.stopReason && event.stopReason !== "end_turn" && event.stopReason !== "tool_use" && (
              <span className="text-accent">stop: {event.stopReason}</span>
            )}
          </div>
          <div className="mt-1 text-sm text-foreground/90 line-clamp-2">{summary}</div>
          {selected && (
            <pre className="mt-3 max-h-[480px] overflow-auto rounded-md bg-muted/60 p-3 text-xs leading-relaxed">
              {JSON.stringify(event.raw, null, 2)}
            </pre>
          )}
        </div>
        <ChevronRight
          className={`size-4 mt-0.5 text-muted-foreground/60 transition-transform shrink-0 ${
            selected ? "rotate-90" : "group-hover:translate-x-0.5"
          }`}
        />
      </div>
    </div>
  );
}

function RolePill({ role, sidechain }: { role: NormalizedEvent["role"]; sidechain: boolean }) {
  const cls =
    role === "assistant"
      ? "bg-accent/15 text-accent"
      : role === "user"
        ? "bg-token-input/15 text-token-input"
        : role === "tool_result"
          ? "bg-token-cache-read/20 text-token-cache-read"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wide ${cls}`}
    >
      {sidechain ? "↳ " : ""}
      {role}
    </span>
  );
}

function buildSummary(ev: NormalizedEvent): string {
  for (const block of ev.content) {
    if (block.type === "text") return block.text.slice(0, 220);
    if (block.type === "tool_use") {
      return `→ ${block.name}(${previewArgs(block.input)})`;
    }
    if (block.type === "tool_result") {
      const head = block.content.split("\n")[0] ?? "";
      return `← ${head.slice(0, 220)}`;
    }
    if (block.type === "image") return "[image]";
  }
  return "(empty)";
}

function previewArgs(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "string") return input.slice(0, 80);
  try {
    const s = JSON.stringify(input);
    return s.length > 80 ? `${s.slice(0, 77)}...` : s;
  } catch {
    return "";
  }
}

function contentMatches(ev: NormalizedEvent, q: string): boolean {
  for (const block of ev.content) {
    if (block.type === "text" && block.text.toLowerCase().includes(q)) return true;
    if (block.type === "tool_use") {
      if (block.name.toLowerCase().includes(q)) return true;
      try {
        if (JSON.stringify(block.input).toLowerCase().includes(q)) return true;
      } catch {
        // ignore
      }
    }
    if (block.type === "tool_result" && block.content.toLowerCase().includes(q)) return true;
  }
  return false;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmt(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

// satisfy import
type _Block = ContentBlock;
