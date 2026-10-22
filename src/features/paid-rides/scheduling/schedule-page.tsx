"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { CalendarClock } from "lucide-react";
import { RidePage } from "../components/ride-page";
import { PageHeader } from "@/components/layout/app-shell";
import { RouteLoader } from "@/components/ui/route-loader";
import { localScheduleDemo, type ScheduleRole } from "./scheduled-trips";

const Demo = dynamic(() => import("./schedule-demo"), { ssr: false, loading: () => <RouteLoader message="Preparing scheduled trips" /> });
const subscribe = () => () => {};
export function SchedulePage({ role }: { role: ScheduleRole }) {
  const local = useSyncExternalStore(subscribe, () => localScheduleDemo(process.env.NODE_ENV, window.location.hostname), () => false);
  const content = local ? <Demo initialRole={role} /> : <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-8 text-center" aria-labelledby="schedule-coming-soon">
    <CalendarClock className="mx-auto size-12 text-[var(--text-secondary)]" aria-hidden />
    <p className="ride-label mt-5">Coming soon</p>
    <h2 id="schedule-coming-soon" className="ride-heading-lg mt-2">Plan your next journey ahead</h2>
    <p className="ride-body-sm mx-auto mt-3 max-w-md text-[var(--text-secondary)]">{role === "passenger" ? "Book a trip for a future date and time. We’ll let you know when scheduling is ready." : role === "driver" ? "See upcoming trip requests and reserve a journey before its departure day." : "Review upcoming trips and see which driver has accepted each journey."}</p>
    <p className="ride-caption mt-4">Scheduled bookings aren’t available yet.</p>
  </section>;
  if (role === "admin") return <div className="kx-rides mx-auto max-w-5xl"><PageHeader eyebrow="Paid rides" title="Scheduled trips" description="Upcoming journeys and driver reservations." />{content}</div>;
  return <RidePage title="Schedule trip" subtitle="A little planning for the journey ahead.">{content}</RidePage>;
}
