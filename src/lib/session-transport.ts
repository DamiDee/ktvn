/** Coalesce expired-access-token requests into one cookie-based refresh per tab. */
export function createSessionTransport(send: (path: string, options: RequestInit) => Promise<Response>, expired: () => void) {
  let pending: Promise<Response> | null = null;
  let version = 0;
  async function refresh() {
    if (!pending) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      pending = send("auth/refresh", { method: "POST", body: "{}", signal: controller.signal }).then((response) => {
        if (response.ok) version += 1;
        else if (response.status === 401 || response.status === 403) expired();
        return response;
      }).finally(() => { clearTimeout(timeout); pending = null; });
    }
    return pending;
  }
  return {
    async request(path: string, options: RequestInit = {}) {
      const startedAtVersion = version;
      let response = await send(path, options);
      if (response.status !== 401 || path.startsWith("auth/") || (path === "users" && options.method === "POST")) return response;
      if (startedAtVersion === version) {
        const renewed = await refresh();
        // Clone for concurrent callers; an unavailable refresh is not an expired session.
        if (!renewed.ok) return renewed.clone();
      }
      if (options.signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
      response = await send(path, options); // One replay only, never a retry loop.
      if (response.status === 401) expired();
      return response;
    },
    async settleRefresh() { await pending?.catch(() => undefined); },
  };
}
