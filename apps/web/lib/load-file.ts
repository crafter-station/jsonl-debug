"use client";

import { parseClaudeCodeStream } from "@crafter/jsonl-debug-core";
import { useSessionStore } from "./store";

export async function loadFile(file: File) {
  const setStatus = useSessionStore.getState().setStatus;
  setStatus({
    kind: "loading",
    bytesRead: 0,
    totalBytes: file.size,
    eventsParsed: 0,
    fileName: file.name,
  });
  try {
    const t0 = performance.now();
    const text = await file.text();
    const session = await parseClaudeCodeStream(text, (p) => {
      setStatus({
        kind: "loading",
        bytesRead: p.bytesRead,
        totalBytes: file.size,
        eventsParsed: p.eventsParsed,
        fileName: file.name,
      });
    });
    const t1 = performance.now();
    if (session.events.length === 0) {
      setStatus({ kind: "error", message: "No events parsed. Is this a Claude Code session?" });
      return;
    }
    setStatus({
      kind: "ready",
      session,
      fileName: file.name,
      sizeBytes: file.size,
      parseMs: t1 - t0,
    });
  } catch (err) {
    setStatus({
      kind: "error",
      message: err instanceof Error ? err.message : "Failed to parse file",
    });
  }
}
