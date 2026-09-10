"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DriverTrack, UserRole } from "@/types/enums";

/**
 * Lightweight global session state. Server data lives in TanStack Query —
 * this holds only what the shell needs synchronously (role, active track,
 * drawer state).
 *
 * Who is signed in survives a reload, standing in for the session cookie a
 * real backend would set. Transient UI state (open drawers, the live ride)
 * deliberately does not persist.
 */

interface SessionState {
  role: UserRole;
  /** Which driver dashboard to render. Switching tracks needs approval. */
  driverTrack: DriverTrack;
  /** Which driver record the driver screens read. Set at sign-in. */
  activeDriverId: string | null;
  notificationsOpen: boolean;
  /** Ride currently in progress, surfaced as a persistent indicator. */
  activeRideId: string | null;
  activeRideMinutesRemaining: number | null;

  setRole: (role: UserRole) => void;
  setDriverTrack: (track: DriverTrack) => void;
  setActiveDriverId: (driverId: string | null) => void;
  openNotifications: () => void;
  closeNotifications: () => void;
  toggleNotifications: () => void;
  setActiveRide: (rideId: string | null, minutesRemaining?: number) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      role: UserRole.PASSENGER,
      driverTrack: DriverTrack.VOLUNTEER,
      activeDriverId: null,
      notificationsOpen: false,
      activeRideId: null,
      activeRideMinutesRemaining: null,

      setRole: (role) => set({ role }),
      setDriverTrack: (driverTrack) => set({ driverTrack }),
      setActiveDriverId: (activeDriverId) => set({ activeDriverId }),
      openNotifications: () => set({ notificationsOpen: true }),
      closeNotifications: () => set({ notificationsOpen: false }),
      toggleNotifications: () =>
        set((state) => ({ notificationsOpen: !state.notificationsOpen })),
      setActiveRide: (activeRideId, minutesRemaining) =>
        set({
          activeRideId,
          activeRideMinutesRemaining: minutesRemaining ?? null,
        }),
    }),
    {
      name: "kx-session",
      storage: createJSONStorage(() => localStorage),
      // Only identity persists — a drawer left open or a ride in flight
      // shouldn't come back after a reload.
      partialize: (state) => ({
        role: state.role,
        activeDriverId: state.activeDriverId,
      }),
    },
  ),
);
