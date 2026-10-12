/**
 * Analytics hook point. The app has no analytics provider yet, so events are
 * published as a DOM CustomEvent (`kx-rides:analytics`) that a provider can
 * subscribe to later. Payloads never include coordinates, addresses, names
 * or ride contents — only the event name and coarse, non-identifying props.
 */

export type RideAnalyticsEvent =
  | "paid_ride_opened"
  | "destination_search_started"
  | "destination_selected"
  | "fare_viewed"
  | "ride_requested"
  | "driver_matched"
  | "ride_cancelled"
  | "chat_opened"
  | "sos_opened"
  | "sos_sent"
  | "trip_started"
  | "trip_completed"
  | "driver_rated"
  | "pip_enabled"
  | "driver_went_online"
  | "driver_accepted_request";

type SafeProps = Record<string, string | number | boolean>;

export function trackRideEvent(name: RideAnalyticsEvent, props: SafeProps = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("kx-rides:analytics", { detail: { name, props, at: Date.now() } }));
}
