"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Bell, ChevronRight, Inbox, LogOut, MapPinned, PictureInPicture2, Trash2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { AppearanceSettings } from "@/components/layout/appearance-settings";
import { RouteLoader } from "@/components/ui/route-loader";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { useMounted } from "@/hooks/use-media-query";
import { getRideCapabilities } from "../capabilities";
import { PAID_RIDES_MODE } from "../config";
import { firstName, formatDistance, formatMoney } from "../domain/format";
import { requestRideNotifications, rideNotificationPermission } from "../notifications/ride-notifications";
import { pipStrategy } from "../pip/use-picture-in-picture";
import { liveAuth } from "@/services/freebus-api";
import { useRideViewer } from "../hooks/use-ride-viewer";
import { AccountDetails } from "./account-details";
import { useDriverStore } from "../state/driver-store";
import { usePassengerStore } from "../state/passenger-store";
import { usePreferencesStore } from "../state/preferences-store";
import { SafetyCenter } from "../safety/safety-center";
import { PageSection, RidePage } from "../components/ride-page";
import { PersonAvatar } from "../components/ride-ui";

/** Safety tab: the safety centre for the current ride, or general guidance. */
export function SafetyPage({ role }: { role: "passenger" | "driver" }) {
  const passengerRide = usePassengerStore((store) => store.session.ride);
  const passengerAck = usePassengerStore((store) => store.session.sosAcknowledged);
  const driverRide = useDriverStore((store) => store.state.ride.ride);
  const driverAck = useDriverStore((store) => store.state.ride.sosAcknowledged);
  const ride = role === "driver" ? driverRide : passengerRide;
  return (
    <RidePage title="Safety" subtitle={ride ? "Tools for your current trip." : "Help is always one tap away."}>
      <SafetyCenter ride={ride} role={role} sosAcknowledged={role === "driver" ? driverAck : passengerAck} />
    </RidePage>
  );
}

function Row({ icon: Icon, title, detail, action }: { icon: typeof Bell; title: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
        <Icon className="size-[1.05rem]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="ride-body font-semibold">{title}</p>
        <p className="ride-caption">{detail}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * Account & preferences: identity, role switch, notification pre-permission,
 * floating-trip support, and the only stored personal data (recent places),
 * which can be cleared.
 */
export function AccountPage({ role }: { role: "passenger" | "driver" }) {
  const mounted = useMounted();
  const viewer = useRideViewer();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const recentPlaces = usePreferencesStore((state) => state.recentPlaces);
  const clearRecent = usePreferencesStore((state) => state.clearRecentPlaces);
  const [requested, setPermission] = useState<ReturnType<typeof rideNotificationPermission> | null>(null);
  const permission = mounted ? (requested ?? rideNotificationPermission()) : "unsupported";
  const capabilities = mounted ? getRideCapabilities() : null;
  const strategy = mounted ? pipStrategy() : "none";
  const canDrive = viewer.data?.roles.includes("driver");

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try { await liveAuth.logout(); }
    catch { /* Logout has already blocked this device's account session. */ }
    finally { queryClient.clear(); router.replace("/login"); }
  }

  return (
    <RidePage title="Account">
      <AppearanceSettings />
      <PageSection>
        <div className="flex items-center gap-4 rounded-[var(--ride-radius-lg)] bg-[var(--surface-primary)] p-4 shadow-[var(--kx-shadow-xs)]">
          {viewer.data ? <PersonAvatar name={viewer.data.displayName} src={viewer.data.avatarUrl} size={56} /> : <div className="kx-skeleton size-14 !rounded-full" />}
          <div className="min-w-0 flex-1">
            <p className="ride-heading-md truncate">{viewer.data?.displayName ?? "Loading…"}</p>
            <p className="ride-caption">
              {role === "driver" ? "Driving" : "Riding"}
              {PAID_RIDES_MODE === "mock" ? " · simulation" : ""}
            </p>
          </div>
        </div>
      </PageSection>

      {viewer.isPending ? <RouteLoader message="Loading your account" size="sm" className="py-6" /> : null}
      {viewer.isError ? <ErrorState title="We couldn't load your account." onRetry={() => viewer.refetch()} /> : null}
      {viewer.data ? <AccountDetails viewer={viewer.data} onRefresh={() => void viewer.refetch()} refreshing={viewer.isFetching} /> : null}

      {canDrive ? (
        <PageSection title="Mode">
          <Link
            href={role === "driver" ? "/rides" : "/rides/driver"}
            className="ride-press flex items-center gap-3.5 rounded-[var(--ride-radius-lg)] bg-[var(--surface-primary)] p-4 shadow-[var(--kx-shadow-xs)]"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-[var(--ride-brand-soft)]">
              <ArrowLeftRight className="size-[1.05rem]" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="ride-body block font-semibold">{role === "driver" ? "Switch to riding" : "Switch to driving"}</span>
              <span className="ride-caption block">{role === "driver" ? "Book a ride as a passenger" : "Go online and accept requests"}</span>
            </span>
            <ChevronRight className="size-4 text-[var(--text-tertiary)]" aria-hidden />
          </Link>
        </PageSection>
      ) : null}

      <PageSection title="Trip alerts">
        <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--ride-radius-lg)] bg-[var(--surface-primary)] shadow-[var(--kx-shadow-xs)]">
          <Row
            icon={Bell}
            title="Ride notifications"
            detail={
              permission === "granted"
                ? "On — we'll tell you when your driver is close, arrives, or messages you."
                : permission === "denied"
                  ? "Blocked in your browser settings. Allow notifications for this site to turn them on."
                  : permission === "unsupported"
                    ? "This browser doesn't support notifications."
                    : "Get told when your driver is close or arrives, even when K-Rides is in the background."
            }
            action={
              permission === "default" ? (
                <Button size="sm" pill onClick={async () => setPermission(await requestRideNotifications())}>
                  Turn on
                </Button>
              ) : null
            }
          />
          <Row
            icon={PictureInPicture2}
            title="Floating trip window"
            detail={
              strategy === "document"
                ? "Supported here: keep ETA visible in a small window during trips."
                : strategy === "video"
                  ? "Supported here as a compact video window during trips."
                  : capabilities?.standalone
                    ? "Not supported in this browser. Notifications keep you updated instead."
                    : "Not supported in this browser. Add K-Rides to your home screen and turn on notifications instead."
            }
          />
        </div>
      </PageSection>

      <PageSection title="Privacy">
        <div className="rounded-[var(--ride-radius-lg)] bg-[var(--surface-primary)] shadow-[var(--kx-shadow-xs)]">
          <Row
            icon={MapPinned}
            title="Recent places"
            detail={recentPlaces.length ? `${recentPlaces.length} saved on this device only.` : "Nothing saved on this device."}
            action={
              recentPlaces.length ? (
                <Button size="sm" variant="ghost" pill icon={Trash2} onClick={clearRecent}>
                  Clear
                </Button>
              ) : null
            }
          />
        </div>
        <p className="ride-caption mt-2 px-1">Your location is used only while you book, ride or drive, and stops being tracked when the trip ends.</p>
      </PageSection>

      <PageSection>
        {PAID_RIDES_MODE === "api" ? <Button variant="outline" block pill size="lg" icon={LogOut} loading={signingOut} loadingLabel="Signing out" onClick={() => void signOut()} className="mb-3">Sign out</Button> : null}
        <ButtonLink href="/" variant="subtle" block pill size="lg">
          Back to K-Rides
        </ButtonLink>
      </PageSection>
    </RidePage>
  );
}

