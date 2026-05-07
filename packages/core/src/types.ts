export type Agent = "claude-code" | "codex" | "pi";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResultBlock {
  type: "tool_result";
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export interface ImageBlock {
  type: "image";
  source: { mediaType?: string; data?: string; url?: string };
}

export interface AttachmentBlock {
  type: "attachment";
  name?: string;
  preview?: string;
}

export type ContentBlock =
  | TextBlock
  | ToolUseBlock
  | ToolResultBlock
  | ImageBlock
  | AttachmentBlock;

export type EventRole = "user" | "assistant" | "system" | "tool_result" | "meta";

export interface NormalizedEvent {
  uuid: string;
  parentUuid?: string;
  ts: string;
  role: EventRole;
  isSidechain: boolean;
  content: ContentBlock[];
  usage?: TokenUsage;
  model?: string;
  stopReason?: string | null;
  requestId?: string;
  raw: unknown;
}

export interface SessionMeta {
  cwd?: string;
  gitBranch?: string;
  version?: string;
  entrypoint?: string;
  title?: string;
}

export interface NormalizedSession {
  agent: Agent;
  sessionId: string;
  startedAt?: string;
  endedAt?: string;
  events: NormalizedEvent[];
  meta: SessionMeta;
}
