import type { EmergencyContact } from "@/types/models";

/** Response recipients used by the simulated emergency dispatch flow. */
export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: "emergency-police",
    name: "Nigeria Police emergency line",
    phone: "112",
    kind: "POLICE",
  },
  {
    id: "emergency-koinonia",
    name: "Koinonia Emergency Response Desk",
    phone: "Internal response channel",
    kind: "CHURCH",
  },
];
