"use client";

import { create } from "zustand";
import { accountSession } from "@/lib/account-session";
import { createJSONStorage, persist } from "zustand/middleware";
import { STORAGE_KEYS } from "../config";
import type { Place } from "../domain/types";

/**
 * Per-device preferences. Only non-sensitive values persist: no ride data,
 * no contact details, no location history beyond the rider's own recent
 * destinations (which they can clear).
 */

const RECENT_LIMIT = 6;

interface PreferencesState {
  recentPlaces: Place[];
  pipPromptDismissed: boolean;
  notificationPromptDismissed: boolean;
  /** Which role the Paid Rides shell last showed, for the role switcher. */
  lastRole: "passenger" | "driver";
  addRecentPlace(place: Place): void;
  clearRecentPlaces(): void;
  dismissPipPrompt(): void;
  dismissNotificationPrompt(): void;
  setLastRole(role: "passenger" | "driver"): void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      recentPlaces: [],
      pipPromptDismissed: false,
      notificationPromptDismissed: false,
      lastRole: "passenger",
      addRecentPlace: (place) =>
        set((state) => ({
          recentPlaces: [
            { ...place, source: "recent" as const },
            ...state.recentPlaces.filter((item) => item.id !== place.id && item.name !== place.name),
          ].slice(0, RECENT_LIMIT),
        })),
      clearRecentPlaces: () => set({ recentPlaces: [] }),
      dismissPipPrompt: () => set({ pipPromptDismissed: true }),
      dismissNotificationPrompt: () => set({ notificationPromptDismissed: true }),
      setLastRole: (lastRole) => set({ lastRole }),
    }),
    {
      name: STORAGE_KEYS.preferences,
      storage: createJSONStorage(() => localStorage),
      // Coordinates are rounded so the stored list isn't a precise location log.
      partialize: (state) => ({
        recentPlaces: state.recentPlaces.map((place) => ({
          ...place,
          point: { lat: Math.round(place.point.lat * 1e4) / 1e4, lng: Math.round(place.point.lng * 1e4) / 1e4 },
        })),
        pipPromptDismissed: state.pipPromptDismissed,
        notificationPromptDismissed: state.notificationPromptDismissed,
        lastRole: state.lastRole,
      }),
    },
  ),
);

export function rememberRecentPlace(place: Place): void {
  usePreferencesStore.getState().addRecentPlace(place);
}

accountSession.subscribe(() => {
  usePreferencesStore.setState({ recentPlaces: [], lastRole: "passenger", pipPromptDismissed: false, notificationPromptDismissed: false });
  try { localStorage.removeItem(STORAGE_KEYS.currentRideId); } catch { /* unavailable */ }
});
