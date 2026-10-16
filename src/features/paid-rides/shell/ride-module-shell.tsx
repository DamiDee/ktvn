"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CarFront, History, Inbox, LifeBuoy, MapPinned, MessageCircle, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { useIsDesktop } from "@/hooks/use-media-query";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { PAID_RIDES_FEATURES, PAID_RIDES_MODE } from "../config";
import { trackRideEvent } from "../analytics";
import { ERROR_COPY, toRideError } from "../domain/errors";
import { BubbleNav, type BubbleNavItem } from "../components/bubble-nav";
import { getRideService } from "../services";
import { useDriverStore } from "../state/driver-store";
import { usePassengerStore } from "../state/passenger-store";
import { usePreferencesStore } from "../state/preferences-store";
import { useDriverSession, usePassengerSession } from "../state/use-ride-sessions";
import { useSilentLocation } from "../location/use-location";
import { MockDevPanel } from "./mock-dev-panel";
import { RideModeSwitch } from "./mode-switch";

/**
 * Paid Rides shell: an immersive, full-viewport frame with its own bubble
 * navigation. It lives outside the passenger/driver shells on purpose — the
 * live Free Buses shell replaces any page under those paths — and it never
 * changes the rest of the application.
 *
 * It mounts exactly one session (passenger or driver, from the path), checks
 * the viewer's roles before showing driver screens, and exposes a tiny
 * context so full-screen surfaces can hide the navigation.
 */

export type RideRole = "passenger" | "driver";

interface ShellContextValue {
  role: RideRole;
  /** Space the floating nav occupies at the bottom on mobile, in px. */
  navInset: number;
  navHidden: boolean;
  setNavHidden: (hidden: boolean) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useRideShell(): ShellContextValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useRideShell must be used inside RideModuleShell");
  return value;
}

/** Hide the navigation while a full-screen surface (search, chat) is open. */
export function useHideRideNav(hidden: boolean): void {
  const { setNavHidden } = useRideShell();
  useEffect(() => {
    if (!hidden) return;
    setNavHidden(true);
    return () => setNavHidden(false);
  }, [hidden, setNavHidden]);
}

const NAV_HEIGHT = 64;
const NAV_GAP = 12;

function PassengerSession() {
  usePassengerSession();
  return null;
}

function DriverSession() {
  useDriverSession();
  return null;
}

