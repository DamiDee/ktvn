"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  CalendarX,
  Check,
  Eye,
  FileText,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { StatusBadge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { DOCUMENT_STATUS_PRESENTATION } from "@/constants/status-presentation";
import { DocumentStatus, type DocumentType } from "@/types/enums";
import { formatDate } from "@/lib/format";
import { transitions } from "@/lib/motion";
import type { VerificationDocument } from "@/types/models";

const ACCEPTED = ".pdf,.jpg,.jpeg,.png";
const MAX_BYTES = 8 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drag-and-drop document upload.
 *
 * The upload itself is simulated, but every state the real flow will have is
 * reachable: missing, uploading, uploaded, needs attention, expired, verified.
 * A reviewer's note is shown inline when there's something to fix, so the
 * driver never sees a bare "Pending".
 */
export function DocumentUpload({
  type,
  label,
  hint,
  document,
  onUploaded,
  onRemoved,
  className,
}: {
  type: DocumentType;
  label: string;
  hint?: string;
  document?: VerificationDocument;
  onUploaded?: (doc: VerificationDocument) => void;
  onRemoved?: () => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const status = uploading
    ? DocumentStatus.UPLOADING
    : (document?.status ?? DocumentStatus.MISSING);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      if (file.size > MAX_BYTES) {
        setError(`That file is ${formatBytes(file.size)}. The limit is 8 MB.`);
        return;
      }

      setUploading(true);
      setProgress(0);

      // Simulated progress; the real upload will report actual bytes.
      const started = performance.now();
      const duration = 1100;

      function tick(now: number) {
        const next = Math.min(1, (now - started) / duration);
        setProgress(next);

        if (next >= 1) {
          setUploading(false);
          onUploaded?.({
            id: `doc-${type.toLowerCase()}`,
            type,
            label,
            status: DocumentStatus.UPLOADED,
            fileName: file.name,
            fileType: (file.name.split(".").pop() ?? "FILE").toUpperCase(),
            sizeBytes: file.size,
            uploadedAt: new Date().toISOString(),
          });
          return;
        }
        requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
    },
    [type, label, onUploaded],
  );

  const empty =
    status === DocumentStatus.MISSING && !uploading;

  const needsAttention =
    status === DocumentStatus.NEEDS_ATTENTION ||
    status === DocumentStatus.EXPIRED;

  return (
    <div className={className}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={cn(
          "relative overflow-hidden rounded-[var(--kx-radius-lg)] border transition-[border-color,background-color] duration-[165ms]",
          dragging
            ? "border-gold-500 bg-gold-50/70 dark:bg-gold-500/10"
            : needsAttention
              ? "border-gold-400/60 bg-pending-50/50 dark:bg-gold-500/8"
              : empty
                ? "border-dashed border-line-strong bg-surface-nested/60"
                : "border-line bg-surface",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          id={`upload-${type}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
            event.target.value = "";
          }}
        />

        <AnimatePresence mode="wait" initial={false}>
          {/* Empty */}
          {empty ? (
            <motion.label
              key="empty"
              htmlFor={`upload-${type}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex cursor-pointer flex-col items-center gap-3 px-5 py-7 text-center"
            >
              <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-ink-muted ring-1 ring-line">
                <Upload className="size-5" strokeWidth={1.7} aria-hidden />
              </span>
              <span>
                <span className="type-body block font-medium text-ink">
                  {label}
                </span>
                {hint ? (
                  <span className="type-meta mt-0.5 block text-ink-muted">
                    {hint}
                  </span>
                ) : null}
              </span>
              <span className="type-meta text-ink-muted">
                Drag a file here, or{" "}
                <span className="font-medium text-forest-700 underline underline-offset-4 dark:text-gold-300">
                  browse
                </span>
                <span className="block text-[0.75rem]">
                  PDF, JPG or PNG · up to 8 MB
                </span>
              </span>
            </motion.label>
          ) : null}

          {/* Uploading — the file floats up as it goes */}
          {uploading ? (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3.5 px-5 py-5"
            >
              <motion.span
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--kx-radius-sm)] bg-gold-500/16 text-gold-700 dark:text-gold-300"
              >
                <FileText className="size-5" strokeWidth={1.7} aria-hidden />
              </motion.span>

              <div className="min-w-0 flex-1">
                <p className="type-body font-medium text-ink">{label}</p>
                <p className="type-meta mt-0.5 text-ink-muted">Uploading…</p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--kx-text)_10%,transparent)]">
                  <motion.div
                    className="h-full rounded-full bg-gold-500"
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ duration: 0.08, ease: "linear" }}
                  />
                </div>
              </div>
            </motion.div>
          ) : null}

          {/* Uploaded / verified / needs attention */}
          {!empty && !uploading && document ? (
            <motion.div
              key="filled"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={transitions.card}
              className="px-5 py-4"
            >
              <div className="flex items-center gap-3.5">
                <span
                  className={cn(
                    "relative inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--kx-radius-sm)]",
                    status === DocumentStatus.VERIFIED
                      ? "bg-success-50 text-success-700 dark:bg-success-500/14 dark:text-emerald-300"
                      : needsAttention
                        ? "bg-pending-50 text-pending-700 dark:bg-gold-500/14 dark:text-gold-300"
                        : "bg-surface-nested text-ink-secondary",
                  )}
                >
                  {status === DocumentStatus.VERIFIED ? (
                    <Check className="size-5" strokeWidth={2.4} aria-hidden />
                  ) : status === DocumentStatus.EXPIRED ? (
                    <CalendarX className="size-5" strokeWidth={1.8} aria-hidden />
                  ) : needsAttention ? (
                    <AlertTriangle className="size-5" strokeWidth={1.8} aria-hidden />
                  ) : (
                    <FileText className="size-5" strokeWidth={1.7} aria-hidden />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="type-body truncate font-medium text-ink">
                    {label}
                  </p>
                  <p className="type-meta mt-0.5 truncate text-ink-muted">
                    {document.fileName}
                    {document.fileType ? ` · ${document.fileType}` : ""}
                    {document.sizeBytes
                      ? ` · ${formatBytes(document.sizeBytes)}`
                      : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    icon={Eye}
                    label={`Preview ${label}`}
                    size="sm"
                    variant="ghost"
                  />
                  <IconButton
                    icon={RefreshCw}
                    label={`Replace ${label}`}
                    size="sm"
                    variant="ghost"
                    onClick={() => inputRef.current?.click()}
                  />
                  {onRemoved ? (
                    <IconButton
                      icon={Trash2}
                      label={`Remove ${label}`}
                      size="sm"
                      variant="ghost"
                      onClick={onRemoved}
                    />
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge
                  presentation={DOCUMENT_STATUS_PRESENTATION[status]}
                />
                {document.expiresAt ? (
                  <span className="type-meta text-ink-muted">
                    {status === DocumentStatus.EXPIRED ? "Expired" : "Expires"}{" "}
                    {formatDate(document.expiresAt)}
                  </span>
                ) : null}
              </div>

              {/* Reviewer feedback — always specific, never a bare status */}
              {document.note ? (
                <p className="type-meta mt-3 rounded-[var(--kx-radius-sm)] bg-pending-50 px-3 py-2 text-pending-700 dark:bg-gold-500/10 dark:text-gold-200">
                  {document.note}
                </p>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {error ? (
        <p role="alert" className="type-meta mt-2 text-danger-600 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
