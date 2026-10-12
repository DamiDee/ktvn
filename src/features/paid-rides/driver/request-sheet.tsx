"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAID_RIDES_CONFIG } from "../config";
import { vibrate } from "../capabilities";
import { offerSecondsLeft, offerTotalSeconds, type OfferState } from "../domain/driver-session";
import { formatDistance, formatDuration, formatMoney } from "../domain/format";
import { RideSheet } from "../components/ride-sheet";
import { CountdownRing } from "../components/countdown-ring";
import { MetricRow, RatingPill, RouteStops } from "../components/ride-ui";
import { PinCharacter } from "../components/characters";
import { useDriverStore } from "../state/driver-store";
import { notifyRide } from "../notifications/ride-notifications";

/**
 * Incoming ride request. Accept is the dominant action; Decline is quiet.
 * Pressing Accept only *asks* — the sheet waits for the server's answer and
 * handles every outcome: accepted, already taken, expired, ineligible,
 * network error.
 */

const UNAVAILABLE_COPY = {
  taken: { title: "Another driver got this one", body: "It was assigned before your acceptance reached us. Stay online for the next request." },
  expired: { title: "This request expired", body: "It's been offered to another driver." },
  ineligible: { title: "You can't take this ride", body: "Your vehicle or account doesn't match this ride type." },
  failed: { title: "We couldn't confirm that", body: "Your connection dropped while accepting. If the ride was assigned to you, it will appear here in a moment." },
} as const;

export function RequestSheet({ offer, onCoverChange }: { offer: OfferState; onCoverChange: (cover: { bottom: number; left: number }) => void }) {
  const accept = useDriverStore((store) => store.acceptOffer);
  const decline = useDriverStore((store) => store.declineOffer);
  const dismiss = useDriverStore((store) => store.dismissOffer);
  const dispatch = useDriverStore((store) => store.dispatch);
  const fallback = PAID_RIDES_CONFIG.offerFallbackTtlSeconds;
  const [now, setNow] = useState(() => Date.now());
  const o = offer.offer;
  const secondsLeft = offerSecondsLeft(o, now, fallback);
  const total = offerTotalSeconds(o, fallback);

  useEffect(() => {
    vibrate([80, 60, 80]);
    void notifyRide("New ride request", `${formatMoney(o.earning ?? { amountMinor: 0, currency: "NGN" })} · pickup ${formatDistance(o.pickupDistanceMeters)} away`, { tag: `offer-${o.offerId}`, url: "/rides/driver" });
  }, [o]);

  useEffect(() => {
    if (offer.phase !== "incoming") return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [offer.phase]);

  useEffect(() => {
    if (offer.phase === "incoming" && secondsLeft === 0) dispatch({ type: "OFFER_TIMED_OUT", offerId: o.offerId });
  }, [offer.phase, secondsLeft, dispatch, o.offerId]);

  const unavailable = offer.phase === "taken" || offer.phase === "expired" || offer.phase === "ineligible" || offer.phase === "failed";

  if (unavailable) {
    const copy = UNAVAILABLE_COPY[offer.phase as keyof typeof UNAVAILABLE_COPY];
    return (
      <RideSheet
        label="Request unavailable"
        collapsible={false}
        onCoverChange={onCoverChange}
        resetKey={`unavailable-${o.offerId}`}
        peek={
          <div className="flex items-center gap-4 py-1">
            <PinCharacter mood="confused" size={46} />
            <div>
              <h2 className="ride-heading-md">{copy.title}</h2>
              <p className="ride-body-sm text-[var(--text-secondary)]">{copy.body}</p>
            </div>
          </div>
        }
        footer={
          <Button size="lg" block pill variant="subtle" onClick={dismiss}>
            Back to waiting
          </Button>
        }
      />
    );
  }

  const accepting = offer.phase === "accepting";

  return (
    <RideSheet
      label="New ride request"
      collapsible={false}
      onCoverChange={onCoverChange}
      resetKey={`offer-${o.offerId}`}
      maxHeight="72dvh"
      peek={
        <motion.div initial={{ scale: 0.98 }} animate={{ scale: 1 }} className="flex items-center gap-4 pt-1">
          <div className="min-w-0 flex-1">
            <p className="ride-label">New request · {o.optionName}</p>
            <p className="ride-num mt-1 text-[2.25rem] leading-none font-semibold tracking-[-0.04em]">
              {o.earning ? formatMoney(o.earning) : "—"}
            </p>
            <p className="ride-body-sm mt-1 text-[var(--text-secondary)]">
              {o.earning ? "Your earning · " : ""}pickup {formatDistance(o.pickupDistanceMeters)} · {formatDuration(o.pickupEtaSeconds)} away
            </p>
          </div>
          <CountdownRing secondsLeft={accepting ? Math.max(secondsLeft, 1) : secondsLeft} totalSeconds={total} />
        </motion.div>
      }
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-2.5">
          <Button variant="subtle" size="xl" pill disabled={accepting || offer.phase === "declining"} loading={offer.phase === "declining"} loadingLabel="" onClick={() => void decline()} className="px-6">
            Decline
          </Button>
          <Button size="xl" pill loading={accepting} loadingLabel="Confirming" disabled={offer.phase === "declining"} onClick={() => void accept()}>
            Accept ride
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="flex items-center gap-2">
          <p className="ride-body font-semibold">{o.passenger.displayName}</p>
          {o.passenger.rating ? <RatingPill rating={o.passenger.rating} /> : null}
          {o.shared ? (
            <span className="ride-caption inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ride-info)_12%,transparent)] px-2 py-0.5 font-semibold text-[var(--ride-info)]">
              <Users className="size-3" aria-hidden /> Shared
            </span>
          ) : null}
        </div>
        <RouteStops pickup={o.pickup} destination={o.destination} />
        <MetricRow
          items={[
            { label: "Trip", value: o.tripDistanceMeters !== null ? formatDistance(o.tripDistanceMeters) : "—" },
            { label: "Duration", value: o.tripDurationSeconds !== null ? formatDuration(o.tripDurationSeconds) : "—" },
            { label: "To pickup", value: formatDuration(o.pickupEtaSeconds) },
          ]}
        />
      </div>
    </RideSheet>
  );
}
