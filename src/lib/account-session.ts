/** Non-secret account boundary. A stale task must never commit into a newer login. */
export class AccountSession {
  private revision = 0;
  private controller = new AbortController();
  private blocked = false;
  private listeners = new Set<() => void>();

  private externalRevision: () => string;

  constructor(externalRevision: () => string = () => "", initiallyBlocked = false) {
    this.externalRevision = externalRevision;
    this.blocked = initiallyBlocked;
  }

  getSnapshot = () => this.revision;
  isBlocked = () => this.blocked;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  capture() {
    const revision = this.revision;
    const external = this.externalRevision();
    const signal = this.controller.signal;
    const isCurrent = () => revision === this.revision && external === this.externalRevision() && !signal.aborted;
    return {
      signal,
      isCurrent,
      assertCurrent() { if (!isCurrent()) throw new DOMException("Account changed", "AbortError"); },
    };
  }

  replace(blocked: boolean) {
    this.controller.abort();
    this.controller = new AbortController();
    this.blocked = blocked;
    this.revision += 1;
    for (const listener of this.listeners) listener();
  }
}

const BOUNDARY_KEY = "kr-account-boundary";
function storedBoundary() {
  try { return localStorage.getItem(BOUNDARY_KEY) ?? ""; } catch { return ""; }
}
function storedBlocked() {
  try { return JSON.parse(storedBoundary() || "null")?.blocked === true; } catch { return false; }
}
export const accountSession = new AccountSession(storedBoundary, storedBlocked());

// Also clear data when the paid-rides stores have not been loaded in this tab.
function clearAccountStorage() {
  try {
    localStorage.removeItem("kx-rides:preferences");
    localStorage.removeItem("kx-rides:recent-places");
    localStorage.removeItem("kx-rides:current-ride-id");
    sessionStorage.removeItem("kx-rides:dismissed");
  } catch { /* Storage can be unavailable in private browsing. */ }
}

export async function accountResult<T>(scope: ReturnType<AccountSession["capture"]>, task: Promise<T>): Promise<T> {
  const result = await task;
  scope.assertCurrent();
  return result;
}

/** No credentials or account data are broadcast, only an opaque generation and gate. */
export function changeAccountSession(blocked: boolean) {
  clearAccountStorage();
  try { localStorage.setItem(BOUNDARY_KEY, JSON.stringify({ id: crypto.randomUUID(), blocked })); } catch { /* Per-tab fencing still works without storage. */ }
  accountSession.replace(blocked);
}

export function watchAccountSession() {
  const changed = (event: StorageEvent) => {
    if (event.key !== BOUNDARY_KEY && event.key !== "kr-freebus-user" && event.key !== null) return;
    clearAccountStorage();
    try {
      const boundary = JSON.parse(storedBoundary() || "null");
      accountSession.replace(boundary?.blocked !== false);
    } catch { accountSession.replace(true); }
  };
  window.addEventListener("storage", changed);
  return () => window.removeEventListener("storage", changed);
}

/** AbortSignal.any equivalent with deterministic listener cleanup for older browsers. */
export function combineSignals(signals: (AbortSignal | null | undefined)[]) {
  const controller = new AbortController();
  const active = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  const abort = () => controller.abort();
  for (const signal of active) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", abort, { once: true });
  }
  return { signal: controller.signal, dispose: () => active.forEach((signal) => signal.removeEventListener("abort", abort)) };
}
