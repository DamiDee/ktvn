"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { RidePage } from "../components/ride-page";
import { PageHeader } from "@/components/layout/app-shell";
import { RouteLoader } from "@/components/ui/route-loader";
import { localScheduleDemo, type ScheduleRole } from "./scheduled-trips";

const Demo = dynamic(() => import("./schedule-demo"), { ssr: false, loading: () => <RouteLoader message="Preparing scheduled trips" /> });
const Api = dynamic(() => import("./api-schedule-screen"), { ssr: false, loading: () => <RouteLoader message="Loading scheduled bookings" /> });
const subscribe = () => () => {};
/** Real booking routes always use the API. Only the explicit local demo simulates. */
export function SchedulePage({ role, demo = false }: { role: ScheduleRole; demo?: boolean }) {
  const local = useSyncExternalStore(subscribe, () => localScheduleDemo(process.env.NODE_ENV, window.location.hostname), () => false);
  const content = demo ? local ? <Demo initialRole={role} /> : <RouteLoader message="Preparing scheduled trips" /> : <Api role={role} />;
  if (role === "admin") return <div className="kx-rides mx-auto max-w-5xl"><PageHeader eyebrow="Paid rides" title="Scheduled trips" description="Upcoming journeys and driver reservations." />{content}</div>;
  return <RidePage title="Schedule trip" subtitle="A little planning for the journey ahead.">{content}</RidePage>;
}
