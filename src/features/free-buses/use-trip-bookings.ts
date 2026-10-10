"use client";
import { useMemo } from "react";
import { tripBookingSummary } from "@/lib/journey-experience";
import type { ApiBooking } from "@/types/freebus-api";
import { useLiveQuery } from "./live-queries";

/**
 * People booked on every trip, read once from the bookings list so nobody has to open
 * each bus. A booking counts the member plus their children; cancelled and revoked
 * seats are left out.
 */
export function useTripBookings() {
  const bookings = useLiveQuery<ApiBooking[]>("bookings");
  const summary = useMemo(() => tripBookingSummary(Array.isArray(bookings.data) ? bookings.data : []), [bookings.data]);
  return { summary, ready: !bookings.isPending, error: bookings.error };
}
