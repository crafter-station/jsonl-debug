import type { NormalizedEvent, NormalizedSession, TokenUsage } from "../types";
import { _eventCost } from "./cost";

export interface TreeNode {
  uuid: string;
  parentUuid?: string;
  ts: string;
  role: NormalizedEvent["role"];
  isSidechain: boolean;
  model?: string;
  preview: string;
  toolNames: string[];
  selfCostUsd: number;
  selfUsage?: TokenUsage;
  rollupCostUsd: number;
  rollupTokens: number;
  children: TreeNode[];
  depth: number;
}

export function buildTree(session: NormalizedSession): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  for (const ev of session.events) {
    const toolNames: string[] = [];
    let preview = "";
    for (const block of ev.content) {
      if (block.type === "tool_use") {
        toolNames.push(block.name);
        if (!preview) preview = `${block.name}(...)`;
      } else if (block.type === "text" && !preview) {
        preview = block.text.slice(0, 140);
      } else if (block.type === "tool_result" && !preview) {
        preview = `← ${(block.content.split("\n")[0] ?? "").slice(0, 140)}`;
      }
    }
    if (!preview) preview = ev.role;
    nodes.set(ev.uuid, {
      uuid: ev.uuid,
      parentUuid: ev.parentUuid,
      ts: ev.ts,
      role: ev.role,
      isSidechain: ev.isSidechain,
      model: ev.model,
      preview,
      toolNames,
      selfCostUsd: _eventCost(ev),
      selfUsage: ev.usage,
      rollupCostUsd: 0,
      rollupTokens: 0,
      children: [],
      depth: 0,
    });
  }

  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentUuid && nodes.has(node.parentUuid)) {
      nodes.get(node.parentUuid)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const setDepth = (node: TreeNode, depth: number) => {
    node.depth = depth;
    for (const c of node.children) setDepth(c, depth + 1);
  };
  for (const r of roots) setDepth(r, 0);

  const rollup = (node: TreeNode): { usd: number; tokens: number } => {
    let usd = node.selfCostUsd;
    let tokens =
      (node.selfUsage?.outputTokens ?? 0) +
      (node.selfUsage?.inputTokens ?? 0) +
      (node.selfUsage?.cacheReadInputTokens ?? 0) +
      (node.selfUsage?.cacheCreationInputTokens ?? 0);
    for (const c of node.children) {
      const r = rollup(c);
      usd += r.usd;
      tokens += r.tokens;
    }
    node.rollupCostUsd = usd;
    node.rollupTokens = tokens;
    return { usd, tokens };
  };
  for (const r of roots) rollup(r);

  return roots;
}

export function flattenTree(roots: TreeNode[], includeCollapsed: Set<string> = new Set()): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (n: TreeNode) => {
    out.push(n);
    if (includeCollapsed.has(n.uuid)) return;
    for (const c of n.children) walk(c);
  };
  for (const r of roots) walk(r);
  return out;
}
