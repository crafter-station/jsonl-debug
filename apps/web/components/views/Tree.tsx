"use client";

import type { NormalizedSession } from "@crafter/jsonl-debug-core";
import { type TreeNode, buildTree } from "@crafter/jsonl-debug-core/analyze";
import { ChevronDown, ChevronRight, GitBranch } from "lucide-react";
import { useMemo, useState } from "react";
import { useSessionStore } from "@/lib/store";

export function Tree({ session }: { session: NormalizedSession }) {
  const roots = useMemo(() => buildTree(session), [session]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const totalCost = roots.reduce((s, r) => s + r.rollupCostUsd, 0);
  const sidechains = countSidechains(roots);

  const toggle = (uuid: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  return (
    <div className="px-6 py-6 space-y-4">
      <div className="flex items-center gap-5 text-[11px] font-mono tabular-nums text-muted-foreground">
        <span>
          <span className="uppercase tracking-wider mr-1.5 text-muted-foreground/60">roots</span>
          <span className="text-foreground font-medium">{roots.length}</span>
        </span>
        <span>
          <span className="uppercase tracking-wider mr-1.5 text-muted-foreground/60">sidechains</span>
          <span className="text-foreground font-medium">{sidechains}</span>
        </span>
        <span>
          <span className="uppercase tracking-wider mr-1.5 text-muted-foreground/60">total</span>
          <span className="text-accent font-medium">${totalCost.toFixed(2)}</span>
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
          <GitBranch className="size-3" />
          parent / child by parentUuid · sidechains marked with arrow
        </div>
        <div className="p-2 max-h-[calc(100vh-15rem)] overflow-auto">
          {roots.map((r) => (
            <TreeRow
              key={r.uuid}
              node={r}
              collapsed={collapsed}
              onToggle={toggle}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TreeRow({
  node,
  collapsed,
  onToggle,
}: {
  node: TreeNode;
  collapsed: Set<string>;
  onToggle: (uuid: string) => void;
}) {
  const setSelected = useSessionStore((s) => s.setSelected);
  const setView = useSessionStore((s) => s.setView);
  const isCollapsed = collapsed.has(node.uuid);
  const hasChildren = node.children.length > 0;
  const isSidechainBranch = node.isSidechain;

  const goToTimeline = () => {
    setSelected(node.uuid);
    setView("timeline");
  };

  return (
    <>
      <div
        className={`group flex items-start gap-1 py-1 px-1 rounded-md hover:bg-muted/40 transition-colors ${
          isSidechainBranch ? "border-l-2 border-token-cache-write/40 ml-0" : ""
        }`}
        style={{ paddingLeft: `${node.depth * 16 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.uuid)}
          className={`shrink-0 mt-[2px] size-4 flex items-center justify-center text-muted-foreground hover:text-foreground ${
            !hasChildren ? "invisible" : ""
          }`}
          aria-label={isCollapsed ? "expand" : "collapse"}
        >
          {hasChildren && (
            isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />
          )}
        </button>
        <button
          type="button"
          onClick={goToTimeline}
          className="flex-1 min-w-0 text-left flex items-baseline gap-2 font-mono text-[12px]"
        >
          <RoleTag role={node.role} sidechain={node.isSidechain} />
          <span className="text-foreground/85 truncate min-w-0 flex-1">
            {node.preview}
          </span>
          {node.toolNames.length > 0 && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              {node.toolNames.length === 1
                ? node.toolNames[0]
                : `${node.toolNames.length} tools`}
            </span>
          )}
          {node.rollupCostUsd > 0.001 && (
            <span className="text-[10px] text-token-output tabular-nums shrink-0">
              ${node.rollupCostUsd.toFixed(3)}
            </span>
          )}
          {hasChildren && (
            <span className="text-[10px] text-muted-foreground/60 shrink-0">
              [{countDescendants(node)}]
            </span>
          )}
        </button>
      </div>
      {hasChildren && !isCollapsed && (
        <>
          {node.children.map((c) => (
            <TreeRow
              key={c.uuid}
              node={c}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
        </>
      )}
    </>
  );
}

function RoleTag({
  role,
  sidechain,
}: {
  role: TreeNode["role"];
  sidechain: boolean;
}) {
  const cls =
    role === "assistant"
      ? "text-accent"
      : role === "user"
        ? "text-token-input"
        : role === "tool_result"
          ? "text-token-cache-read"
          : "text-muted-foreground";
  return (
    <span
      className={`shrink-0 text-[9px] uppercase tracking-widest font-semibold w-12 ${cls}`}
    >
      {sidechain ? "↳ " : ""}
      {role.slice(0, 3)}
    </span>
  );
}

function countSidechains(nodes: TreeNode[]): number {
  let n = 0;
  const walk = (node: TreeNode) => {
    if (node.isSidechain) n += 1;
    for (const c of node.children) walk(c);
  };
  for (const r of nodes) walk(r);
  return n;
}

function countDescendants(node: TreeNode): number {
  let n = 0;
  const walk = (x: TreeNode) => {
    for (const c of x.children) {
      n += 1;
      walk(c);
    }
  };
  walk(node);
  return n;
}
