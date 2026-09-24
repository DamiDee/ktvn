"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { backdropVariants, dialogVariants, sheetVariants } from "@/lib/motion";
import { useIsMobile, useMounted } from "@/hooks/use-media-query";
import { Button, IconButton } from "./button";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Mobile renders as a bottom sheet unless this is false. */
  sheetOnMobile?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

/**
 * Centred card on desktop, bottom sheet on mobile. Backdrop is blurred,
 * focus is trapped, Escape closes.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  sheetOnMobile = true,
  size = "md",
  className,
}: ModalProps) {
  const mounted = useMounted();
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    // Move focus into the dialog on open.
    const focusTimer = window.setTimeout(() => {
      // A fast tap/keystroke may already have focused a field during the
      // entrance animation. Do not steal focus from someone typing.
      if (panelRef.current?.contains(document.activeElement)) return;
      panelRef.current
        ?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        ?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;

  const asSheet = sheetOnMobile && isMobile;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 bg-[var(--kx-overlay)] backdrop-blur-[6px]"
            aria-hidden
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            variants={asSheet ? sheetVariants : dialogVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              "relative z-10 flex w-full flex-col bg-surface shadow-xl",
              asSheet
                ? "max-h-[88vh] rounded-t-[var(--kx-radius-2xl)] pb-safe"
                : cn("m-4 rounded-[var(--kx-radius-xl)]", SIZES[size]),
              className,
            )}
          >
            {asSheet ? (
              <div className="flex justify-center pt-3 pb-1" aria-hidden>
                <span className="h-1 w-10 rounded-full bg-[color-mix(in_srgb,var(--kx-text)_18%,transparent)]" />
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-1">
              <div className="min-w-0">
                <h2 id={titleId} className="type-section-title text-ink">
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className="type-meta mt-1.5 text-ink-secondary">
                    {description}
                  </p>
                ) : null}
              </div>
              <IconButton icon={X} label="Close" size="sm" onClick={onClose} />
            </div>

            {children ? (
              <div className="kx-scroll-thin flex-1 overflow-y-auto px-6 py-4">
                {children}
              </div>
            ) : (
              <div className="h-2" />
            )}

            {footer ? (
              <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  loading?: boolean;
}

/** Reserved for destructive or high-risk actions only. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Go back",
  tone = "default",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
            loadingLabel="Working"
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
