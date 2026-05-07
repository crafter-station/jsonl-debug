import type {
  ContentBlock,
  NormalizedEvent,
  NormalizedSession,
  TextBlock,
  ToolResultBlock,
  ToolUseBlock,
} from "../types";

export interface UserMessage {
  kind: "user";
  uuid: string;
  ts: string;
  text: string;
  isImage: boolean;
  raw: unknown;
}

export interface ToolCallPair {
  toolUse: ToolUseBlock;
  result?: ToolResultBlock;
  resultEventUuid?: string;
  resultTs?: string;
}

export interface AssistantTurn {
  kind: "assistant";
  uuid: string;
  ts: string;
  model?: string;
  text: string;
  toolCalls: ToolCallPair[];
  usage?: NormalizedEvent["usage"];
  stopReason?: string | null;
  isSidechain: boolean;
  raw: unknown;
}

export type GroupedTurn = UserMessage | AssistantTurn;

export function groupTurns(session: NormalizedSession): GroupedTurn[] {
  const resultsByToolUseId = new Map<string, { block: ToolResultBlock; eventUuid: string; ts: string }>();
  for (const ev of session.events) {
    for (const block of ev.content) {
      if (block.type === "tool_result") {
        resultsByToolUseId.set(block.toolUseId, { block, eventUuid: ev.uuid, ts: ev.ts });
      }
    }
  }

  const out: GroupedTurn[] = [];
  for (const ev of session.events) {
    if (ev.role === "user") {
      const text = ev.content
        .filter((b): b is TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      const isImage = ev.content.some((b) => b.type === "image");
      if (!text && !isImage) continue;
      out.push({
        kind: "user",
        uuid: ev.uuid,
        ts: ev.ts,
        text,
        isImage,
        raw: ev.raw,
      });
    } else if (ev.role === "assistant") {
      const text = ev.content
        .filter((b): b is TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      const toolUses = ev.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
      const toolCalls: ToolCallPair[] = toolUses.map((toolUse) => {
        const r = resultsByToolUseId.get(toolUse.id);
        return r
          ? { toolUse, result: r.block, resultEventUuid: r.eventUuid, resultTs: r.ts }
          : { toolUse };
      });
      out.push({
        kind: "assistant",
        uuid: ev.uuid,
        ts: ev.ts,
        model: ev.model,
        text,
        toolCalls,
        usage: ev.usage,
        stopReason: ev.stopReason,
        isSidechain: ev.isSidechain,
        raw: ev.raw,
      });
    }
  }
  return out;
}

export function summarizeContent(blocks: ContentBlock[]): string {
  for (const block of blocks) {
    if (block.type === "text" && block.text.trim()) return block.text.slice(0, 220);
    if (block.type === "tool_use") return `${block.name}(...)`;
    if (block.type === "tool_result") return block.content.split("\n")[0] ?? "";
  }
  return "(empty)";
}
