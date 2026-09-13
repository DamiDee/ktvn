"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Check,
  Copy,
  MessageCircle,
  MessageSquare,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/modal";
import { NestedTile } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { TRACK_LABEL } from "@/constants/status-presentation";
import { formatEta, formatPlate } from "@/lib/format";
import type { DriverTrack } from "@/types/enums";
import type { TrustedContact } from "@/types/models";

export interface TripShareDetails {
  reference: string;
  driverName: string;
  vehicle: string;
  plateNumber: string;
  track: DriverTrack;
  destination: string;
  etaMinutes?: number;
}

/**
 * Share Trip.
 *
 * What gets sent is who is driving, what they are driving and where the
 * journey ends — never a live position or a tracking link. Someone who cares
 * about a member travelling wants to know who they are with; they do not need
 * to watch a dot move across a map, and the member shouldn't have to hand over
 * their whereabouts to be looked after.
 */
export function ShareTripSheet({
  open,
  onClose,
  details,
  trustedContacts = [],
  onShared,
}: {
  open: boolean;
  onClose: () => void;
  details: TripShareDetails;
  trustedContacts?: TrustedContact[];
  onShared?: () => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const lines = [
    `I'm on a K-Rides journey (${details.reference}).`,
    `Driver: ${details.driverName}`,
    `Vehicle: ${details.vehicle} · ${formatPlate(details.plateNumber)}`,
    `Track: ${TRACK_LABEL[details.track]}`,
    `Heading to: ${details.destination}`,
    ...(details.etaMinutes !== undefined && details.etaMinutes > 0
      ? [`Expected arrival: about ${formatEta(details.etaMinutes)}`]
      : []),
  ];
  const message = lines.join("\n");

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      onShared?.();
      window.setTimeout(() => setCopied(false), 2200);
      toast({
        title: "Trip details copied",
        description: "Paste them wherever you like.",
        tone: "success",
      });
    } catch {
      // Clipboard can be blocked; the details are selectable above.
      toast({
        title: "Couldn't copy automatically",
        description: "Select the details above and copy them manually.",
        tone: "warning",
      });
    }
  }

  function shareVia(channel: "whatsapp" | "sms", label: string) {
    const href =
      channel === "whatsapp"
        ? `https://wa.me/?text=${encodeURIComponent(message)}`
        : `sms:?&body=${encodeURIComponent(message)}`;

    window.open(href, "_blank", "noopener,noreferrer");
    onShared?.();
    toast({ title: `Shared via ${label}`, tone: "success" });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share your trip"
      description="Send someone the driver and journey details. Your location is not shared."
    >
      <div className="space-y-5">
        {/* What will be sent, exactly as it will be sent */}
        <div>
          <p className="type-micro mb-2 text-ink-muted">What they&rsquo;ll see</p>
          <NestedTile>
            <dl className="space-y-2.5">
              <ShareRow label="Driver" value={details.driverName} />
              <ShareRow label="Vehicle" value={details.vehicle} />
              <ShareRow
                label="Plate"
                value={formatPlate(details.plateNumber)}
                numeric
              />
              <ShareRow label="Track" value={TRACK_LABEL[details.track]} />
              <ShareRow label="Going to" value={details.destination} />
              {details.etaMinutes !== undefined && details.etaMinutes > 0 ? (
                <ShareRow
                  label="Expected"
                  value={`About ${formatEta(details.etaMinutes)}`}
                />
              ) : null}
              <ShareRow
                label="Ride"
                value={details.reference}
                numeric
              />
            </dl>
          </NestedTile>
          <p className="type-meta mt-2 text-ink-muted">
            No live location and no tracking link is sent.
          </p>
        </div>

        {/* Channels */}
        <div>
          <p className="type-micro mb-2 text-ink-muted">Send via</p>
          <div className="grid grid-cols-3 gap-2.5">
            <ChannelButton
              icon={MessageCircle}
              label="WhatsApp"
              onClick={() => shareVia("whatsapp", "WhatsApp")}
            />
            <ChannelButton
              icon={MessageSquare}
              label="SMS"
              onClick={() => shareVia("sms", "SMS")}
            />
            <motion.button
              type="button"
              onClick={copyDetails}
              whileTap={{ scale: 0.97 }}
              className={cn(
                "flex h-[76px] flex-col items-center justify-center gap-2 rounded-[var(--kx-radius-md)] border text-[0.8125rem] font-medium transition-colors",
                copied
                  ? "border-success-500/40 bg-success-50 text-success-700 dark:bg-success-500/12 dark:text-success-300"
                  : "border-line bg-surface text-ink-secondary hover:bg-surface-nested hover:text-ink",
              )}
            >
              {copied ? (
                <Check className="size-5" strokeWidth={2.4} aria-hidden />
              ) : (
                <Copy className="size-5" strokeWidth={1.8} aria-hidden />
              )}
              {copied ? "Copied" : "Copy"}
            </motion.button>
          </div>
        </div>

        {/* Trusted contacts */}
        <div>
          <p className="type-micro mb-2 text-ink-muted">Trusted contacts</p>

          {trustedContacts.length === 0 ? (
            <p className="type-meta rounded-[var(--kx-radius-md)] border border-dashed border-line-strong px-4 py-4 text-center text-ink-muted">
              You haven&rsquo;t added a trusted contact yet. Add one in your
              profile to share journeys in a single tap.
            </p>
          ) : (
            <ul className="space-y-2">
              {trustedContacts.map((contact) => (
                <li key={contact.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onShared?.();
                      toast({
                        title: `Shared with ${contact.name}`,
                        description:
                          "They have the driver and journey details.",
                        tone: "success",
                      });
                    }}
                    className="flex min-h-14 w-full items-center gap-3 rounded-[var(--kx-radius-md)] border border-line bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-nested"
                  >
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-nested text-ink-secondary">
                      <UserRound
                        className="size-4"
                        strokeWidth={1.8}
                        aria-hidden
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="type-body block truncate font-medium text-ink">
                        {contact.name}
                      </span>
                      <span className="type-meta block truncate text-ink-muted">
                        {contact.relationship
                          ? `${contact.relationship} · ${contact.phone}`
                          : contact.phone}
                      </span>
                    </span>
                    <StatusChip tone="neutral">Send</StatusChip>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ShareRow({
  label,
  value,
  numeric,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
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

function ChannelButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[76px] flex-col items-center justify-center gap-2 rounded-[var(--kx-radius-md)] border border-line bg-surface text-[0.8125rem] font-medium text-ink-secondary transition-colors hover:bg-surface-nested hover:text-ink"
    >
      <Icon className="size-5" strokeWidth={1.8} aria-hidden />
      {label}
    </button>
  );
}