export function RideModuleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const role: RideRole = pathname.startsWith("/rides/driver") ? "driver" : "passenger";
  const desktop = useIsDesktop();
  const [navHidden, setNavHidden] = useState(false);
  const setLastRole = usePreferencesStore((state) => state.setLastRole);
  const passengerUnread = usePassengerStore((store) => store.session.unread);
  const driverUnread = useDriverStore((store) => store.state.ride.unread);
  const offerWaiting = useDriverStore((store) => store.state.offer?.phase === "incoming");

  useSilentLocation();

  useEffect(() => {
    setLastRole(role);
  }, [role, setLastRole]);

  useEffect(() => {
    trackRideEvent("paid_ride_opened", { role });
  }, [role]);

  const viewer = useQuery({
    queryKey: ["paid-rides", "viewer"],
    queryFn: ({ signal }) => getRideService().getViewer(signal),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const navItems: BubbleNavItem[] = useMemo(
    () =>
      role === "driver"
        ? [
            { href: "/rides/driver", label: "Drive", icon: CarFront },
            { href: "/rides/driver/requests", label: "Requests", icon: Inbox, badge: offerWaiting ? 1 : 0 },
            ...(PAID_RIDES_FEATURES.chat ? [{ href: "/rides/driver/messages", label: "Messages", icon: MessageCircle, badge: driverUnread }] : []),
            { href: "/rides/driver/trips", label: "Trips", icon: History, match: (path) => path.startsWith("/rides/driver/trips") },
            { href: "/rides/driver/account", label: "Account", icon: UserRound },
          ]
        : [
            { href: "/rides", label: "Ride", icon: MapPinned, match: (path) => path === "/rides" || path === "/rides/current" },
            { href: "/rides/history", label: "Activity", icon: History, match: (path) => path.startsWith("/rides/history") || /^\/rides\/(?!driver|messages|safety|account)[^/]+$/.test(path) },
            ...(PAID_RIDES_FEATURES.chat
              ? [{ href: "/rides/messages", label: "Messages", icon: MessageCircle, badge: passengerUnread, match: (path: string) => path === "/rides/messages" || path.endsWith("/chat") }]
              : []),
            { href: "/rides/safety", label: "Safety", icon: LifeBuoy, match: (path) => path === "/rides/safety" || path.endsWith("/safety") },
            { href: "/rides/account", label: "Account", icon: UserRound },
          ],
    [role, passengerUnread, driverUnread, offerWaiting],
  );

  const context = useMemo<ShellContextValue>(
    () => ({ role, navInset: desktop || navHidden ? 0 : NAV_HEIGHT + NAV_GAP * 2, navHidden, setNavHidden }),
    [role, desktop, navHidden],
  );

  const viewerError = viewer.error ? toRideError(viewer.error) : null;
  const forbidden = role === "driver" && viewer.data && !viewer.data.roles.includes("driver");

  let body: ReactNode = children;
  if (viewer.isPending) {
    body = <CenteredState><p role="status">Verifying your Paid Rides account…</p></CenteredState>;
  } else if (viewerError?.code === "unauthorized") {
    body = (
      <CenteredState>
        <EmptyState icon={CarFront} title="Sign in to use Paid Rides" description="Your session has ended." action={<ButtonLink href="/login">Sign in</ButtonLink>} />
      </CenteredState>
    );
  } else if (viewerError) {
    body = <CenteredState><EmptyState icon={CarFront} title={ERROR_COPY[viewerError.code].title} description={ERROR_COPY[viewerError.code].body} action={<button type="button" className="underline" onClick={() => void viewer.refetch()}>Try again</button>} /></CenteredState>;
  } else if (forbidden) {
    body = (
      <CenteredState>
        <EmptyState
          icon={CarFront}
          title="Driving isn't set up on your account"
          description="Only verified Paid Rides drivers can go online. You can still book rides."
          action={<ButtonLink href="/rides">Book a ride</ButtonLink>}
        />
      </CenteredState>
    );
  }

  return (
    <ShellContext.Provider value={context}>
      <div className="kx-rides fixed inset-0 overflow-hidden" data-role={role}>
        {viewer.data && !viewerError && !forbidden ? (role === "driver" ? <DriverSession /> : <PassengerSession />) : null}
        <div className="absolute inset-0">{body}</div>
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 z-40 flex justify-center px-3 transition-[opacity,transform] duration-300 ease-[var(--ride-ease)] lg:right-6 lg:left-auto lg:px-0",
            navHidden && "pointer-events-none translate-y-6 opacity-0",
          )}
          style={{ bottom: desktop ? 24 : `calc(${NAV_GAP}px + var(--ride-safe-bottom))` }}
          aria-hidden={navHidden || undefined}
          inert={navHidden || undefined}
        >
          <BubbleNav items={navItems} label={role === "driver" ? "Driver navigation" : "Paid Rides navigation"} />
        </div>
        <div
          className={cn(
            "pointer-events-none absolute left-3 z-30 transition-[opacity,transform] duration-300 ease-[var(--ride-ease)] lg:left-[calc(25rem+2.5rem)]",
            navHidden && "-translate-y-3 opacity-0",
          )}
          style={{ top: desktop ? 16 : "calc(var(--ride-safe-top) + 12px)" }}
          aria-hidden={navHidden || undefined}
          inert={navHidden || undefined}
        >
          <RideModeSwitch />
        </div>
        {PAID_RIDES_MODE === "mock" ? <MockDevPanel role={role} /> : null}
      </div>
    </ShellContext.Provider>
  );
}

function CenteredState({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center bg-[var(--kx-bg)] px-6 pb-24">{children}</div>;
}
