import type { NormalizedEvent, NormalizedSession } from "../types";

export type AnomalyKind =
  | "long_latency"
  | "non_end_turn"
  | "tool_error"
  | "model_swap"
  | "huge_output";

export interface Anomaly {
  kind: AnomalyKind;
  uuid: string;
  ts: string;
  detail: string;
}

const LATENCY_THRESHOLD_MS = 30_000;
const HUGE_OUTPUT_TOKENS = 4000;

export function detectAnomalies(session: NormalizedSession): Anomaly[] {
  const out: Anomaly[] = [];
  let lastModel: string | undefined;
  let prevTs: number | undefined;

  for (const ev of session.events) {
    const ts = new Date(ev.ts).getTime();
    if (ev.role === "assistant") {
      if (ev.stopReason && ev.stopReason !== "end_turn" && ev.stopReason !== "tool_use") {
        out.push({
          kind: "non_end_turn",
          uuid: ev.uuid,
          ts: ev.ts,
          detail: `stop_reason=${ev.stopReason}`,
        });
      }
      if (ev.usage && ev.usage.outputTokens > HUGE_OUTPUT_TOKENS) {
        out.push({
          kind: "huge_output",
          uuid: ev.uuid,
          ts: ev.ts,
          detail: `${ev.usage.outputTokens} output tokens`,
        });
      }
      if (ev.model && lastModel && ev.model !== lastModel) {
        out.push({
          kind: "model_swap",
          uuid: ev.uuid,
          ts: ev.ts,
          detail: `${lastModel} -> ${ev.model}`,
        });
      }
      if (ev.model) lastModel = ev.model;
    }

    for (const block of ev.content) {
      if (block.type === "tool_result" && block.isError) {
        out.push({
          kind: "tool_error",
          uuid: ev.uuid,
          ts: ev.ts,
          detail: block.content.slice(0, 120),
        });
      }
    }

    if (prevTs !== undefined && ts - prevTs > LATENCY_THRESHOLD_MS && ev.role === "assistant") {
      out.push({
        kind: "long_latency",
        uuid: ev.uuid,
        ts: ev.ts,
        detail: `${Math.round((ts - prevTs) / 1000)}s gap`,
      });
    }
    prevTs = ts;
  }
  return out;
}
