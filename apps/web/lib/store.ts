"use client";

import type { NormalizedSession } from "@crafter/jsonl-debug-core";
import { create } from "zustand";

export type View = "timeline" | "cost" | "heatmap";

export type LoadStatus =
  | { kind: "idle" }
  | { kind: "loading"; bytesRead: number; totalBytes: number; eventsParsed: number; fileName?: string }
  | { kind: "ready"; session: NormalizedSession; fileName?: string; sizeBytes: number; parseMs: number }
  | { kind: "error"; message: string };

interface Store {
  status: LoadStatus;
  view: View;
  selectedUuid: string | null;
  setView: (v: View) => void;
  setSelected: (uuid: string | null) => void;
  setStatus: (s: LoadStatus) => void;
  reset: () => void;
}

export const useSessionStore = create<Store>((set) => ({
  status: { kind: "idle" },
  view: "timeline",
  selectedUuid: null,
  setView: (v) => set({ view: v }),
  setSelected: (uuid) => set({ selectedUuid: uuid }),
  setStatus: (s) => set({ status: s }),
  reset: () => set({ status: { kind: "idle" }, selectedUuid: null, view: "timeline" }),
}));