/** Driver Requests tab: the live request (if any) and what to expect. */
export function DriverRequestsPage() {
  const offer = useDriverStore((store) => store.state.offer);
  const availability = useDriverStore((store) => store.state.availability);
  const ride = useDriverStore((store) => store.state.ride.ride);

  return (
    <RidePage title="Requests" subtitle={availability === "ONLINE" ? "You're online. New requests appear here and on your map." : undefined}>
      {offer && (offer.phase === "incoming" || offer.phase === "accepting") ? (
        <Link href="/rides/driver" className="ride-press block rounded-[var(--ride-radius-lg)] bg-[var(--ride-primary)] p-5 text-[var(--ride-on-primary)]">
          <p className="ride-label !text-current opacity-80">New request · {offer.offer.optionName}</p>
          <p className="ride-num mt-1 text-[2rem] font-semibold tracking-[-0.04em]">{offer.offer.earning ? formatMoney(offer.offer.earning) : "—"}</p>
          <p className="ride-body-sm">
            {firstName(offer.offer.passenger.displayName)} · pickup {formatDistance(offer.offer.pickupDistanceMeters)} away at {offer.offer.pickup.name}
          </p>
          <p className="ride-body mt-3 font-semibold">Open to accept →</p>
        </Link>
      ) : ride ? (
        <EmptyState icon={Inbox} title="You're on a trip" description="New requests pause until you finish this one." action={<ButtonLink href="/rides/driver">Back to trip</ButtonLink>} />
      ) : (
        <EmptyState
          icon={Inbox}
          title={availability === "ONLINE" ? "Waiting for requests" : "You're offline"}
          description={availability === "ONLINE" ? "Requests near you will appear here with a countdown to respond." : "Go online from the Drive tab to receive requests."}
          action={<ButtonLink href="/rides/driver">{availability === "ONLINE" ? "View map" : "Go to Drive"}</ButtonLink>}
        />
      )}
    </RidePage>
  );
}
