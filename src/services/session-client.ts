import { accountSession, changeAccountSession, combineSignals } from "../lib/account-session.ts";
import { createSessionTransport } from "../lib/session-transport.ts";

const clients = new Map<string, ReturnType<typeof createSessionTransport>>();
const localLocks = new Map<string, Promise<unknown>>();

/** Login, logout and refresh mutate the same cookies: serialize them together. */
export async function withSessionLock<T>(base: string, work: () => Promise<T>): Promise<T> {
  const name = `kr-auth:${base.replace(/\/+$/, "")}`;
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request(name, work);
  const previous = localLocks.get(name) ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(work);
  localLocks.set(name, task);
  try { return await task; }
  finally { if (localLocks.get(name) === task) localLocks.delete(name); }
}

function refreshVersion(base: string) {
  try { return localStorage.getItem(`kr-refresh:${base}`) ?? ""; } catch { return ""; }
}

export function getSessionClient(apiBase: string) {
  const base = apiBase.replace(/\/+$/, "");
  const existing = clients.get(base);
  if (existing) return existing;
  const transport = createSessionTransport(async (path, options) => {
    const scope = accountSession.capture();
    const auth = path.startsWith("auth/");
    const registration = path === "users" && options.method === "POST";
    if (accountSession.isBlocked() && !registration && (!auth || path === "auth/refresh")) throw new DOMException("Session changing", "AbortError");
    const send = async () => {
      scope.assertCurrent();
      // Let an already-sent refresh settle before the auth lock is released.
      // Aborting the caller must not let logout race a late Set-Cookie response.
      const merged = combineSignals([options.signal, path === "auth/refresh" ? undefined : scope.signal]);
      try {
        const response = await fetch(`${base}/${path}`, {
          ...options, signal: merged.signal, credentials: "include", cache: "no-store",
          headers: { "Content-Type": "application/json", Accept: "application/json", ...options.headers },
        });
        scope.assertCurrent();
        return response;
      } finally { merged.dispose(); }
    };
    if (path !== "auth/refresh") return send();
    const version = refreshVersion(base);
    return withSessionLock(base, async () => {
      scope.assertCurrent();
      // Another tab already rotated the cookie while this tab waited for the lock.
      if (refreshVersion(base) !== version) return new Response("{}", { status: 200 });
      const response = await send();
      if (response.ok) {
        try { localStorage.setItem(`kr-refresh:${base}`, crypto.randomUUID()); } catch { /* In-tab refresh is still shared. */ }
      }
      return response;
    });
  }, () => {
    try { localStorage.removeItem("kr-freebus-user"); } catch { /* unavailable */ }
    changeAccountSession(true);
  });
  const client = {
    ...transport,
    async request(path: string, options: RequestInit = {}) {
      const scope = accountSession.capture();
      const merged = combineSignals([options.signal, scope.signal]);
      try {
        const response = await transport.request(path, { ...options, signal: merged.signal });
        scope.assertCurrent();
        return response;
      } finally { merged.dispose(); }
    },
  };
  clients.set(base, client);
  return client;
}
