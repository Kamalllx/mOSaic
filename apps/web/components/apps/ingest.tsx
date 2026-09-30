"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CloudUpload, File, FileText, FolderOpen, Loader2, Upload, X, XCircle } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useClient } from "@/app/providers";
import type { IngestProgressEvent } from "@/lib/mosaic-client";
import { MosaicError } from "@/lib/mosaic-client";
import { cn } from "@/lib/utils";

type PrivacyLevel = "public" | "internal" | "confidential";

interface FileEntry {
  file: File;
  stage: IngestProgressEvent["stage"] | "pending" | "queued";
  path?: string;
  error?: string;
}

const PRIVACY_LABELS: Record<PrivacyLevel, string> = {
  public: "Public",
  internal: "Internal",
  confidential: "Confidential",
};

const PRIVACY_DESCRIPTIONS: Record<PrivacyLevel, string> = {
  public: "Any agent and user can read this",
  internal: "Org members only",
  confidential: "Restricted to high-privilege agents",
};

function FileRow({ entry }: { entry: FileEntry }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <FileText className="size-4 shrink-0 text-text-2" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm">{entry.file.name}</span>
      <span className="shrink-0 font-mono text-xs text-text-2">{(entry.file.size / 1024).toFixed(0)} KB</span>
      <span className="shrink-0">
        {entry.stage === "pending" && <span className="font-mono text-xs text-text-2">ready</span>}
        {entry.stage === "queued" && <Loader2 className="size-4 animate-spin text-brand" aria-label="uploading" />}
        {(entry.stage === "converting" || entry.stage === "writing" || entry.stage === "indexing") && (
          <span className="inline-flex items-center gap-1 font-mono text-xs text-brand">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {entry.stage}
          </span>
        )}
        {entry.stage === "done" && (
          <span className="inline-flex items-center gap-1 font-mono text-xs text-st-completed">
            <CheckCircle2 className="size-3.5" aria-hidden />
            done
          </span>
        )}
        {entry.stage === "error" && (
          <span className="inline-flex items-center gap-1 font-mono text-xs text-st-failed" title={entry.error}>
            <XCircle className="size-3.5" aria-hidden />
            error
          </span>
        )}
      </span>
    </li>
  );
}

