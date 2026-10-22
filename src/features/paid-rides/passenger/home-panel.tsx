"use client";

import Link from "next/link";
import { ChevronRight, Clock3, LocateFixed, Search, ShieldCheck } from "lucide-react";
import { greetingForHour } from "@/lib/format";
import Image from "next/image";
import { Brand } from "@/components/layout/brand";
import { FluidAccent } from "@/components/ui/fluid-accent";
import { useLocationStore } from "../location/location-store";
import { RideSheet } from "../components/ride-sheet";
import { usePassengerStore } from "../state/passenger-store";
import { usePreferencesStore } from "../state/preferences-store";
import type { SheetHostProps } from "./panel-types";

/** IDLE: the calm starting point — one obvious question, "Where to?". */
export function HomePanel({ onCoverChange, bottomOffset }: SheetHostProps) {
  const draft = usePassengerStore((store) => store.draft);
  const setDraft = usePassengerStore((store) => store.setDraft);
  const choosePlace = usePassengerStore((store) => store.choosePlace);
  const recent = usePreferencesStore((state) => state.recentPlaces).slice(0, 3);
  const locationStatus = useLocationStore((state) => state.status);
  const requestLocation = useLocationStore((state) => state.request);

  const openSearch = (field: "pickup" | "destination") => setDraft({ step: "search", field });

  return (
    <RideSheet
      label="Plan a ride"
      onCoverChange={onCoverChange}
      bottomOffset={bottomOffset}
      resetKey="home"
      peek={
        <div className="relative isolate">
          <FluidAccent className="opacity-60" />
          <div className="relative">
          <div className="mb-5 hidden items-center justify-between lg:flex"><Brand /><span className="ride-caption">Abuja</span></div>
          <p className="ride-caption mb-1">{greetingForHour()} · Let’s go somewhere</p>
          <h1 className="mb-5 hidden text-[2.5rem] leading-[1.08] font-medium tracking-[-.06em] lg:block">A good day<br />starts with a ride.</h1>
          <button
            type="button"
            onClick={() => openSearch("destination")}
            className="premium-ride-search ride-press flex h-16 w-full items-center gap-3 border border-[var(--border-strong)] px-4 text-left"
          >
            <span className="premium-ride-search-icon flex size-10 shrink-0 items-center justify-center"><Search className="size-5" aria-hidden /></span>
            <span className="ride-heading-md flex-1 text-[var(--text-primary)]">Where to?</span>
            <span className="ride-caption hidden rounded-full bg-[var(--surface-primary)] px-2.5 py-1 font-semibold min-[360px]:inline">Now</span>
          </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <button
          type="button"
          onClick={() => openSearch("pickup")}
          className="ride-press flex w-full items-center gap-3 rounded-[var(--ride-radius-md)] py-1 text-left"
        >
          <span aria-hidden className="ml-1 size-3 shrink-0 rounded-full border-[3px] border-[var(--ride-marker-pickup)]" />
          <span className="min-w-0 flex-1">
            <span className="ride-caption block">Pickup</span>
            <span className="ride-body block truncate font-medium">
              {draft.pickup ? draft.pickup.name : locationStatus === "requesting" ? "Finding your location…" : "Set pickup location"}
            </span>
          </span>
          <ChevronRight className="size-4 text-[var(--text-tertiary)]" aria-hidden />
        </button>

        {!draft.pickup && (locationStatus === "idle" || locationStatus === "denied" || locationStatus === "unavailable" || locationStatus === "timeout") ? (
          <div className="flex items-start gap-3 rounded-[var(--ride-radius-md)] bg-[var(--ride-brand-soft)] p-3.5">
            <LocateFixed className="mt-0.5 size-4.5 shrink-0 text-[var(--kx-forest-700)] dark:text-[var(--kx-gold-300)]" aria-hidden />
            <div className="min-w-0 flex-1 ride-body-sm">
              <p className="font-semibold">{locationStatus === "denied" ? "Location is turned off for K-Rides" : "Find your pickup faster"}</p>
              <p className="text-[var(--text-secondary)]">
                {locationStatus === "denied"
                  ? "Allow location in your browser's site settings, or type your pickup address."
                  : locationStatus === "idle"
                    ? "Share your location so your driver finds you. It's only used while you book and ride."
                    : "We couldn't get a GPS fix. Move near a window or type your pickup."}
              </p>
              {locationStatus !== "denied" ? (
                <button type="button" onClick={() => void requestLocation()} className="mt-2 font-semibold text-[var(--kx-forest-700)] underline-offset-4 hover:underline dark:text-[var(--kx-gold-300)]">
                  {locationStatus === "idle" ? "Use my location" : "Try again"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <Link href="/rides/schedule" className="ride-press flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-4">
          <span className="flex items-center gap-3"><Clock3 className="size-5" aria-hidden /><span><span className="ride-body-sm block font-semibold">Schedule trip</span><span className="ride-caption">Plan a journey ahead</span></span></span><ChevronRight className="size-4" aria-hidden />
        </Link>

        {recent.length ? (
          <div>
            <p className="ride-label mb-1.5">Recent</p>
            <ul className="-mx-2">
              {recent.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => choosePlace("destination", place)}
                    className="ride-press flex w-full items-center gap-3 rounded-[var(--ride-radius-md)] px-2 py-2.5 text-left hover:bg-[var(--surface-secondary)]"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
                      <Clock3 className="size-4 text-[var(--text-secondary)]" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="ride-body block truncate font-medium">{place.name}</span>
                      <span className="ride-caption block truncate">{place.secondary}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="relative hidden h-44 overflow-hidden rounded-[24px] lg:block">
          <Image src="/images/abuja/krides-boulevard.webp" alt="K-Rides campaign artwork: a sedan on an Abuja-inspired boulevard." fill sizes="380px" className="object-cover object-[50%_55%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#101827]/90 to-transparent" />
          <p className="absolute right-5 bottom-5 left-5 text-xl font-medium tracking-tight text-white">Your everyday.<br />A little more extraordinary.</p>
        </div>
        <p className="ride-caption flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-[var(--ride-success)]" aria-hidden />
          Every driver is a verified member of the community.
        </p>
      </div>
    </RideSheet>
  );
}
