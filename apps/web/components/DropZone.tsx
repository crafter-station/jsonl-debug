"use client";

import { Upload } from "lucide-react";
import { type DragEvent, useCallback, useRef, useState } from "react";
import { loadFile } from "@/lib/load-file";

export function DropZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }, []);

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      className={`group rounded-2xl border-2 border-dashed transition-all px-12 py-20 text-center cursor-pointer ${
        over ? "border-accent bg-card" : "border-border hover:border-muted-foreground"
      }`}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".jsonl,application/jsonl,application/x-ndjson,application/octet-stream"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadFile(f);
        }}
      />
      <Upload className="mx-auto mb-4 size-8 text-muted-foreground group-hover:text-accent transition-colors" />
      <div className="text-lg font-medium">
        Drop your <code className="rounded bg-muted px-1.5 py-0.5 text-base">.jsonl</code>
      </div>
      <div className="text-sm text-muted-foreground mt-2">or click to choose a file</div>
      <div className="text-xs text-muted-foreground/80 mt-6">
        Sessions never leave your browser.
      </div>
    </div>
  );
}
