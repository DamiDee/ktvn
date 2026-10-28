"use client";

import { create } from "zustand";
import { accountSession } from "@/lib/account-session";

/** A saved ONLINE flag alone does not confirm live driver presence. */
export const useDriverPresenceStore = create<{
  phase: "idle" | "syncing" | "ready" | "failed";
  error: string | null;
}>()(() => ({ phase: "idle", error: null }));

accountSession.subscribe(() => useDriverPresenceStore.setState({ phase: "idle", error: null }));
