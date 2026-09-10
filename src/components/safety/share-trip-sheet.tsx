"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Check,
  Link2,
  MessageCircle,
  MessageSquare,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/modal";
import { StatusChip } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type { TrustedContact } from "@/types/models";

/**
 * Share Trip.
 *
 * Copy link, WhatsApp, SMS, or straight to a saved trusted contact. Sharing
 * stays active for the journey and the caller is told, so the trip screen can
 * show the live-sharing indicator.
 */
export function ShareTripSheet({
  open,
  onClose,
  shareUrl,
  trustedContacts = [],
  sharingActive,
  onSharingChange,
}: {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  trustedContacts?: TrustedContact[];
  sharingActive: boolean;
  onSharingChange: (active: boolean) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      onSharingChange(true);
      window.setTimeout(() => setCopied(false), 2200);
      toast({
        title: "Trip sharing enabled",
        description: "The link is on your clipboard.",
        tone: "success",
      });
    } catch {
      // Clipboard can be blocked; the link is still selectable below.
      toast({
        title: "Couldn't copy automatically",
        description: "Select the link below and copy it manually.",
        tone: "warning",
      });
    }
  }

  function shareVia(channel: "whatsapp" | "sms", label: string) {
    const message = `I'm on a Koinonia VTN journey. Follow it live: ${shareUrl}`;
    const href =
      channel === "whatsapp"
        ? `https://wa.me/?text=${encodeURIComponent(message)}`
        : `sms:?&body=${encodeURIComponent(message)}`;

    window.open(href, "_blank", "noopener,noreferrer");
    onSharingChange(true);
    toast({ title: `Shared via ${label}`, tone: "success" });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share your trip"
      description="Send someone a live link to this journey. They'll see the route and your progress until you arrive."
    >
      <div className="space-y-5">
        {sharingActive ? (
          <div className="flex items-center gap-2.5 rounded-[var(--kx-radius-md)] border border-success-500/30 bg-success-50 px-4 py-3 dark:bg-success-500/10">
            <span className="relative flex size-2 shrink-0">
              <span
                className="absolute inline-flex size-full rounded-full bg-success-500"
                style={{ animation: "kx-pulse-ring 2s ease-out infinite" }}
                aria-hidden
              />
              <span className="relative inline-flex size-2 rounded-full bg-success-500" />
            </span>
            <p className="type-meta font-medium text-ink">
              Live trip sharing active
            </p>
          </div>
        ) : null}

        {/* Copy link */}
        <div>
          <p className="type-micro mb-2 text-ink-muted">Trip link</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              aria-label="Trip link"
              onFocus={(event) => event.currentTarget.select()}
              className="type-meta h-11 min-w-0 flex-1 rounded-[var(--kx-radius-sm)] border border-line-strong bg-surface-nested px-3.5 text-ink-secondary outline-none"
            />
            <motion.button
              type="button"
              onClick={copyLink}
              whileTap={{ scale: 0.97 }}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-2 rounded-[var(--kx-radius-sm)] px-4 text-[0.875rem] font-medium transition-colors",
                copied
                  ? "bg-success-500 text-white"
                  : "bg-forest-800 text-white hover:bg-forest-700 dark:bg-gold-500 dark:text-forest-950 dark:hover:bg-gold-400",
              )}
            >
              {copied ? (
                <>
                  <Check className="size-4" strokeWidth={2.6} aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <Link2 className="size-4" strokeWidth={2} aria-hidden />
                  Copy
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* Channels */}
        <div>
          <p className="type-micro mb-2 text-ink-muted">Send via</p>
          <div className="grid grid-cols-2 gap-2.5">
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
                      onSharingChange(true);
                      toast({
                        title: `Shared with ${contact.name}`,
                        description: "They'll get a live link to this journey.",
                        tone: "success",
                      });
                    }}
                    className="flex w-full items-center gap-3 rounded-[var(--kx-radius-md)] border border-line bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-nested"
                  >
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-nested text-ink-secondary">
                      <UserRound className="size-4" strokeWidth={1.8} aria-hidden />
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

        {sharingActive ? (
          <button
            type="button"
            onClick={() => {
              onSharingChange(false);
              toast({ title: "Trip sharing stopped" });
            }}
            className="type-meta w-full text-center font-medium text-danger-600 underline-offset-4 hover:underline dark:text-red-300"
          >
            Stop sharing this trip
          </button>
        ) : null}
      </div>
    </Modal>
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
      className="flex items-center justify-center gap-2 rounded-[var(--kx-radius-md)] border border-line bg-surface px-4 py-3.5 text-[0.875rem] font-medium text-ink transition-[transform,border-color,box-shadow] duration-[165ms] hover:-translate-y-px hover:border-line-strong hover:shadow-sm"
    >
      <Icon className="size-4" strokeWidth={1.9} aria-hidden />
      {label}
    </button>
  );
}
