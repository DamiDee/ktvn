"use client";

import { acceptSchedule, cancelSchedule, createSchedule, localScheduleDemo, matchDueSchedules, seedSchedules, type ScheduleState } from "./scheduled-trips";

const KEY = "krides-scheduled-trip-demo-v1";
function requireLocal() {
  if (typeof window === "undefined" || !localScheduleDemo(process.env.NODE_ENV, window.location.hostname)) throw new Error("Scheduled-trip simulation is available only on localhost in development.");
}
function read(): ScheduleState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as ScheduleState | null;
    if (raw && Number.isFinite(raw.now) && Array.isArray(raw.trips) && raw.trips.length <= 100 && Array.isArray(raw.notices) && raw.notices.length <= 50 && raw.trips.every((trip) =>
      trip && typeof trip.id === "string" && typeof trip.pickup === "string" && typeof trip.destination === "string" && typeof trip.passengerName === "string" && Number.isFinite(Date.parse(trip.departureAt)) && ["OPEN", "RESERVED", "MATCHED", "CANCELLED"].includes(trip.status))) return raw;
  } catch { /* A corrupt demo is replaced with synthetic fixtures. */ }
  return seedSchedules(Date.now());
}
let instance: ReturnType<typeof makeStore> | undefined;
function makeStore() {
  let state = read();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const sync = (event: StorageEvent) => { if (event.key === KEY) { state = read(); emit(); } };
  async function mutate(change: (state: ScheduleState) => ScheduleState) {
    requireLocal();
    if (!navigator.locks) throw new Error("Use a current browser with Web Locks to test first-come acceptance across tabs.");
    await navigator.locks.request(KEY, () => {
      const current = read();
      const next = change({ ...current, now: Math.max(current.now, Date.now()) });
      // Save before notifying: other tabs' accept attempts read the winner inside the same lock.
      localStorage.setItem(KEY, JSON.stringify(next));
      state = next; emit();
    });
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      if (listeners.size === 0) window.addEventListener("storage", sync);
      listeners.add(listener);
      return () => { listeners.delete(listener); if (listeners.size === 0) window.removeEventListener("storage", sync); };
    },
    create: (input: { pickup: string; destination: string; departureAt: string }) => mutate((current) => {
      if (current.trips.length >= 100) throw new Error("Reset this demo before creating more trips.");
      return createSchedule(current, { ...input, id: crypto.randomUUID() });
    }),
    accept: (tripId: string, driverId: string) => mutate((current) => matchDueSchedules(acceptSchedule(current, tripId, driverId), current.now)),
    cancel: (tripId: string) => mutate((current) => cancelSchedule(current, tripId)),
    advance: (now: number) => mutate((current) => matchDueSchedules(current, Math.max(now, current.now))),
    initialize: () => mutate((current) => current),
    tick: () => state.trips.some((trip) => trip.status === "RESERVED" && Date.parse(trip.departureAt) <= Math.max(state.now, Date.now()))
      ? mutate((current) => matchDueSchedules(current, current.now)) : Promise.resolve(),
    reset: () => mutate(() => seedSchedules(Date.now())),
  };
}
export function getScheduleDemoStore() {
  requireLocal();
  return instance ??= makeStore();
}
