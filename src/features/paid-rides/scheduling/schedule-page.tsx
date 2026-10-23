"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { CalendarClock } from "lucide-react";
import { RidePage } from "../components/ride-page";
import { PageHeader } from "@/components/layout/app-shell";
import { RouteLoader } from "@/components/ui/route-loader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RouteMedallion } from "@/components/ui/states";
import { localScheduleDemo, type ScheduleRole } from "./scheduled-trips";

const Demo = dynamic(() => import("./schedule-demo"), { ssr: false, loading: () => <RouteLoader message="Preparing scheduled trips" /> });
const Api = dynamic(() => import("./api-schedule-screen"), { ssr: false, loading: () => <RouteLoader message="Loading scheduled bookings" /> });
const subscribe = () => () => {};
export function SchedulePage({ role }: { role: ScheduleRole }) {
  const local = useSyncExternalStore(subscribe, () => localScheduleDemo(process.env.NODE_ENV, window.location.hostname), () => false);
  const api = useSyncExternalStore(subscribe, () => new URLSearchParams(window.location.search).get("source") === "api", () => false);
  const content = local ? api ? <Api role={role} /> : <Demo initialRole={role} /> : <Card radius="xl" className="px-6 py-10 text-center sm:py-14">
    <section aria-labelledby="schedule-coming-soon">
    <div className="mb-5 flex justify-center"><RouteMedallion icon={CalendarClock} /></div>
    <Badge variant="gold">Coming soon</Badge>
    <h2 id="schedule-coming-soon" className="ride-heading-lg mt-2">Plan your next journey ahead</h2>
    <p className="ride-body-sm mx-auto mt-3 max-w-md text-[var(--text-secondary)]">{role === "passenger" ? "Book a trip for a future date and time. We’ll let you know when scheduling is ready." : role === "driver" ? "See upcoming trip requests and reserve a journey before its departure day." : "Review upcoming trips and see which driver has accepted each journey."}</p>
    <p className="ride-caption mt-4">Scheduled bookings aren’t available yet.</p>
    </section>
  </Card>;
  if (role === "admin") return <div className="kx-rides mx-auto max-w-5xl"><PageHeader eyebrow="Paid rides" title="Scheduled trips" description="Upcoming journeys and driver reservations." />{content}</div>;
  return <RidePage title="Schedule trip" subtitle="A little planning for the journey ahead.">{content}</RidePage>;
}
