"use client";

import { Download, Share2, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { KoinoniaMark } from "@/components/ui/route-loader";
import {
  PAYMENT_PRESENTATION,
  RIDE_TYPE_LABEL,
} from "@/constants/status-presentation";
import { formatDateTime, formatNaira } from "@/lib/format";
import { RideType } from "@/types/enums";
import type { Receipt } from "@/types/models";

/**
 * A digital receipt. Professional track only — a volunteer ride produces no
 * receipt because there is nothing to receipt.
 */
export function ReceiptCard({
  receipt,
  compact = false,
  className,
}: {
  receipt: Receipt;
  compact?: boolean;
  className?: string;
}) {
  const { toast } = useToast();
  const shared = receipt.rideType === RideType.SHARED;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--kx-radius-xl)] border border-line bg-surface",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <KoinoniaMark className="size-5 text-forest-800 dark:text-gold-400" />
          <div>
            <p className="type-micro text-ink-muted">Receipt</p>
            <p className="type-numeric text-[0.875rem] font-semibold text-ink">
              {receipt.reference}
            </p>
          </div>
        </div>
        <StatusBadge
          presentation={PAYMENT_PRESENTATION[receipt.paymentStatus]}
        />
      </div>

      {/* Body */}
      <dl className="divide-y divide-line px-5">
        <Row label="Ride" value={receipt.rideReference} numeric />
        <Row label="Date" value={formatDateTime(receipt.issuedAt)} />
        {!compact ? <Row label="Driver" value={receipt.driverName} /> : null}
        <Row label="Passenger" value={receipt.passengerName} />
        <Row label="From" value={receipt.origin} />
        <Row label="To" value={receipt.destination} />
        <Row
          label="Ride type"
          value={
            shared
              ? `${RIDE_TYPE_LABEL[receipt.rideType]} · ${receipt.riders} riders`
              : RIDE_TYPE_LABEL[receipt.rideType]
          }
        />
      </dl>

      {/* Totals */}
      <div className="border-t border-line bg-surface-nested px-5 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="type-meta text-ink-secondary">Route fare</span>
          <span className="type-numeric text-[0.9375rem] text-ink">
            {formatNaira(receipt.routeFare)}
          </span>
        </div>

        {shared ? (
          <div className="mt-2 flex items-baseline justify-between gap-4">
            <span className="type-meta flex items-center gap-1.5 text-ink-secondary">
              <Users className="size-3.5" strokeWidth={2} aria-hidden />
              Split {receipt.riders} ways
            </span>
            <span className="type-numeric text-[0.875rem] text-ink-muted">
              ÷ {receipt.riders}
            </span>
          </div>
        ) : null}

        <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-line pt-3">
          <span className="type-card-title text-ink">
            {shared ? "Your share" : "Total"}
          </span>
          <span className="type-numeric text-[1.375rem] font-semibold text-ink">
            {formatNaira(receipt.userShare)}
          </span>
        </div>
      </div>

      {/* Actions */}
      {!compact ? (
        <div className="flex gap-2.5 border-t border-line px-5 py-4">
          <Button
            variant="secondary"
            size="md"
            icon={Download}
            className="flex-1"
            onClick={() =>
              toast({
                title: "Receipt downloaded",
                description: `${receipt.reference} saved to your device.`,
                tone: "success",
              })
            }
          >
            Download
          </Button>
          <Button
            variant="ghost"
            size="md"
            icon={Share2}
            className="flex-1"
            onClick={() =>
              toast({ title: "Receipt link copied", tone: "success" })
            }
          >
            Share
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="type-meta shrink-0 text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "type-meta min-w-0 truncate text-right font-medium text-ink",
          numeric && "type-numeric",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
