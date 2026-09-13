"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin,
  Plus,
  Share2,
  ShieldAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import { Card, CardHeader, NestedTile } from "@/components/ui/card";
import { Button, IconButton } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusChip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { PageLoader } from "@/components/ui/route-loader";
import { PageHeader } from "@/components/layout/app-shell";
import { queryKeys } from "@/constants/query-keys";
import { userService } from "@/services";
import { PermissionState } from "@/types/enums";
import { createId } from "@/services/api-client";
import type { TrustedContact } from "@/types/models";

/**
 * The safety centre.
 *
 * Everything a member can set up before they travel, and a plain explanation
 * of what SOS actually does — deliberately without promising that any of it
 * makes a journey safe.
 */
export function SafetyCentre() {
  const { toast } = useToast();

  const { data: passenger, isLoading } = useQuery({
    queryKey: queryKeys.passenger.profile(),
    queryFn: () => userService.getCurrentPassenger(),
  });

  const [contacts, setContacts] = useState<TrustedContact[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", relationship: "" });

  const [autoShare, setAutoShare] = useState(false);
  const [shareArrival, setShareArrival] = useState(true);
  const [location, setLocation] = useState<PermissionState>(
    PermissionState.GRANTED,
  );

  if (isLoading || !passenger) {
    return <PageLoader message="Loading your safety settings" />;
  }

  const list = contacts ?? passenger.trustedContacts;

  function addContact() {
    if (!draft.name.trim() || !draft.phone.trim() || !draft.relationship.trim())
      return;

    setContacts([
      ...list,
      {
        id: createId("tc"),
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        relationship: draft.relationship.trim(),
      },
    ]);
    setDraft({ name: "", phone: "", relationship: "" });
    setAdding(false);
    toast({ title: "Trusted contact added", tone: "success" });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Safety"
        title="Before you travel"
        description="Set these up once and they're ready on every journey."
      />

      <div className="space-y-5">
        {/* SOS explainer */}
        <Card radius="xl" className="border-sos-500/25">
          <div className="flex items-start gap-3.5">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-sos-500 text-white">
              <ShieldAlert className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="type-card-title text-ink">SOS</p>
              <p className="type-meta mt-1.5 text-ink-secondary">
                During any active trip, SOS sits at the bottom of your journey
                screen — never inside a menu. Hold it for a moment and your
                location is sent to the safety team, who acknowledge and
                respond.
              </p>
              <p className="type-meta mt-2 text-ink-muted">
                Holding rather than tapping means it can&rsquo;t fire from a
                pocket. Let go before it fills and nothing is sent.
              </p>
            </div>
          </div>
        </Card>

        {/* Trusted contacts */}
        <Card radius="xl">
          <CardHeader
            title="Trusted contacts"
            description="People you can share a live trip with in one tap."
            action={
              <Button
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={() => setAdding(true)}
              >
                Add
              </Button>
            }
          />

          <div className="mt-5">
            {list.length === 0 ? (
              <EmptyState
                icon={UserRound}
                size="sm"
                title="No trusted contacts yet."
                description="Add someone you'd want to be able to follow your journey."
              />
            ) : (
              <ul className="space-y-2.5">
                {list.map((contact) => (
                  <li key={contact.id}>
                    <NestedTile className="flex items-center gap-3">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink-secondary ring-1 ring-line">
                        <UserRound className="size-4.5" strokeWidth={1.8} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="type-body truncate font-medium text-ink">
                          {contact.name}
                        </p>
                        <p className="type-meta truncate text-ink-muted">
                          {contact.relationship
                            ? `${contact.relationship} · ${contact.phone}`
                            : contact.phone}
                        </p>
                      </div>
                      <IconButton
                        icon={Trash2}
                        label={`Remove ${contact.name}`}
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setContacts(
                            list.filter((entry) => entry.id !== contact.id),
                          );
                          toast({ title: `${contact.name} removed` });
                        }}
                      />
                    </NestedTile>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Trip sharing */}
        <Card radius="xl">
          <CardHeader
            title="Trip sharing"
            description="Send a live link so someone can follow your journey."
            action={<Share2 className="size-4 text-ink-muted" strokeWidth={1.8} aria-hidden />}
          />

          <div className="mt-5 space-y-4">
            <Toggle
              checked={autoShare}
              onChange={(value) => {
                setAutoShare(value);
                toast({
                  title: value
                    ? "Journeys will be shared automatically"
                    : "Automatic sharing off",
                });
              }}
              label="Share every journey automatically"
              description="Your first trusted contact gets a live link as soon as a ride starts."
            />

            <div className="kx-hairline" role="presentation" />

            <Toggle
              checked={shareArrival}
              onChange={setShareArrival}
              label="Tell them when I arrive"
              description="Sharing ends with an arrival notice rather than going quiet."
            />
          </div>
        </Card>

        {/* Permissions */}
        <Card radius="xl">
          <CardHeader
            title="Location"
            description="Used to find a driver near you and keep the trip on the map."
          />

          <NestedTile className="mt-5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <MapPin className="size-4.5 shrink-0 text-ink-muted" strokeWidth={1.7} aria-hidden />
              <span className="type-body truncate text-ink-secondary">
                Location access
              </span>
            </div>

            {location === PermissionState.GRANTED ? (
              <StatusChip tone="active" dot>
                Allowed
              </StatusChip>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setLocation(PermissionState.GRANTED);
                  toast({ title: "Location access allowed", tone: "success" });
                }}
              >
                Enable location
              </Button>
            )}
          </NestedTile>

          {location !== PermissionState.GRANTED ? (
            <p className="type-meta mt-3 text-ink-muted">
              We couldn&rsquo;t access your location. Without it you can still
              request a ride, but matching may take longer.
            </p>
          ) : null}
        </Card>

        <p className="type-meta text-center text-ink-muted">
          These tools help you stay visible and reachable during a journey. They
          reduce risk rather than remove it, and the network doesn&rsquo;t
          provide insurance for rides.
        </p>
      </div>

      {/* Add contact */}
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a trusted contact"
        description="They'll be able to follow a journey when you share it with them."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={addContact}
              disabled={
                !draft.name.trim() ||
                !draft.phone.trim() ||
                !draft.relationship.trim()
              }
            >
              Add contact
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="Ifeoma Adeyemi"
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
            required
          />
          <Input
            label="Phone"
            type="tel"
            placeholder="+234 803 000 0000"
            value={draft.phone}
            onChange={(event) =>
              setDraft({ ...draft, phone: event.target.value })
            }
            required
          />
          <Input
            label="Relationship"
            placeholder="Sister"
            hint="So you can tell your contacts apart in a hurry."
            value={draft.relationship}
            onChange={(event) =>
              setDraft({ ...draft, relationship: event.target.value })
            }
            required
          />
        </div>
      </Modal>
    </div>
  );
}
