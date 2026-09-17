import type { BusActor, FreeBusState, ScheduleBusesInput } from "@/types/free-buses";
import { addBuses, cancelBusSeat, fillNextBus, reserveBusSeat, scheduleBuses } from "@/lib/free-buses";
import { createFreeBusSeed } from "@/mocks/free-buses";

const DATABASE = "k-rides-free-buses";
const CHANGE_EVENT = "k-rides-buses-changed";
let connection: Promise<IDBDatabase> | undefined;

function database() {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("Bus bookings need browser storage. Enable it and try again."));
        return;
      }
      const open = indexedDB.open(DATABASE, 1);
      open.onupgradeneeded = () => open.result.createObjectStore("data");
      open.onsuccess = () => {
        open.result.onversionchange = () => { open.result.close(); connection = undefined; };
        resolve(open.result);
      };
      open.onerror = () => reject(new Error("We couldn't open bus bookings. Check browser storage and try again."));
      open.onblocked = () => reject(new Error("Close older K-Rides tabs and try again."));
    }).catch((error) => { connection = undefined; throw error; });
  }
  return connection;
}

function broadcast() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(DATABASE);
    channel.postMessage("changed");
    channel.close();
  }
}

/**
 * Browser-backed demo repository. IndexedDB serializes read/write transactions
 * across tabs, so seat allocation and its departure notice commit together.
 * A production API must preserve this transaction using database row locks.
 */
async function transaction<T>(apply: (state: FreeBusState) => T, write: boolean): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    // Reads also initialize the seed once, atomically, on the first visit.
    const tx = db.transaction("data", "readwrite");
    const store = tx.objectStore("data");
    const read = store.get("current");
    let result: T;
    let failure: unknown;
    read.onsuccess = () => {
      try {
        const state: FreeBusState = read.result ?? createFreeBusSeed();
        result = apply(state);
        if (write || !read.result) store.put(state, "current");
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      if (write) broadcast();
      resolve(result);
    };
    tx.onabort = () => reject(failure ?? new Error("Your booking wasn't saved. Please try again."));
    tx.onerror = () => reject(new Error("We couldn't save this change. Check available browser storage."));
  });
}

export const freeBusService = {
  snapshot: () => transaction((state) => state, false),
  schedule: (input: ScheduleBusesInput, actor: BusActor) => transaction(
    (state) => scheduleBuses(state, input, actor, crypto.randomUUID(), new Date().toISOString()), true,
  ),
  reserve: (allocationId: string, actor: BusActor) => transaction(
    (state) => reserveBusSeat(state, allocationId, actor, crypto.randomUUID(), new Date().toISOString()), true,
  ),
  cancel: (bookingId: string, actor: BusActor) => transaction(
    (state) => cancelBusSeat(state, bookingId, actor, new Date().toISOString()), true,
  ),
  addBuses: (allocationId: string, count: number, capacity: number, model: string, actor: BusActor) => transaction(
    (state) => addBuses(state, allocationId, count, capacity, model, actor, new Date().toISOString()), true,
  ),
  fillNext: (allocationId: string, actor: BusActor) => transaction(
    (state) => fillNextBus(state, allocationId, actor, new Date().toISOString()), true,
  ),
  subscribe(onChange: () => void) {
    window.addEventListener(CHANGE_EVENT, onChange);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(DATABASE) : undefined;
    if (channel) channel.onmessage = onChange;
    return () => { window.removeEventListener(CHANGE_EVENT, onChange); channel?.close(); };
  },
};
