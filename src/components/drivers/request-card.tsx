"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, Clock, MapPin, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RatingValue } from "@/components/ui/rating";
import { StatusChip, VerifiedBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatNaira, shortName } from "@/lib/format";
import { RIDE_TYPE_LABEL, TRACK_LABEL, TRACK_TONE } from "@/constants/status-presentation";
import { DriverTrack } from "@/types/enums";
import type { RideRequest } from "@/types/models";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

/**
 * Incoming ride request with an expiry countdown ring.
 *
 * On the volunteer track no fare is rendered at all — the request object has
 * no `fare`, so there is nothing to accidentally print.
 */
export function RequestCard({
  request,
  onAccept,
  onDecline,
  className,
}: {
  request: RideRequest;
  onAccept?: (request: RideRequest) => void;
  onDecline?: (request: RideRequest) => void;
  className?: string;
}) {
  const { toast } = useToast();
  const { prefersReduced } = useReducedMotionSafe();
  const [remaining, setRemaining] = useState(request.expiresInSeconds);
  const [resolved, setResolved] = useState<"accepted" | "declined" | null>(null);

  useEffect(() => {
    if (resolved) return;
    const timer = setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resolved]);

  const fraction = remaining / request.expiresInSeconds;
  const expired = remaining === 0;
  const isProfessional = request.track === DriverTrack.PROFESSIONAL;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
      className={cn(
        "rounded-[var(--kx-radius-lg)] border bg-surface p-4 sm:p-5",
        resolved === "accepted"
          ? "border-success-500/40"
          : expired || resolved === "declined"
            ? "border-line opacity-60"
            : "border-line-strong shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            name={request.passengerName}
            src={request.passengerAvatarUrl}
            size="md"
            verified={request.passengerVerified}
          />
          <div className="min-w-0">
            <p className="type-card-title truncate text-ink">
              {shortName(request.passengerName)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <VerifiedBadge label="Verified" />
              <RatingValue value={request.passengerRating} />
            </div>
          </div>
        </div>

        {/* Countdown ring */}
        {!resolved && !expired ? (
          <div className="relative shrink-0">
            <svg viewBox="0 0 40 40" className="size-10 -rotate-90" aria-hidden>
              <circle
                cx="20"
                cy="20"
                r="17"
                fill="none"
                stroke="var(--kx-border-strong)"
                strokeWidth="3"
              />
              <circle
                cx="20"
                cy="20"
                r="17"
                fill="none"
                stroke={fraction < 0.3 ? "var(--kx-danger-500)" : "var(--kx-gold-500)"}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 17}
                strokeDashoffset={2 * Math.PI * 17 * (1 - fraction)}
                style={{
                  transition: prefersReduced ? "none" : "stroke-dashoffset 1s linear",
                }}
              />
            </svg>
            <span className="type-numeric absolute inset-0 flex items-center justify-center text-[0.75rem] font-semibold text-ink">
              {remaining}
            </span>
            <span className="sr-only">{remaining} seconds to respond</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-2.5">
        <RouteLine label="Pickup" location={request.pickup.label} detail={request.pickup.address} />
        <RouteLine
          label="Destination"
          location={request.destination.label}
          detail={request.destination.address}
          isDestination
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusChip tone={TRACK_TONE[request.track]}>
          {TRACK_LABEL[request.track]}
        </StatusChip>
        <StatusChip tone="neutral">{RIDE_TYPE_LABEL[request.rideType]}</StatusChip>
        <StatusChip tone="neutral" icon={Clock}>
          +{request.detourMinutes} min from your route
        </StatusChip>

        {/* Product Rule 1: fare only on the professional track. */}
        {isProfessional && request.fare !== undefined ? (
          <span className="type-numeric ml-auto text-[1.0625rem] font-semibold text-ink">
            {formatNaira(request.fare)}
          </span>
        ) : (
          <span className="type-meta ml-auto text-ink-muted">
            Volunteer ride · No payment required
          </span>
        )}
      </div>

      {resolved ? (
        <p
          className={cn(
            "type-meta mt-4 text-center font-medium",
            resolved === "accepted" ? "text-success-700 dark:text-emerald-300" : "text-ink-muted",
          )}
        >
          {resolved === "accepted" ? "Request accepted" : "Request declined"}
        </p>
      ) : expired ? (
        <p className="type-meta mt-4 text-center text-ink-muted">
          This request expired.
        </p>
      ) : (
        <div className="mt-4 flex gap-2.5">
          <Button
            variant="subtle"
            size="lg"
            icon={X}
            className="min-w-0 flex-1"
            onClick={() => {
              setResolved("declined");
              onDecline?.(request);
            }}
          >
            Decline
          </Button>
          <Button
            variant="primary"
            size="lg"
            icon={Check}
            className="min-w-0 flex-[1.6]"
            onClick={() => {
              setResolved("accepted");
              onAccept?.(request);
              toast({
                title: "Request accepted",
                description: `${shortName(request.passengerName)} has been told you're on the way.`,
                tone: "success",
              });
            }}
          >
            Accept
          </Button>
        </div>
      )}
    </motion.article>
  );
}

function RouteLine({
  label,
  location,
  detail,
  isDestination = false,
}: {
  label: string;
  location: string;
  detail: string;
  isDestination?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 flex size-4 shrink-0 items-center justify-center" aria-hidden>
        {isDestination ? (
          <MapPin className="size-4 text-forest-700 dark:text-gold-400" strokeWidth={2} />
        ) : (
          <span className="size-2.5 rounded-full border-2 border-forest-700 dark:border-gold-400" />
        )}
      </span>
      <div className="min-w-0">
        <p className="type-micro text-ink-muted">{label}</p>
        <p className="type-body truncate font-medium text-ink">{location}</p>
        <p className="type-meta truncate text-ink-muted">{detail}</p>
      </div>
    </div>
  );
}
