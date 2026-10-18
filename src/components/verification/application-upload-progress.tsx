"use client";

import { Check, CircleAlert, FileCheck2, LoaderCircle, ShieldCheck, Upload } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatFileSize, MAX_APPLICATION_BYTES } from "@/lib/document-file";

export interface PreparedUpload {
  label: string;
  sizeBytes: number;
  originalSizeBytes: number;
}

export interface ApplicationUploadState {
  phase: "checking" | "optimizing" | "uploading" | "confirming" | "success" | "error";
  loadedBytes: number;
  totalBytes: number;
  deltaBytes: number;
  files: PreparedUpload[];
  originalBytes?: number;
  optimizationLabel?: string;
  optimizationPage?: number;
  optimizationPages?: number;
  error?: string;
  status?: number;
  failedAt?: "checking" | "optimizing" | "uploading" | "confirming";
}

/** Transfer amounts come from browser upload events; success requires the API reply. */
export function ApplicationUploadProgress({ state, onClose }: {
  state: ApplicationUploadState | null;
  onClose: () => void;
}) {
  if (!state) return null;
  const { phase, totalBytes, loadedBytes, files } = state;
  const terminal = phase === "error" || phase === "success";
  const percent = totalBytes ? Math.min(100, Math.floor(loadedBytes / totalBytes * 100)) : 0;
  const stage = phase === "error" ? state.failedAt ?? "uploading" : phase;
  const preparing = phase === "checking" || phase === "optimizing";
  const current = stage === "checking" || stage === "optimizing" ? 0 : stage === "uploading" ? 1 : stage === "confirming" ? 2 : 3;
  const savedBytes = files.reduce((sum, file) => sum + Math.max(0, file.originalSizeBytes - file.sizeBytes), 0);
  const title = phase === "error" ? "Your application needs attention" : phase === "success" ? "Application received" : phase === "confirming" ? "Waiting for confirmation" : preparing ? "Preparing your application" : "Sending your application";
  const steps = [
    { label: "Prepare application", detail: "Check details and automatically reduce file sizes", icon: ShieldCheck },
    { label: "Send application", detail: "Transfer your details and prepared files", icon: Upload },
    { label: "Confirm account", detail: "Wait for the server to confirm receipt", icon: FileCheck2 },
  ];

  return (
    <Modal open onClose={onClose} title={title} dismissible={terminal} size="md"
      description={terminal ? "Your application progress" : "Keep this page open while your application is sent."}
      footer={terminal ? <Button className="w-full sm:w-auto" onClick={onClose}>{phase === "error" ? "Back to application" : "Continue"}</Button> : undefined}>
      <div className="min-w-0 space-y-5">
        <div tabIndex={0} role="status" aria-live="polite" className="rounded-2xl border border-line bg-surface-nested p-4 outline-offset-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink">{phase === "checking" ? "Checking size…" : phase === "optimizing" ? "Making your files smaller…" : phase === "success" ? "Confirmed by server" : phase === "error" ? "Transfer stopped" : `${percent}% sent`}</span>
            {phase === "error" ? <CircleAlert className="size-5 shrink-0 text-danger-600" aria-hidden /> : phase === "success" ? <Check className="size-5 shrink-0 text-success-700" aria-hidden /> : <LoaderCircle className="size-5 shrink-0 animate-spin motion-reduce:animate-none text-gold-700" aria-hidden />}
          </div>
          <div role="progressbar" aria-label={preparing ? "Preparing application" : "Application bytes sent"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={preparing ? undefined : percent}
            className="mt-3 h-2 overflow-hidden rounded-full bg-line">
            <div className={cn("h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none", phase === "error" ? "bg-danger-500" : "bg-forest-600")} style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-ink-secondary tabular-nums">
            <span>{preparing ? totalBytes ? `Application: ${formatFileSize(totalBytes)}` : "Calculating size" : `${formatFileSize(loadedBytes)} of ${totalBytes ? formatFileSize(totalBytes) : "size being checked"}`}</span>
            <span>{files.length} prepared files</span>
          </div>
          {phase === "optimizing" ? <div className="mt-3 text-xs leading-relaxed text-ink-secondary">
            <p className="break-words">{state.optimizationLabel ? `Reducing ${state.optimizationLabel.toLowerCase()}…` : "Adjusting the complete application to fit."}{state.optimizationPage ? ` Page ${state.optimizationPage} of ${state.optimizationPages}.` : ""}</p>
            <p className="mt-1">We’ll send it automatically when it’s ready. You don’t need to upload your files again.</p>
          </div> : null}
          {phase === "uploading" && state.deltaBytes > 0 ? <p className="mt-2 text-xs text-ink-muted">Latest transfer update: +{formatFileSize(state.deltaBytes)}</p> : null}
          {phase === "confirming" ? <p className="mt-3 text-xs leading-relaxed text-ink-secondary">All bytes have left your device. Your account is ready only after the server confirms it.</p> : null}
        </div>

        <ol className="space-y-4" aria-label="Submission stages">
          {steps.map(({ label, detail, icon: Icon }, index) => {
            const done = index < current || phase === "success";
            const active = index === current;
            const failed = active && phase === "error";
            return <li key={label} className="flex items-start gap-3" aria-current={active ? "step" : undefined}>
              <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", failed ? "bg-danger-50 text-danger-600" : done ? "bg-success-50 text-success-700" : active ? "bg-gold-100 text-gold-800" : "bg-surface-nested text-ink-muted")}>
                {failed ? <CircleAlert className="size-4" aria-hidden /> : done ? <Check className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
              </span>
              <div className="min-w-0"><p className="text-sm font-medium text-ink">{label}<span className="sr-only">{done ? ": complete" : failed ? ": failed" : active ? ": in progress" : ": waiting"}</span></p><p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{detail}</p></div>
            </li>;
          })}
        </ol>

        {state.error ? <div role="alert" className="rounded-xl border border-danger-500/25 bg-danger-50 p-3 text-sm leading-relaxed text-danger-700 dark:bg-danger-500/10 dark:text-red-200">
          <p>{state.error}</p>
          {state.status ? <p className="mt-2 text-xs">Error {state.status} · Application size: {formatFileSize(totalBytes)}</p> : null}
          <p className="mt-2 text-xs">Your files and answers are still available on this page.</p>
        </div> : null}

        <details className="rounded-xl border border-line px-3 py-2.5 text-xs">
          <summary className="cursor-pointer font-medium text-ink">Prepared files{savedBytes > 0 ? ` · ${formatFileSize(savedBytes)} saved` : ""}</summary>
          <ul className="mt-3 space-y-2">
            {files.map((file) => <li key={file.label} className="flex items-start justify-between gap-3 text-ink-secondary"><span className="min-w-0 break-words">{file.label}</span><span className="shrink-0 tabular-nums">{formatFileSize(file.sizeBytes)}</span></li>)}
          </ul>
          <p className="mt-3 text-ink-muted">Application size includes file encoding and account details. Limit: {formatFileSize(MAX_APPLICATION_BYTES)}.</p>
        </details>
      </div>
    </Modal>
  );
}
