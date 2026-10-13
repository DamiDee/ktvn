"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GeoPoint } from "../domain/types";
import { RideSheet } from "../components/ride-sheet";
import { getMapProvider } from "../services";
import { usePassengerStore } from "../state/passenger-store";
import type { SheetHostProps } from "./panel-types";

/**
 * Centre-pin selection. The map moves beneath a fixed pin; when it settles,
 * the point under the pin is reverse-geocoded and the rider confirms it.
 */
export function PinConfirmPanel({ point, moving, onCoverChange, bottomOffset }: SheetHostProps & { point: GeoPoint | null; moving: boolean }) {
  const field = usePassengerStore((store) => store.draft.field);
  const setDraft = usePassengerStore((store) => store.setDraft);
  const choosePlace = usePassengerStore((store) => store.choosePlace);
  // ~11 m buckets: tiny drifts don't trigger a lookup.
  const key = point ? `${point.lat.toFixed(4)},${point.lng.toFixed(4)}` : null;

  const address = useQuery({
    queryKey: ["paid-rides", "reverse", key],
    queryFn: ({ signal }) => getMapProvider().reverseGeocode(point!, signal),
    enabled: Boolean(point) && !moving,
    staleTime: 10 * 60_000,
  });

  const resolving = moving || !point || address.isPending;
  const label = field === "pickup" ? "pickup" : "destination";

  return (
    <RideSheet
      label={`Confirm ${label}`}
      collapsible={false}
      onCoverChange={onCoverChange}
      bottomOffset={bottomOffset}
      resetKey="pin"
      peek={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDraft({ step: "search" })}
            aria-label="Back to search"
            className="ride-press -ml-2 flex size-11 items-center justify-center rounded-full hover:bg-[var(--surface-secondary)]"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <div>
            <h2 className="ride-heading-md">Set your {label}</h2>
            <p className="ride-caption">Drag the map to move the pin</p>
          </div>
        </div>
      }
      footer={
        <Button
          size="xl"
          block
          pill
          disabled={resolving || !address.data}
          onClick={() => address.data && choosePlace(field, address.data)}
        >
          Confirm {label}
        </Button>
      }
    >
      <div className="pb-1" aria-live="polite">
        {resolving ? (
          <div role="status" className="space-y-2 py-1" aria-label="Finding address">
            <div className="kx-skeleton h-4 w-2/3" />
            <div className="kx-skeleton h-3 w-1/2" />
          </div>
        ) : (
          <div className="py-1">
            <p className="ride-body-lg truncate font-semibold">{address.data?.name}</p>
            <p className="ride-caption truncate">{address.data?.secondary}</p>
          </div>
        )}
      </div>
    </RideSheet>
  );
}

/** The fixed pin drawn over the map's uncovered centre. */
export function CenterPin({ lifted, insets }: { lifted: boolean; insets: { top: number; bottom: number; left: number } }) {
  return (
    <div
      className="pointer-events-none absolute right-0 z-20 flex items-center justify-center"
      style={{ top: insets.top, bottom: insets.bottom, left: insets.left }}
      aria-hidden
    >
      <div className="relative -translate-y-[22px]">
        <div className={`transition-transform duration-200 ease-[var(--ride-ease)] ${lifted ? "-translate-y-2.5" : ""}`}>
          <svg width="34" height="46" viewBox="0 0 34 46" style={{ filter: "drop-shadow(0 6px 10px rgb(16 44 40 / 0.3))" }}>
            <path d="M17 45c0 0 16-17 16-27C33 8.6 25.8 1 17 1S1 8.6 1 18c0 10 16 27 16 27z" fill="var(--ride-marker-pickup)" />
            <circle cx="17" cy="17" r="6" fill="white" />
          </svg>
        </div>
        <span
          className={`absolute top-[44px] left-1/2 h-1.5 -translate-x-1/2 rounded-full bg-[rgb(16_44_40/0.3)] transition-all duration-200 ${lifted ? "w-2.5 opacity-60" : "w-4"}`}
        />
      </div>
    </div>
  );
}
