export type ScreenWakeStatus = "inactive" | "requesting" | "active" | "unavailable";

/** One owner per session; async requests may finish after that session ends. */
export function maintainScreenWakeLock(
  page: Document,
  host: Window,
  wakeLock: WakeLock | undefined,
  onStatus: (status: ScreenWakeStatus) => void,
): () => void {
  if (!wakeLock) {
    onStatus("unavailable");
    return () => {};
  }

  let stopped = false;
  let pending = false;
  let sentinel: WakeLockSentinel | null = null;
  const release = (lock: WakeLockSentinel) => void lock.release().catch(() => undefined);

  const acquire = async () => {
    if (stopped || pending || (sentinel && !sentinel.released) || page.visibilityState !== "visible") return;
    pending = true;
    onStatus("requesting");
    try {
      const lock = await wakeLock.request("screen");
      if (stopped || page.visibilityState !== "visible") {
        release(lock);
        return;
      }
      sentinel = lock;
      lock.addEventListener("release", () => {
        if (sentinel !== lock) return;
        sentinel = null;
        if (!stopped) onStatus("unavailable");
      }, { once: true });
      onStatus(lock.released ? "unavailable" : "active");
    } catch {
      if (!stopped) onStatus("unavailable");
    } finally {
      pending = false;
    }
  };

  const onVisibility = () => {
    if (page.visibilityState === "visible") void acquire();
    else if (sentinel) {
      const lock = sentinel;
      sentinel = null;
      release(lock);
      onStatus("unavailable");
    }
  };
  // A gesture can retry a denied request. The timer also recovers an OS
  // release while visible, without an immediate release/retry loop.
  const retry = () => { void acquire(); };
  page.addEventListener("visibilitychange", onVisibility);
  page.addEventListener("pointerdown", retry);
  page.addEventListener("keydown", retry);
  host.addEventListener("pageshow", retry);
  host.addEventListener("focus", retry);
  const timer = host.setInterval(retry, 30_000);
  void acquire();

  return () => {
    stopped = true;
    host.clearInterval(timer);
    page.removeEventListener("visibilitychange", onVisibility);
    page.removeEventListener("pointerdown", retry);
    page.removeEventListener("keydown", retry);
    host.removeEventListener("pageshow", retry);
    host.removeEventListener("focus", retry);
    if (sentinel) release(sentinel);
    sentinel = null;
  };
}
