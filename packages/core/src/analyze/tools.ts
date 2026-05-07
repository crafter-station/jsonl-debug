import type { NormalizedEvent, NormalizedSession } from "../types";

export interface ToolFrequency {
  name: string;
  count: number;
  errorCount: number;
}

export function toolFrequency(session: NormalizedSession): ToolFrequency[] {
  const counts = new Map<string, ToolFrequency>();
  const errorByToolUseId = new Map<string, boolean>();

  for (const ev of session.events) {
    for (const block of ev.content) {
      if (block.type === "tool_result" && block.isError) {
        errorByToolUseId.set(block.toolUseId, true);
      }
    }
  }

  for (const ev of session.events) {
    for (const block of ev.content) {
      if (block.type !== "tool_use") continue;
      const existing = counts.get(block.name) ?? { name: block.name, count: 0, errorCount: 0 };
      existing.count += 1;
      if (errorByToolUseId.get(block.id)) existing.errorCount += 1;
      counts.set(block.name, existing);
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

export interface ToolCallRecord {
  turnIndex: number;
  ts: string;
  uuid: string;
  toolName: string;
  toolUseId: string;
  hasError: boolean;
  inputPreview: string;
}

export function flatToolCalls(session: NormalizedSession): ToolCallRecord[] {
  const out: ToolCallRecord[] = [];
  const errors = new Set<string>();
  for (const ev of session.events) {
    for (const block of ev.content) {
      if (block.type === "tool_result" && block.isError) errors.add(block.toolUseId);
    }
  }
  let assistantIndex = 0;
  for (const ev of session.events) {
    if (ev.role === "assistant") {
      for (const block of ev.content) {
        if (block.type !== "tool_use") continue;
        out.push({
          turnIndex: assistantIndex,
          ts: ev.ts,
          uuid: ev.uuid,
          toolName: block.name,
          toolUseId: block.id,
          hasError: errors.has(block.id),
          inputPreview: previewInput(block.input),
        });
      }
      assistantIndex += 1;
    }
  }
  return out;
}

function previewInput(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "string") return input.slice(0, 120);
  try {
    const s = JSON.stringify(input);
    return s.length > 120 ? `${s.slice(0, 117)}...` : s;
  } catch {
    return String(input).slice(0, 120);
  }
}

export interface HeatmapBucket {
  bucketIndex: number;
  startTs: string;
  endTs: string;
  byTool: Record<string, number>;
}

export function toolHeatmap(session: NormalizedSession, bucketCount = 24): {
  buckets: HeatmapBucket[];
  tools: string[];
  maxCount: number;
} {
  const calls = flatToolCalls(session);
  if (calls.length === 0) return { buckets: [], tools: [], maxCount: 0 };

  const tools = Array.from(new Set(calls.map((c) => c.toolName))).sort();
  const start = new Date(calls[0]!.ts).getTime();
  const end = new Date(calls[calls.length - 1]!.ts).getTime();
  const span = Math.max(end - start, 1);
  const bucketSize = span / bucketCount;

  const buckets: HeatmapBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    bucketIndex: i,
    startTs: new Date(start + i * bucketSize).toISOString(),
    endTs: new Date(start + (i + 1) * bucketSize).toISOString(),
    byTool: Object.fromEntries(tools.map((t) => [t, 0])),
  }));

  let maxCount = 0;
  for (const call of calls) {
    const t = new Date(call.ts).getTime();
    let idx = Math.floor((t - start) / bucketSize);
    if (idx >= bucketCount) idx = bucketCount - 1;
    if (idx < 0) idx = 0;
    const bucket = buckets[idx]!;
    bucket.byTool[call.toolName] = (bucket.byTool[call.toolName] ?? 0) + 1;
    if (bucket.byTool[call.toolName]! > maxCount) maxCount = bucket.byTool[call.toolName]!;
  }
  return { buckets, tools, maxCount };
}
