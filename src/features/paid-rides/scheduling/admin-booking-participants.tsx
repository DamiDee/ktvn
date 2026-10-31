"use client";

import { useQuery } from "@tanstack/react-query";
import { adminData } from "@/features/admin/data/admin-data";
import { Button, ButtonLink } from "@/components/ui/button";
import { contactPhoneHref } from "@/features/admin/accounts/account-directory";
import type { ScheduledRide } from "./contract";

/** Profile vehicles are current records, not a vehicle reserved for this booking. */
export default function AdminBookingParticipants({ booking, viewerId }: { booking: ScheduledRide; viewerId?: string }) {
  const driver = useQuery({
    queryKey: ["paid-rides", "schedule-participants", viewerId, "driver", booking.driverId],
    queryFn: () => adminData.getDriver(booking.driverId!),
    enabled: Boolean(viewerId && booking.driverId), staleTime: 60_000, retry: false,
  });
  const passenger = useQuery({
    queryKey: ["paid-rides", "schedule-participants", viewerId, "passenger", booking.passengerId],
    queryFn: () => adminData.getPassenger(booking.passengerId),
    enabled: Boolean(viewerId), staleTime: 60_000, retry: false,
  });
  const vehicle = driver.data?.vehicle;
  const phone = (value?: string) => {
    const href = contactPhoneHref(value);
    return href ? <a href={href} className="underline underline-offset-4">{value}</a> : value || "Phone not provided";
  };
  return <div className="space-y-3 rounded-[var(--kx-radius-md)] bg-surface-nested p-3">
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div><dt className="ride-caption">Passenger</dt><dd className="mt-1 break-words font-medium">{passenger.data?.fullName || booking.passengerId}</dd><dd className="mt-1">{phone(passenger.data?.phone)}</dd></div>
      <div><dt className="ride-caption">Driver</dt><dd className="mt-1 break-words font-medium">{driver.data?.fullName || booking.driverId || "Not assigned"}</dd>{booking.driverId ? <dd className="mt-1">{phone(driver.data?.phone)}</dd> : null}</div>
      {booking.driverId ? <div className="sm:col-span-2"><dt className="ride-caption">Driver’s current vehicle</dt><dd className="mt-1">{vehicle?.plateNumber ? [vehicle.make, vehicle.model, vehicle.colour, vehicle.plateNumber].filter(Boolean).join(" · ") : "Vehicle details unavailable"}</dd><dd className="ride-caption mt-1">The vehicle reserved for this scheduled trip has not been supplied separately.</dd></div> : null}
    </dl>
    {passenger.isFetching || driver.isFetching ? <p role="status" className="ride-caption">Updating participant details…</p> : null}
    {passenger.isError || driver.isError ? <div role="status"><p className="ride-caption">Some contact details could not load. The booking remains visible.</p><Button size="sm" variant="ghost" onClick={() => { if (passenger.isError) void passenger.refetch(); if (driver.isError) void driver.refetch(); }}>Retry contact details</Button></div> : null}
    <div className="flex flex-wrap gap-2">
      <ButtonLink size="sm" variant="ghost" href={`/admin/passengers/${encodeURIComponent(booking.passengerId)}`}>Passenger profile</ButtonLink>
      {booking.driverId ? <ButtonLink size="sm" variant="ghost" href={`/admin/drivers/${encodeURIComponent(booking.driverId)}`}>Driver profile & review</ButtonLink> : null}
      {booking.rideId ? <ButtonLink size="sm" variant="ghost" href={`/admin/live-rides/${encodeURIComponent(booking.rideId)}`}>View linked ride</ButtonLink> : null}
    </div>
  </div>;
}
