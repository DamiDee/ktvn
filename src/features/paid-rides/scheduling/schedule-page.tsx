"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { RidePage } from "../components/ride-page";
import { PageHeader } from "@/components/layout/app-shell";
import { RouteLoader } from "@/components/ui/route-loader";
import { ButtonLink } from "@/components/ui/button";
import { History } from "lucide-react";
import { localScheduleDemo, type ScheduleRole } from "./scheduled-trips";
import type { PassengerScheduleView } from "./passenger-schedules";

const Demo = dynamic(() => import("./schedule-demo"), { ssr: false, loading: () => <RouteLoader message="Preparing scheduled trips" /> });
const Api = dynamic(() => import("./api-schedule-screen"), { ssr: false, loading: () => <RouteLoader message="Loading scheduled bookings" /> });
const subscribe = () => () => {};
/** Real booking routes always use the API. Only the explicit local demo simulates. */
export function SchedulePage({ role, demo = false, view = "upcoming" }: { role: ScheduleRole; demo?: boolean; view?: PassengerScheduleView }) {
  const local = useSyncExternalStore(subscribe, () => localScheduleDemo(process.env.NODE_ENV, window.location.hostname), () => false);
  const content = demo ? local ? <Demo initialRole={role} /> : <RouteLoader message="Preparing scheduled trips" /> : <Api role={role} view={view} />;
  if (role === "admin") return <div className="kx-rides mx-auto max-w-5xl"><PageHeader eyebrow="Paid rides" title="Scheduled trips" description="Upcoming journeys and driver reservations." />{content}</div>;
  const history = role === "passenger" && view === "history";
  return <RidePage title={history ? "Scheduled trip history" : "Schedule trip"} subtitle={history ? "Your completed and cancelled bookings." : "A little planning for the journey ahead."} backHref={history ? "/rides/schedule" : undefined} action={role === "passenger" && !demo && !history ? <ButtonLink href="/rides/schedule/history" pill size="sm" variant="ghost" icon={History}>History</ButtonLink> : undefined}>{content}</RidePage>;
}
