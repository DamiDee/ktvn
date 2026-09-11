"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SafetyState {
  /** Automatically start live sharing when a matched journey begins. */
  autoShare: boolean;
  shareArrival: boolean;
  selectedContactIds: string[];
  setAutoShare: (active: boolean) => void;
  setShareArrival: (active: boolean) => void;
  toggleContact: (contactId: string) => void;
}

export const useSafetyStore = create<SafetyState>()(
  persist(
    (set) => ({
      autoShare: true,
      shareArrival: true,
      selectedContactIds: ["tc-1"],
      setAutoShare: (autoShare) => set({ autoShare }),
      setShareArrival: (shareArrival) => set({ shareArrival }),
      toggleContact: (contactId) =>
        set((state) => ({
          selectedContactIds: state.selectedContactIds.includes(contactId)
            ? state.selectedContactIds.filter((id) => id !== contactId)
            : [...state.selectedContactIds, contactId],
        })),
    }),
    {
      name: "kx-safety-preferences",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
