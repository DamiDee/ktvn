export type PaidRidesMode = "off" | "mock" | "api";

export function resolvePaidRidesConnection(input: {
  mode?: string;
  freeBusesMode?: string;
  apiBaseUrl?: string;
  freeBusApiBaseUrl?: string;
  realtimeUrl?: string;
}) {
  const explicit = input.mode?.trim();
  const mode: PaidRidesMode = explicit === "off" || explicit === "mock" || explicit === "api"
    ? explicit : input.freeBusesMode === "demo" ? "mock" : "api";
  const apiBaseUrl = (input.apiBaseUrl?.trim() || input.freeBusApiBaseUrl?.trim() || "https://api.freebus.cloud/api/v1").replace(/\/+$/, "");
  // The backend exposes the shared authenticated socket at the server root.
  const socket = new URL("/rides/ws", `${apiBaseUrl}/`);
  socket.protocol = socket.protocol === "https:" ? "wss:" : "ws:";
  return { mode, apiBaseUrl, realtimeUrl: input.realtimeUrl?.trim() || socket.toString() };
}
