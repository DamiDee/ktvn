"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Check, CreditCard, Landmark, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { NestedTile } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { PAYMENT_PRESENTATION } from "@/constants/status-presentation";
import { canRetryPayment } from "@/lib/state-machines";
import { PaymentStatus, RideType } from "@/types/enums";
import { formatNaira } from "@/lib/format";
import { transitions } from "@/lib/motion";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import type { Payment } from "@/types/models";

const METHODS = [
  { value: "CARD" as const, label: "Card", icon: CreditCard },
  { value: "TRANSFER" as const, label: "Transfer", icon: Landmark },
  { value: "CASH" as const, label: "Cash", icon: Wallet },
];

/**
 * Payment for a completed professional ride.
 *
 * Deliberately not a wallet: there is no balance, no top-up and no stored
 * value. It settles one journey and stops. This component is only ever
 * rendered for a ride that has a `payment`, which volunteer rides never do.
 */
export function PaymentPanel({
  payment,
  rideType,
  onSettled,
  className,
}: {
  payment: Payment;
  rideType: RideType;
  onSettled?: (status: PaymentStatus) => void;
  className?: string;
}) {
  const { toast } = useToast();
  const { prefersReduced } = useReducedMotionSafe();

  const [status, setStatus] = useState<PaymentStatus>(payment.status);
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("CARD");
  const [attempt, setAttempt] = useState(0);

  const shared = rideType === RideType.SHARED;
  const paid = status === PaymentStatus.PAID;
  const failed = status === PaymentStatus.FAILED;
  const processing = status === PaymentStatus.PROCESSING;

  function pay() {
    setStatus(PaymentStatus.PROCESSING);

    // Simulated settlement; the second attempt always succeeds so the failure
    // state is reachable without stranding anyone.
    window.setTimeout(() => {
      const succeeded = attempt > 0 || Math.random() > 0.25;
      const next = succeeded ? PaymentStatus.PAID : PaymentStatus.FAILED;

      setStatus(next);
      setAttempt((value) => value + 1);
      onSettled?.(next);

      toast(
        succeeded
          ? { title: "Payment confirmed", tone: "success" }
          : {
              title: "That payment didn't go through",
              description: "Nothing was taken. You can try again.",
              tone: "danger",
            },
      );
    }, 1800);
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--kx-radius-xl)] border border-line bg-surface",
        className,
      )}
    >
      {/* Amount */}
      <div className="border-b border-line px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="type-micro text-ink-muted">
              {shared ? "Your share" : "Ride fare"}
            </p>
            <p className="type-numeric mt-1.5 text-[2rem] leading-none font-semibold text-ink">
              {formatNaira(payment.userShare)}
            </p>
            {shared ? (
              <p className="type-meta mt-2 text-ink-muted">
                Route fare {formatNaira(payment.routeFare)}, split between
                riders
              </p>
            ) : null}
          </div>
          <StatusBadge
            presentation={PAYMENT_PRESENTATION[status]}
            live={processing}
            size="md"
          />
        </div>
      </div>

      <div className="px-5 py-5">
        <AnimatePresence mode="wait">
          {/* Settled */}
          {paid ? (
            <motion.div
              key="paid"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transitions.card}
              className="flex flex-col items-center gap-4 py-4 text-center"
            >
              <motion.span
                initial={{ scale: prefersReduced ? 1 : 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="inline-flex size-14 items-center justify-center rounded-full bg-success-500 text-white"
              >
                <Check className="size-7" strokeWidth={3} aria-hidden />
              </motion.span>
              <div>
                <p className="type-card-title text-ink">Payment confirmed</p>
                <p className="type-meta mt-1 text-ink-secondary">
                  {formatNaira(payment.userShare)} settled. A receipt has been
                  issued.
                </p>
              </div>
            </motion.div>
          ) : processing ? (
            /* Processing */
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 py-6 text-center"
            >
              <span className="inline-flex gap-1.5" aria-hidden>
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="size-2 rounded-full bg-lilac-600"
                    style={{
                      animation: "kx-breathe 1.1s ease-in-out infinite",
                      animationDelay: `${index * 0.16}s`,
                    }}
                  />
                ))}
              </span>
              <p className="type-body font-medium text-ink">
                Confirming your payment
              </p>
              <p className="type-meta text-ink-muted">
                This usually takes a few seconds.
              </p>
            </motion.div>
          ) : (
            /* Pending or failed */
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transitions.card}
            >
              {failed ? (
                <div className="mb-4 flex items-start gap-2.5 rounded-[var(--kx-radius-md)] border border-danger-500/25 bg-danger-50 px-4 py-3 dark:bg-danger-500/10">
                  <AlertCircle
                    className="mt-0.5 size-4 shrink-0 text-danger-600 dark:text-red-300"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <p className="type-meta text-danger-700 dark:text-red-200">
                    {payment.failureReason ??
                      "That payment didn't go through. Nothing was taken from your account."}
                  </p>
                </div>
              ) : null}

              <p className="type-micro mb-2.5 text-ink-muted">
                How would you like to pay?
              </p>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map((option) => {
                  const Icon = option.icon;
                  const selected = method === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMethod(option.value)}
                      aria-pressed={selected}
                      className={cn(
                        // 76px tall keeps this comfortably tappable.
                        "flex h-[76px] flex-col items-center justify-center gap-2 rounded-[var(--kx-radius-md)] border transition-[border-color,background-color]",
                        selected
                          ? "border-lilac-500 bg-lilac-50 dark:bg-lilac-500/12"
                          : "border-line bg-surface-nested hover:border-line-strong",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-5",
                          selected
                            ? "text-lilac-700 dark:text-lilac-300"
                            : "text-ink-muted",
                        )}
                        strokeWidth={1.8}
                        aria-hidden
                      />
                      <span className="type-meta font-medium text-ink">
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <NestedTile className="mt-4 flex items-center justify-between gap-3">
                <span className="type-meta text-ink-secondary">To pay</span>
                <span className="type-numeric text-[1.0625rem] font-semibold text-ink">
                  {formatNaira(payment.userShare)}
                </span>
              </NestedTile>

              <Button
                variant="primary"
                size="xl"
                block
                className="mt-4"
                onClick={pay}
              >
                {canRetryPayment(status)
                  ? "Try again"
                  : `Pay ${formatNaira(payment.userShare)}`}
              </Button>

              <p className="type-meta mt-3 text-center text-ink-muted">
                This settles one journey. The network doesn&rsquo;t hold a
                balance for you.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
