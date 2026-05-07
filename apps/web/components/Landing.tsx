"use client";

import { useSessionStore } from "@/lib/store";
import { DropZone } from "./DropZone";
import { LoadingState } from "./LoadingState";

export function Landing() {
  const status = useSessionStore((s) => s.status);

  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <header className="mb-12">
        <h1 className="text-4xl font-semibold tracking-tight">jsonl-debug</h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-xl">
          Forensic visualization for Claude Code, Codex, and Pi agent sessions. The views an LLM
          cannot give you on its own.
        </p>
      </header>

      {status.kind === "idle" && <DropZone />}
      {status.kind === "loading" && <LoadingState />}
      {status.kind === "error" && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="text-base font-medium">Could not parse that file.</div>
          <div className="text-sm text-muted-foreground mt-2">{status.message}</div>
          <button
            type="button"
            onClick={() => useSessionStore.getState().reset()}
            className="mt-6 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Try another file
          </button>
        </div>
      )}

      <FindFile />
    </main>
  );
}

function FindFile() {
  return (
    <section className="mt-16 rounded-2xl border border-border bg-card p-6 text-sm">
      <h2 className="font-medium mb-3">How do I find the .jsonl on my computer?</h2>
      <dl className="space-y-3 text-muted-foreground">
        <div>
          <dt className="font-medium text-foreground">Claude Code</dt>
          <dd>
            <code className="text-xs">~/.claude/projects/&lt;project&gt;/&lt;session&gt;.jsonl</code>
            <div className="text-xs mt-1">
              The project slug is the absolute path with <code>/</code> replaced by <code>-</code>.
            </div>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">OpenAI Codex</dt>
          <dd>
            <code className="text-xs">
              ~/.codex/sessions/&lt;YYYY&gt;/&lt;MM&gt;/&lt;DD&gt;/rollout-*.jsonl
            </code>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Pi Coding Agent</dt>
          <dd>
            <code className="text-xs">~/.pi/agent/sessions/</code>
          </dd>
        </div>
      </dl>
    </section>
  );
}
