# jsonl-debug

Visualize and forensically debug Claude Code, OpenAI Codex, and Pi agent JSONL sessions in your browser. Sessions never leave your machine.

Goes beyond linear timeline. Shows the things an LLM cannot tell you on its own: where the budget burned, which tools dominated, where the cache broke, which subagent went off the rails.

## Why

`jsonl.fyi` gives you a timeline. That is the same thing an LLM would give you if you pasted the file into a chat. We wanted the views that only a human staring at the whole session at once can use:

- Per-turn cost flame chart (input vs output vs cache_read vs cache_creation)
- Tool heatmap across the run
- Subagent tree from `parentUuid` and `isSidechain`
- File attention river
- Cache hit/miss timeline
- Time-travel scrubber with diff playback
- Anomaly inspector (refusals, long latencies, loops, model swaps)
- Talk to your session with BYOK (your API key, never ours)

This MVP ships three of those: Timeline, Cost flame, Tool heatmap. The rest follow.

## Stack

- Bun workspace
- Next.js 16, React 19, Tailwind v4
- Biome for lint and format
- TypeScript strict
- Pure client-side parsing in a web worker

## Where the sessions live on disk

| Agent | Path |
| --- | --- |
| Claude Code | `~/.claude/projects/<project>/<session-uuid>.jsonl` |
| OpenAI Codex | `~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-*.jsonl` |
| Pi Coding Agent | `~/.pi/agent/sessions/` |

## Develop

```bash
bun install
bun dev
```

## License

Apache-2.0