export function IngestApp() {
  const client = useClient();
  const qc = useQueryClient();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [folder, setFolder] = useState("/org/uploads");
  const [privacy, setPrivacy] = useState<PrivacyLevel>("internal");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: File[]) => {
    setFiles((prev) => {
      const existing = new Set(prev.map((e) => e.file.name));
      const novel = incoming.filter((f) => !existing.has(f.name));
      return [...prev, ...novel.map((f): FileEntry => ({ file: f, stage: "pending" }))];
    });
  }, []);

  const removeFile = (name: string) => setFiles((p) => p.filter((e) => e.file.name !== name));
  const clearDone = () => setFiles((p) => p.filter((e) => e.stage !== "done" && e.stage !== "error"));

  const upload = useMutation({
    mutationFn: async () => {
      // Mark all as queued
      setFiles((p) => p.map((e) => (e.stage === "pending" ? { ...e, stage: "queued" } : e)));
      const result = await client.upload(
        files.filter((e) => e.stage === "queued").map((e) => e.file),
        folder,
        privacy,
      );
      // Mark done
      setFiles((p) => p.map((e) => ({ ...e, stage: e.stage === "queued" ? "done" : e.stage })));
      qc.invalidateQueries({ queryKey: ["knowledge-tree"] });
      return result;
    },
    onSuccess: (data) => {
      toast.success(`Ingested ${data.ingested} file${data.ingested === 1 ? "" : "s"}`, {
        description: `Written to ${folder}`,
      });
    },
    onError: (e) => {
      setFiles((p) => p.map((e) => (e.stage === "queued" ? { ...e, stage: "error" as const, error: e instanceof MosaicError ? e.message : String(e) } : e)));
      toast.error("Upload failed", { description: e instanceof MosaicError ? e.message : String(e) });
    },
  });

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) addFiles(dropped);
  };

  const pending = files.filter((e) => e.stage === "pending").length;
  const hasFiles = files.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Upload className="size-6 text-brand" aria-hidden />
          Ingest
        </h1>
        <p className="mt-1 text-sm text-text-2">
          Drop files or pick a folder. They are converted, written to the knowledge filesystem, and indexed for hybrid
          search. The demo OKF bundle is unchanged.
        </p>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop files or click to browse"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 transition-colors",
          dragging ? "border-brand bg-brand/8" : "border-line bg-surface-1 hover:bg-surface-2",
        )}
      >
        <CloudUpload className={cn("size-10", dragging ? "text-brand" : "text-text-2")} aria-hidden />
        <div className="text-center">
          <p className="font-medium">Drop files here, or click to browse</p>
          <p className="mt-0.5 text-xs text-text-2">Supported: Markdown, PDF, DOCX, CSV, plain text</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".md,.pdf,.docx,.doc,.csv,.txt"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length) addFiles(picked);
            e.target.value = "";
          }}
        />
      </div>

      {/* Options row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-52">
          <label htmlFor="ingest-folder" className="mb-1 block text-xs font-medium text-text-2">Target folder</label>
          <div className="relative">
            <FolderOpen className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-2" aria-hidden />
            <input
              id="ingest-folder"
              type="text"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="h-9 w-full rounded-md border border-line bg-surface-2 pl-9 pr-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>
        <div>
          <label htmlFor="ingest-privacy" className="mb-1 block text-xs font-medium text-text-2">Privacy</label>
          <select
            id="ingest-privacy"
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value as PrivacyLevel)}
            className="h-9 rounded-md border border-line bg-surface-2 px-2 text-sm"
          >
            {(["public", "internal", "confidential"] as PrivacyLevel[]).map((p) => (
              <option key={p} value={p} title={PRIVACY_DESCRIPTIONS[p]}>
                {PRIVACY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* File list */}
      {hasFiles && (
        <section aria-label="Selected files" className="overflow-hidden rounded-xl border border-line bg-surface-1 shadow-panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-2">
              {files.length} file{files.length !== 1 ? "s" : ""} selected
            </span>
            <button type="button" onClick={clearDone} className="text-xs text-text-2 hover:text-foreground">
              Clear done
            </button>
          </div>
          <ul className="divide-y divide-line">
            {files.map((e) => (
              <li key={e.file.name} className="group relative">
                <FileRow entry={e} />
                {e.stage === "pending" && (
                  <button
                    type="button"
                    onClick={() => removeFile(e.file.name)}
                    aria-label={`Remove ${e.file.name}`}
                    className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded p-0.5 hover:bg-surface-3 group-hover:flex"
                  >
                    <X className="size-4 text-text-2" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => upload.mutate()}
          disabled={!pending || upload.isPending}
          className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-[var(--on-brand)] hover:bg-brand-hover disabled:opacity-40"
        >
          {upload.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
          {upload.isPending ? "Uploading…" : `Upload ${pending || ""} file${pending !== 1 ? "s" : ""}`.trim()}
        </button>
        {hasFiles && (
          <button
            type="button"
            onClick={() => setFiles([])}
            disabled={upload.isPending}
            className="rounded-md border border-line px-3 py-2 text-sm hover:bg-surface-3 disabled:opacity-40"
          >
            Clear all
          </button>
        )}
      </div>

      {!hasFiles && (
        <div className="rounded-xl border border-line bg-surface-1 px-6 py-10 text-center shadow-panel">
          <File className="mx-auto mb-2 size-8 text-muted-foreground opacity-40" aria-hidden />
          <p className="text-sm text-text-2">No files selected yet.</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Files added above will appear here with per-file progress.</p>
        </div>
      )}
    </div>
  );
}
