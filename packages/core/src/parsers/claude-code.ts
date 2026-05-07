import type {
  ContentBlock,
  EventRole,
  NormalizedEvent,
  NormalizedSession,
  SessionMeta,
  TokenUsage,
} from "../types";

interface RawEntry {
  type?: string;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  sessionId?: string;
  isSidechain?: boolean;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  entrypoint?: string;
  requestId?: string;
  message?: RawMessage;
  title?: string;
  [k: string]: unknown;
}

interface RawMessage {
  id?: string;
  role?: string;
  model?: string;
  content?: unknown;
  stop_reason?: string | null;
  usage?: RawUsage;
}

interface RawUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

function asUsage(u: RawUsage | undefined): TokenUsage | undefined {
  if (!u) return undefined;
  return {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheReadInputTokens: u.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: u.cache_creation_input_tokens ?? 0,
  };
}

function normalizeContent(raw: unknown): ContentBlock[] {
  if (typeof raw === "string") {
    return [{ type: "text", text: raw }];
  }
  if (!Array.isArray(raw)) return [];
  const blocks: ContentBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const t = r.type;
    if (t === "text" && typeof r.text === "string") {
      blocks.push({ type: "text", text: r.text });
    } else if (t === "tool_use") {
      blocks.push({
        type: "tool_use",
        id: String(r.id ?? ""),
        name: String(r.name ?? ""),
        input: r.input ?? {},
      });
    } else if (t === "tool_result") {
      const content = r.content;
      let asText = "";
      if (typeof content === "string") {
        asText = content;
      } else if (Array.isArray(content)) {
        asText = content
          .map((c) => {
            if (typeof c === "string") return c;
            if (c && typeof c === "object" && "text" in c) {
              return String((c as { text?: unknown }).text ?? "");
            }
            return "";
          })
          .join("\n");
      }
      blocks.push({
        type: "tool_result",
        toolUseId: String(r.tool_use_id ?? ""),
        content: asText,
        isError: r.is_error === true,
      });
    } else if (t === "image") {
      const src = r.source as { media_type?: string; data?: string; url?: string } | undefined;
      blocks.push({
        type: "image",
        source: {
          mediaType: src?.media_type,
          data: src?.data,
          url: src?.url,
        },
      });
    }
  }
  return blocks;
}

function roleFor(entry: RawEntry): EventRole {
  const t = entry.type;
  if (t === "user") {
    const c = entry.message?.content;
    if (Array.isArray(c) && c.some((b) => (b as { type?: string }).type === "tool_result")) {
      return "tool_result";
    }
    return "user";
  }
  if (t === "assistant") return "assistant";
  return "meta";
}

function asEvent(entry: RawEntry): NormalizedEvent | null {
  const t = entry.type;
  if (t !== "user" && t !== "assistant") return null;
  const msg = entry.message;
  if (!msg) return null;
  return {
    uuid: entry.uuid ?? crypto.randomUUID(),
    parentUuid: entry.parentUuid ?? undefined,
    ts: entry.timestamp ?? new Date().toISOString(),
    role: roleFor(entry),
    isSidechain: Boolean(entry.isSidechain),
    content: normalizeContent(msg.content),
    usage: asUsage(msg.usage),
    model: msg.model,
    stopReason: msg.stop_reason ?? null,
    requestId: entry.requestId,
    raw: entry,
  };
}

export function parseClaudeCodeLine(line: string): NormalizedEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let entry: RawEntry;
  try {
    entry = JSON.parse(trimmed) as RawEntry;
  } catch {
    return null;
  }
  return asEvent(entry);
}

export interface ParseProgress {
  bytesRead: number;
  totalBytes: number;
  eventsParsed: number;
}

export async function parseClaudeCodeStream(
  source: ReadableStream<Uint8Array> | string,
  onProgress?: (p: ParseProgress) => void,
): Promise<NormalizedSession> {
  const events: NormalizedEvent[] = [];
  const meta: SessionMeta = {};
  let sessionId = "";
  let totalBytes = 0;
  let bytesRead = 0;

  const lines = await collectLines(source, (n) => {
    bytesRead += n;
    if (onProgress) onProgress({ bytesRead, totalBytes, eventsParsed: events.length });
  });
  totalBytes = bytesRead;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry: RawEntry;
    try {
      entry = JSON.parse(trimmed) as RawEntry;
    } catch {
      continue;
    }
    if (!sessionId && entry.sessionId) sessionId = entry.sessionId;
    if (!meta.cwd && entry.cwd) meta.cwd = entry.cwd;
    if (!meta.gitBranch && entry.gitBranch) meta.gitBranch = entry.gitBranch;
    if (!meta.version && entry.version) meta.version = entry.version;
    if (!meta.entrypoint && entry.entrypoint) meta.entrypoint = entry.entrypoint;
    if (entry.type === "ai-title" && typeof entry.title === "string") {
      meta.title = entry.title;
    }
    const ev = asEvent(entry);
    if (ev) events.push(ev);
  }

  events.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

  return {
    agent: "claude-code",
    sessionId: sessionId || (events[0]?.uuid ?? "unknown"),
    startedAt: events[0]?.ts,
    endedAt: events[events.length - 1]?.ts,
    events,
    meta,
  };
}

async function collectLines(
  source: ReadableStream<Uint8Array> | string,
  onChunk: (n: number) => void,
): Promise<string[]> {
  if (typeof source === "string") {
    onChunk(source.length);
    return source.split(/\r?\n/);
  }
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const out: string[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(value.byteLength);
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split(/\r?\n/);
    buf = parts.pop() ?? "";
    for (const p of parts) out.push(p);
  }
  buf += decoder.decode();
  if (buf) out.push(buf);
  return out;
}
