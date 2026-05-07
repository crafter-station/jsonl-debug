import type { NormalizedEvent, NormalizedSession, TokenUsage } from "../types";

export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
}

const PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-5": { inputPerMTok: 15, outputPerMTok: 75, cacheReadPerMTok: 1.5, cacheWritePerMTok: 18.75 },
  "claude-opus-4-6": { inputPerMTok: 15, outputPerMTok: 75, cacheReadPerMTok: 1.5, cacheWritePerMTok: 18.75 },
  "claude-opus-4-7": { inputPerMTok: 15, outputPerMTok: 75, cacheReadPerMTok: 1.5, cacheWritePerMTok: 18.75 },
  "claude-sonnet-4-5": { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWritePerMTok: 3.75 },
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWritePerMTok: 3.75 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1.25 },
};

const FALLBACK: ModelPricing = PRICING["claude-sonnet-4-6"]!;

export function priceFor(model: string | undefined): ModelPricing {
  if (!model) return FALLBACK;
  const lower = model.toLowerCase();
  for (const key of Object.keys(PRICING)) {
    if (lower.includes(key)) return PRICING[key]!;
  }
  if (lower.includes("opus")) return PRICING["claude-opus-4-7"]!;
  if (lower.includes("haiku")) return PRICING["claude-haiku-4-5"]!;
  if (lower.includes("sonnet")) return PRICING["claude-sonnet-4-6"]!;
  return FALLBACK;
}

export function costForUsage(usage: TokenUsage, pricing: ModelPricing): number {
  const M = 1_000_000;
  return (
    (usage.inputTokens * pricing.inputPerMTok) / M +
    (usage.outputTokens * pricing.outputPerMTok) / M +
    (usage.cacheReadInputTokens * pricing.cacheReadPerMTok) / M +
    (usage.cacheCreationInputTokens * pricing.cacheWritePerMTok) / M
  );
}

export interface PerTurnCost {
  uuid: string;
  ts: string;
  model: string | undefined;
  usage: TokenUsage;
  costUsd: number;
}

export function perTurnCost(session: NormalizedSession): PerTurnCost[] {
  const out: PerTurnCost[] = [];
  for (const ev of session.events) {
    if (ev.role !== "assistant" || !ev.usage) continue;
    out.push({
      uuid: ev.uuid,
      ts: ev.ts,
      model: ev.model,
      usage: ev.usage,
      costUsd: costForUsage(ev.usage, priceFor(ev.model)),
    });
  }
  return out;
}

export interface SessionCostSummary {
  totalUsd: number;
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  perModel: Record<string, { tokens: number; usd: number }>;
}

export function sessionCost(session: NormalizedSession): SessionCostSummary {
  const summary: SessionCostSummary = {
    totalUsd: 0,
    totalInput: 0,
    totalOutput: 0,
    totalCacheRead: 0,
    totalCacheWrite: 0,
    perModel: {},
  };
  for (const t of perTurnCost(session)) {
    summary.totalUsd += t.costUsd;
    summary.totalInput += t.usage.inputTokens;
    summary.totalOutput += t.usage.outputTokens;
    summary.totalCacheRead += t.usage.cacheReadInputTokens;
    summary.totalCacheWrite += t.usage.cacheCreationInputTokens;
    const model = t.model ?? "unknown";
    const tokens =
      t.usage.inputTokens +
      t.usage.outputTokens +
      t.usage.cacheReadInputTokens +
      t.usage.cacheCreationInputTokens;
    if (!summary.perModel[model]) summary.perModel[model] = { tokens: 0, usd: 0 };
    summary.perModel[model].tokens += tokens;
    summary.perModel[model].usd += t.costUsd;
  }
  return summary;
}

export function _eventCost(ev: NormalizedEvent): number {
  if (!ev.usage) return 0;
  return costForUsage(ev.usage, priceFor(ev.model));
}
