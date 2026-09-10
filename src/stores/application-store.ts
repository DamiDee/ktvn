"use client";

import { create } from "zustand";
import { DriverTrack, DocumentType } from "@/types/enums";
import type { VerificationDocument } from "@/types/models";
import type {
  IdentityValues,
  LicenceValues,
  VehicleValues,
} from "@/features/verification/application-schemas";

/**
 * Draft state for the driver application.
 *
 * Kept out of the form components so a driver can move back and forth between
 * steps without losing anything, and so the review step can read every answer
 * from one place.
 */

interface ApplicationState {
  stepIndex: number;
  identity: Partial<IdentityValues>;
  licence: Partial<LicenceValues>;
  vehicle: Partial<VehicleValues>;
  track: DriverTrack | null;
  documents: Partial<Record<DocumentType, VerificationDocument>>;
  submitted: boolean;

  setStepIndex: (index: number) => void;
  next: (total: number) => void;
  back: () => void;

  setIdentity: (values: IdentityValues) => void;
  setLicence: (values: LicenceValues) => void;
  setVehicle: (values: VehicleValues) => void;
  setTrack: (track: DriverTrack) => void;
  setDocument: (type: DocumentType, doc: VerificationDocument | null) => void;
  markSubmitted: () => void;
  reset: () => void;
}

const INITIAL = {
  stepIndex: 0,
  identity: {},
  licence: {},
  vehicle: {},
  track: null,
  documents: {},
  submitted: false,
} as const;

export const useApplicationStore = create<ApplicationState>((set) => ({
  ...INITIAL,

  setStepIndex: (stepIndex) => set({ stepIndex }),
  next: (total) =>
    set((state) => ({ stepIndex: Math.min(total - 1, state.stepIndex + 1) })),
  back: () => set((state) => ({ stepIndex: Math.max(0, state.stepIndex - 1) })),

  setIdentity: (identity) => set({ identity }),
  setLicence: (licence) => set({ licence }),
  setVehicle: (vehicle) => set({ vehicle }),
  setTrack: (track) => set({ track }),

  setDocument: (type, doc) =>
    set((state) => {
      const documents = { ...state.documents };
      if (doc) documents[type] = doc;
      else delete documents[type];
      return { documents };
    }),

  markSubmitted: () => set({ submitted: true }),
  reset: () => set({ ...INITIAL, identity: {}, licence: {}, vehicle: {}, documents: {} }),
}));
