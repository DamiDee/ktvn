/** Bound billable proxy requests; direct browser Maps SDK calls use Google's key restrictions. */
export function createGoogleRequestGuard(now: () => number = Date.now, limit = 300) {
  const windows = new Map<string, { start: number; count: number }>();
  return (request: Request): Response | null => {
    const origin = request.headers.get("origin");
    const url = new URL(request.url);
    // Next may see a loopback URL behind the deployment's reverse proxy.
    const host = request.headers.get("host") ?? url.host;
    const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.slice(0, -1);
    const sameOrigin = !origin || origin === url.origin || origin === `${protocol}://${host}`;
    if (request.headers.get("sec-fetch-site") === "cross-site" || !sameOrigin) {
      return Response.json({ message: "Cross-site routing requests are not allowed." }, { status: 403 });
    }
    const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
    const time = now();
    if (windows.size > 2_000) for (const [key, value] of windows) if (time - value.start >= 60_000) windows.delete(key);
    let window = windows.get(ip);
    if (!window || time - window.start >= 60_000) {
      if (windows.size >= 10_000 && !windows.has(ip)) return Response.json({ message: "Routing is busy. Please retry shortly." }, { status: 429, headers: { "Retry-After": "60" } });
      window = { start: time, count: 0 }; windows.set(ip, window);
    }
    window.count++;
    return window.count > limit ? Response.json({ message: "Too many map requests. Please retry shortly." }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((60_000 - (time - window.start)) / 1000))) } }) : null;
  };
}
export const guardGoogleRequest = createGoogleRequestGuard();
