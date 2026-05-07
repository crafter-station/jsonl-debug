"use client";

import { Landing } from "@/components/Landing";
import { SessionShell } from "@/components/SessionShell";
import { useSessionStore } from "@/lib/store";

export default function Home() {
  const status = useSessionStore((s) => s.status);
  if (status.kind === "ready") return <SessionShell />;
  return <Landing />;
}
