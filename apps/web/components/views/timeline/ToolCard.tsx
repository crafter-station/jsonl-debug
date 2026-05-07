"use client";

import type { ToolCallPair } from "@crafter/jsonl-debug-core/analyze";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { useState } from "react";

export function ToolCard({ pair }: { pair: ToolCallPair }) {
  const [open, setOpen] = useState(false);
  const { toolUse, result } = pair;
  const hasError = result?.isError ?? false;
  const headline = renderHeadline(toolUse.name, toolUse.input);

  return (
    <div className="rounded-md border border-border bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-2 px-2.5 py-1.5 text-left hover:bg-muted/40 transition-colors"
      >
        {open ? (
          <ChevronDown className="size-3 mt-[5px] shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 mt-[5px] shrink-0 text-muted-foreground" />
        )}
        <span
          className={`shrink-0 mt-[2px] font-mono text-[10px] uppercase tracking-widest font-semibold ${
            hasError ? "text-accent" : "text-foreground/70"
          }`}
        >
          {toolUse.name}
          {hasError && <AlertTriangle className="inline ml-1 size-3" />}
        </span>
        <span className="flex-1 min-w-0 font-mono text-[12px] leading-relaxed text-foreground/85 break-all line-clamp-2">
          {headline}
        </span>
      </button>
      {open && (
        <div className="border-t border-border/60 p-3 space-y-3 bg-background/40">
          <DetailedInput name={toolUse.name} input={toolUse.input} />
          {result && (
            <div>
              <div
                className={`text-[10px] uppercase tracking-wide mb-1 ${
                  hasError ? "text-accent" : "text-muted-foreground"
                }`}
              >
                {hasError ? "result (error)" : "result"}
              </div>
              <pre className="text-[12px] leading-relaxed font-mono whitespace-pre-wrap break-words max-h-72 overflow-auto rounded-md bg-muted/40 p-2.5">
                {result.content || "(empty)"}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderHeadline(name: string, input: unknown): string {
  if (input == null || typeof input !== "object") {
    return typeof input === "string" ? input.slice(0, 200) : "";
  }
  const i = input as Record<string, unknown>;
  switch (name) {
    case "Bash":
      return clip(asStr(i.command));
    case "Edit":
      return `${asStr(i.file_path)} · ${truncate(asStr(i.old_string), 50)} → ${truncate(asStr(i.new_string), 50)}`;
    case "Write":
      return `${asStr(i.file_path)} (${approxBytes(asStr(i.content))})`;
    case "Read":
      return i.offset !== undefined
        ? `${asStr(i.file_path)} : ${i.offset}+${i.limit ?? "?"}`
        : asStr(i.file_path);
    case "Glob":
      return asStr(i.pattern);
    case "Grep":
      return `${asStr(i.pattern)}${i.path ? `  in  ${asStr(i.path)}` : ""}`;
    case "WebFetch":
      return `${asStr(i.url)} — ${truncate(asStr(i.prompt), 80)}`;
    case "WebSearch":
      return clip(asStr(i.query));
    case "Skill":
      return `${asStr(i.skill)} ${truncate(asStr(i.args), 80)}`;
    case "ToolSearch":
      return clip(asStr(i.query));
    case "Task": {
      const subtype = asStr(i.subagent_type);
      const desc = asStr(i.description);
      return `${subtype ? `[${subtype}] ` : ""}${truncate(desc, 100)}`;
    }
    case "TaskCreate":
      return clip(asStr(i.subject));
    case "TaskUpdate":
      return `#${asStr(i.taskId)} → ${asStr(i.status) || asStr(i.description)}`;
    case "AskUserQuestion": {
      const qs = i.questions;
      if (Array.isArray(qs) && qs[0] && typeof qs[0] === "object") {
        return clip(asStr((qs[0] as Record<string, unknown>).question));
      }
      return "(question)";
    }
    case "MultiEdit":
      return `${asStr(i.file_path)} · ${Array.isArray(i.edits) ? i.edits.length : "?"} edits`;
    default: {
      try {
        const s = JSON.stringify(input);
        return s.length > 200 ? `${s.slice(0, 197)}…` : s;
      } catch {
        return "";
      }
    }
  }
}

function DetailedInput({ name, input }: { name: string; input: unknown }) {
  if (input == null || typeof input !== "object") {
    return <RawJson value={input} />;
  }
  const i = input as Record<string, unknown>;
  switch (name) {
    case "Bash":
      return (
        <Field label="command" mono>
          {asStr(i.command)}
          {i.description ? (
            <div className="mt-1 text-[11px] text-muted-foreground italic">{asStr(i.description)}</div>
          ) : null}
        </Field>
      );
    case "Write":
      return (
        <>
          <Field label="path" mono>
            {asStr(i.file_path)}
          </Field>
          <Field label="content" mono>
            <pre className="whitespace-pre-wrap break-words text-[11px] max-h-72 overflow-auto">
              {asStr(i.content)}
            </pre>
          </Field>
        </>
      );
    case "Edit":
      return (
        <>
          <Field label="path" mono>
            {asStr(i.file_path)}
          </Field>
          <Field label="-" mono>
            <pre className="whitespace-pre-wrap break-words text-[11px] max-h-48 overflow-auto text-accent/90">
              {asStr(i.old_string)}
            </pre>
          </Field>
          <Field label="+" mono>
            <pre className="whitespace-pre-wrap break-words text-[11px] max-h-48 overflow-auto text-token-cache-read">
              {asStr(i.new_string)}
            </pre>
          </Field>
        </>
      );
    case "WebFetch":
      return (
        <>
          <Field label="url" mono>
            {asStr(i.url)}
          </Field>
          <Field label="prompt" mono>
            <pre className="whitespace-pre-wrap break-words text-[11px]">{asStr(i.prompt)}</pre>
          </Field>
        </>
      );
    default:
      return <RawJson value={input} />;
  }
}

function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</div>
      <div className={`${mono ? "font-mono" : ""} text-[12px] leading-relaxed`}>{children}</div>
    </div>
  );
}

function RawJson({ value }: { value: unknown }) {
  return (
    <pre className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words max-h-72 overflow-auto rounded-md bg-muted/40 p-2.5">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function asStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

function clip(s: string, n = 200): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function approxBytes(s: string): string {
  const b = s.length;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
