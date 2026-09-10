"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Check,
  Info,
  ShieldAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { toastVariants } from "@/lib/motion";
import { createId } from "@/services/api-client";

export type ToastTone = "neutral" | "success" | "warning" | "danger";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastRecord extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON: Record<ToastTone, LucideIcon> = {
  neutral: Info,
  success: Check,
  warning: AlertTriangle,
  danger: ShieldAlert,
};

const TONE_ACCENT: Record<ToastTone, string> = {
  neutral: "text-ink-secondary",
  success: "text-success-500",
  warning: "text-gold-600 dark:text-gold-400",
  danger: "text-danger-500",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = createId("toast");
      setToasts((current) => [...current.slice(-2), { ...options, id }]);

      const duration = options.durationMs ?? 4200;
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-4 pb-24 sm:right-6 sm:bottom-6 sm:left-auto sm:items-end sm:px-0 sm:pb-0"
      >
        <AnimatePresence initial={false}>
          {toasts.map((item) => {
            const tone = item.tone ?? "neutral";
            const Icon = TONE_ICON[tone];

            return (
              <motion.div
                key={item.id}
                layout
                variants={toastVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                role="status"
                aria-live="polite"
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[var(--kx-radius-md)] border border-line bg-surface px-4 py-3.5 shadow-lg"
              >
                <Icon
                  className={cn("mt-0.5 size-4.5 shrink-0", TONE_ACCENT[tone])}
                  strokeWidth={2}
                  aria-hidden
                />

                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] font-medium text-ink">
                    {item.title}
                  </p>
                  {item.description ? (
                    <p className="type-meta mt-0.5 text-ink-secondary">
                      {item.description}
                    </p>
                  ) : null}
                  {item.action ? (
                    <button
                      type="button"
                      onClick={() => {
                        item.action?.onClick();
                        dismiss(item.id);
                      }}
                      className="mt-2 text-[0.8125rem] font-medium text-forest-700 underline-offset-4 hover:underline dark:text-gold-300"
                    >
                      {item.action.label}
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="Dismiss"
                  className="-mr-1 rounded-full p-1 text-ink-muted transition-colors hover:bg-[color-mix(in_srgb,var(--kx-text)_7%,transparent)] hover:text-ink"
                >
                  <X className="size-3.5" strokeWidth={2} aria-hidden />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside a ToastProvider");
  }
  return context;
}
