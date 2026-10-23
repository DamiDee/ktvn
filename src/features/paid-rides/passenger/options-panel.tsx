"use client";

import { useEffect, useId, useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Banknote, ChevronDown, CreditCard, Landmark, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { collapseVariants } from "@/lib/motion";
import { trackRideEvent } from "../analytics";
import { ERROR_COPY, toRideError } from "../domain/errors";
import { formatDistance, formatDuration, formatMoney } from "../domain/format";
import type { FareEstimate, PaymentMethodSummary, RideOption } from "../domain/types";
import { RideSheet } from "../components/ride-sheet";
import { FareBreakdown, OptionCardSkeleton, VehicleIllustration } from "../components/ride-ui";
import { usePassengerStore } from "../state/passenger-store";
import type { SheetHostProps } from "./panel-types";

/**
 * ROUTE_PREVIEW / FARE_ESTIMATE: the route is on the map; here the rider
 * picks a ride, sees what it costs and how it's paid, then requests.
 * Details stay folded until asked for (progressive disclosure).
 */
export function OptionsPanel({ estimate, onCoverChange, bottomOffset }: SheetHostProps & { estimate: UseQueryResult<FareEstimate> }) {
  const draft = usePassengerStore((store) => store.draft);
  const setDraft = usePassengerStore((store) => store.setDraft);
  const backToBooking = usePassengerStore((store) => store.backToBooking);
  const requestRide = usePassengerStore((store) => store.requestRide);
  const pending = usePassengerStore((store) => store.session.pending);
  const error = usePassengerStore((store) => (store.session.error?.action === "request" ? store.session.error.code : null));
  const clearError = usePassengerStore((store) => store.dispatch);
  const [showDetails, setShowDetails] = useState(false);
  const detailsId = useId();

  const data = estimate.data;
  const options = data?.options ?? [];
  const selected = options.find((option) => option.id === draft.optionId) ?? null;

  // Default to the first option with drivers nearby once prices arrive.
  useEffect(() => {
    if (!data) return;
    trackRideEvent("fare_viewed", { options: data.options.length });
    if (!draft.optionId || !data.options.some((option) => option.id === draft.optionId && bookable(option))) {
      const first = data.options.find((option) => option.available) ?? data.options.find(bookable);
      setDraft({ optionId: first?.id ?? null, paymentMethodId: draft.paymentMethodId ?? data.defaultPaymentMethodId });
    }
    // Only when a new estimate arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.estimateId]);

  // An expired estimate is refreshed rather than shown as an error.
  useEffect(() => {
    if (error === "estimate_expired") {
      clearError({ type: "CLEAR_ERROR" });
      void estimate.refetch();
    }
  }, [error, clearError, estimate]);

  const routeSummary = data ? `${formatDistance(data.route.distanceMeters)} · ${formatDuration(data.route.durationSeconds)}` : null;
  const payment = data?.paymentMethods.find((method) => method.id === (draft.paymentMethodId ?? data.defaultPaymentMethodId));

  return (
    <RideSheet
      label="Choose a ride"
      onCoverChange={onCoverChange}
      bottomOffset={bottomOffset}
      resetKey="options"
      maxHeight="66dvh"
      peek={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={backToBooking}
            aria-label="Back to trip details"
            className="ride-press -ml-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-[var(--surface-secondary)]"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="ride-heading-md truncate">To {draft.destination?.name}</h2>
            <p className="ride-caption ride-num">
              {routeSummary ?? "Calculating route…"}
              {data?.route.source === "approximate" ? " · approximate" : ""}
            </p>
          </div>
        </div>
      }
      footer={
        <div className="space-y-2.5">
          {error && error !== "estimate_expired" ? (
            <p role="alert" className="ride-body-sm rounded-[var(--ride-radius-sm)] bg-[var(--kx-danger-50)] px-3 py-2 text-[var(--kx-danger-700)] dark:bg-[color-mix(in_srgb,var(--kx-danger-500)_16%,transparent)] dark:text-red-200">
              <span className="font-semibold">{ERROR_COPY[error].title}.</span> {ERROR_COPY[error].body}
            </p>
          ) : null}
          <Button
            size="xl"
            block
            pill
            disabled={!selected || !bookable(selected) || !data}
            loading={pending === "request"}
            loadingLabel="Requesting"
            onClick={() => data && void requestRide(data)}
          >
            {selected ? `Request ${selected.name}` : "Choose a ride"}
            {selected ? <span className="ride-num font-semibold opacity-80">· {formatMoney(selected.fare.total)}</span> : null}
          </Button>
        </div>
      }
    >
      {estimate.isPending ? (
        <div role="status" className="space-y-2 pb-2" aria-busy aria-label="Loading ride options">
          <OptionCardSkeleton />
          <OptionCardSkeleton />
          <OptionCardSkeleton />
        </div>
      ) : estimate.isError ? (
        <div className="py-6 text-center" role="alert">
          <p className="ride-body font-semibold">We couldn&apos;t price this trip</p>
          <p className="ride-body-sm mt-1 text-[var(--text-secondary)]">{ERROR_COPY[toRideError(estimate.error).code].body}</p>
          <Button variant="subtle" pill className="mt-4" onClick={() => void estimate.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-4 pb-2">
          <div role="radiogroup" aria-label="Ride options" className="space-y-2">
            {options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                selected={option.id === draft.optionId}
                onSelect={() => setDraft({ optionId: option.id })}
              />
            ))}
          </div>

          {selected ? (
            <div className="rounded-[var(--ride-radius-md)] bg-[var(--surface-secondary)]">
              <button
                type="button"
                onClick={() => setShowDetails((value) => !value)}
                aria-expanded={showDetails}
                aria-controls={detailsId}
                className="ride-press flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="ride-body-sm font-semibold">Fare details</span>
                <ChevronDown className={cn("size-4 transition-transform duration-200", showDetails && "rotate-180")} aria-hidden />
              </button>
              <AnimatePresence initial={false}>
                {showDetails ? (
                  <motion.div id={detailsId} variants={collapseVariants} initial="initial" animate="animate" exit="exit" className="overflow-hidden">
                    <FareBreakdown fare={selected.fare} className="px-4 pb-4" />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}

          {data && data.paymentMethods.length ? (
            <PaymentPicker methods={data.paymentMethods} selectedId={payment?.id ?? null} onSelect={(id) => setDraft({ paymentMethodId: id })} />
          ) : null}
        </div>
      )}
    </RideSheet>
  );
}

/**
 * `available: false` with no reason is the backend's supply hint (no driver
 * online nearby right now); the rider may still request. A stated reason
 * means the product can't serve this trip at all.
 */
function bookable(option: RideOption): boolean {
  return option.available || !option.unavailableReason;
}

function OptionCard({ option, selected, onSelect }: { option: RideOption; selected: boolean; onSelect: () => void }) {
  // One clear number per card; the range lives in the fare details.
  const price = formatMoney(option.fare.total);
  const eta = option.pickupEtaSeconds ? Math.max(1, Math.ceil(option.pickupEtaSeconds / 60)) : null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={!bookable(option)}
      onClick={onSelect}
      className={cn(
        "ride-press relative flex w-full items-center gap-3.5 rounded-[var(--ride-radius-lg)] border p-3.5 text-left",
        selected ? "border-transparent" : "border-[var(--border-subtle)] hover:bg-[var(--surface-secondary)]",
        !bookable(option) && "opacity-55",
      )}
    >
      {selected ? (
        <motion.span
          layoutId="ride-option-highlight"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="absolute inset-0 rounded-[var(--ride-radius-lg)] bg-[color-mix(in_srgb,var(--ride-primary)_10%,var(--surface-primary))] ring-2 ring-[var(--ride-primary)]"
          aria-hidden
        />
      ) : null}
      <span className="relative flex w-16 shrink-0 justify-center">
        <VehicleIllustration vehicleClass={option.vehicleClass} className="h-9" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="ride-heading-md">{option.name}</span>
          <span className="ride-caption inline-flex items-center gap-0.5">
            {option.shared ? <Users className="size-3.5" aria-hidden /> : <UserRound className="size-3.5" aria-hidden />}
            <span className="ride-num">{option.capacity}</span>
            <span className="sr-only">{option.shared ? "seats you can book" : "seats"}</span>
          </span>
        </span>
        <span className="ride-caption block truncate">
          {!option.available ? (option.unavailableReason ?? "No drivers nearby yet") : eta ? `${eta} min away` : option.description}
        </span>
        {selected && bookable(option) ? <span className="ride-caption block truncate text-[var(--text-secondary)]">{option.description}</span> : null}
      </span>
      <span className="relative ride-num shrink-0 text-right text-[0.9375rem] font-semibold">{price}</span>
    </button>
  );
}

const PAYMENT_ICON = { cash: Banknote, card: CreditCard, wallet: CreditCard, transfer: Landmark } as const;

function PaymentPicker({ methods, selectedId, onSelect }: { methods: PaymentMethodSummary[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <fieldset>
      <legend className="ride-label mb-2">Pay with</legend>
      <div className="kx-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {methods.map((method) => {
          const Icon = PAYMENT_ICON[method.kind];
          const checked = method.id === selectedId;
          return (
            <label
              key={method.id}
              className={cn(
                "ride-press flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 text-[0.875rem] font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--ride-primary)]",
                checked ? "border-[var(--ride-primary)] bg-[color-mix(in_srgb,var(--ride-primary)_10%,transparent)] font-semibold" : "border-[var(--border-subtle)]",
              )}
            >
              <input type="radio" name="payment" className="sr-only" checked={checked} onChange={() => onSelect(method.id)} />
              <Icon className="size-4" aria-hidden />
              {method.label}
              {method.last4 ? <span className="ride-num text-[var(--text-tertiary)]">•••• {method.last4}</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
