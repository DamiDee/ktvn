import { PAID_RIDES_MODE } from "../config";
import { MockRealtimeClient } from "./mock-realtime-client";
import type { RideRealtimeClient } from "./realtime-client";
import { WebSocketRealtimeClient } from "./websocket-realtime-client";

/**
 * One realtime connection per tab, shared by the passenger and driver
 * sessions. Created lazily on the client only.
 */
let client: RideRealtimeClient | null = null;

export function getRealtimeClient(): RideRealtimeClient {
  client ??= PAID_RIDES_MODE === "api" ? new WebSocketRealtimeClient() : new MockRealtimeClient();
  return client;
}

export function getMockRealtimeClient(): MockRealtimeClient | null {
  const instance = getRealtimeClient();
  return instance instanceof MockRealtimeClient ? instance : null;
}

export type { RideRealtimeClient } from "./realtime-client";
