"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, BusFront, CalendarDays, History, MapPin, Route, ScanLine, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { apiTimestamp, watParts } from "@/lib/trips";
import type { ApiBus, ApiPoint, ApiRoute, ApiTrip } from "@/types/freebus-api";

export function TransportOverview({ buses, routes, trips, points }: { buses: ApiBus[]; routes: ApiRoute[]; trips: ApiTrip[]; points: ApiPoint[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const upcoming = trips.filter((t) => t.status === "NotStarted" && Date.parse(apiTimestamp(t.departure_time)) > now).sort((a, b) => Date.parse(apiTimestamp(a.departure_time)) - Date.parse(apiTimestamp(b.departure_time)));
  const next = upcoming[0];
  const nextRoute = routes.find((r) => r.id === next?.route_id);
  const when = next ? watParts(next.departure_time) : null;
  const available = buses.filter((b) => b.status !== "Maintenance").length;
  const boarding = buses.filter((b) => b.state === "Boarding" && b.status !== "Maintenance").length;
  const nextDay = when?.date ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(apiTimestamp(next!.departure_time))) : null;
  return <div className="space-y-6">
    <section className="relative isolate overflow-hidden rounded-[28px] border border-gold-300/20 bg-forest-900 p-6 text-white sm:p-8" aria-label="Next departure">
      <div className="pointer-events-none absolute -right-14 -top-28 size-80 rounded-full border-[40px] border-gold-300/5" aria-hidden />
      <div className="pointer-events-none absolute -bottom-36 right-24 size-72 rounded-full border border-gold-200/15" aria-hidden />
      <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-lg"><p className="flex items-center gap-2 text-xs font-medium tracking-[.16em] text-gold-300 uppercase"><Sparkles className="size-3.5" aria-hidden />Room for everyone</p><h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">Every journey starts with care.</h2><p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">Plan the service. Welcome the community. Get everyone there together.</p><ButtonLink href="/admin/free-buses/trips" size="sm" className="mt-5" iconRight={ArrowRight}>Plan a departure</ButtonLink></div>
        <Link href="/admin/free-buses/trips" className="group relative block min-w-0 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-sm transition-colors hover:bg-white/10 md:w-72"><span className="flex items-center justify-between gap-3 text-xs text-gold-200"><span>{next ? "NEXT DEPARTURE" : "THE NEXT CHAPTER"}</span><ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden /></span><p className="mt-3 text-xl font-semibold tabular-nums">{nextDay ? `${nextDay} · ${when?.time.slice(0, 5)}` : "A new journey awaits"}</p><p className="mt-1 text-xs text-white/55">{nextDay ? "Abuja time · WAT" : "Create a trip from any saved route"}</p><div className="mt-4 border-t border-white/10 pt-3"><p className="break-words text-sm text-white/80">{nextRoute?.name ?? (next ? "Scheduled trip" : `${routes.length} reusable ${routes.length === 1 ? "route" : "routes"} ready to explore`)}</p></div></Link>
      </div>
    </section>

    <div className="grid gap-3 sm:grid-cols-3">
      {[
        { label: "Buses in your fleet", value: buses.length, hint: `${available} operational · ${boarding} boarding`, icon: BusFront, path: "buses" },
        { label: "Upcoming departures", value: upcoming.length, hint: "Scheduled and yet to leave", icon: CalendarDays, path: "trips" },
        { label: "Community meeting points", value: points.length, hint: `${routes.length} reusable ${routes.length === 1 ? "route" : "routes"}`, icon: MapPin, path: "points" },
      ].map(({ label, value, hint, icon: Icon, path }) => <Link key={path} href={`/admin/free-buses/${path}`} className="group relative overflow-hidden rounded-[24px] border border-line bg-surface p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-gold-500/40 hover:shadow-md motion-reduce:transform-none sm:p-6"><div className="flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-2xl border border-gold-500/15 bg-gold-500/10 text-gold-800 dark:text-gold-300"><Icon className="size-5" strokeWidth={1.7} aria-hidden /></span><ArrowUpRight className="size-4 text-ink-muted transition-colors group-hover:text-gold-700 dark:group-hover:text-gold-300" aria-hidden /></div><p className="mt-5 text-[2.75rem] leading-none font-semibold tracking-tight text-ink tabular-nums">{value}</p><h3 className="mt-2 text-sm font-medium text-ink">{label}</h3><p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">{hint}</p></Link>)}
    </div>

    <section aria-labelledby="workspace-title"><div className="mb-3 flex items-center justify-between"><h2 id="workspace-title" className="text-base font-semibold tracking-tight text-ink">Your workspace</h2><span className="text-xs text-ink-muted">A little less admin.</span></div><div className="grid gap-3 sm:grid-cols-2">
      {[
        { path: "boarding", title: "Welcome members aboard", description: "Scan a pass or open the manifest.", icon: ScanLine, label: "BOARDING" },
        { path: "ride-requests", title: "See where you’re needed", description: "Turn member requests into journeys.", icon: Route, label: "RIDE REQUESTS" },
        { path: "buses", title: "Keep the fleet ready", description: "Seats, assignments and availability.", icon: BusFront, label: "FLEET" },
        { path: "activity", title: "The story behind every change", description: "A clear record of who did what.", icon: History, label: "ACTIVITY" },
      ].map(({ path, title, description, icon: Icon, label }) => <Link key={path} href={`/admin/free-buses/${path}`} className="group flex items-start gap-4 rounded-[22px] border border-line bg-surface p-5 transition-colors hover:border-gold-500/40 hover:bg-gold-500/5 sm:p-6"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-nested text-ink-secondary transition-colors group-hover:bg-gold-500/15 group-hover:text-gold-800 dark:group-hover:text-gold-300"><Icon className="size-5" strokeWidth={1.7} aria-hidden /></span><div className="min-w-0 flex-1"><p className="text-[.6rem] font-semibold tracking-[.15em] text-gold-800 dark:text-gold-300">{label}</p><h3 className="mt-1.5 text-sm font-semibold text-ink">{title}</h3><p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{description}</p></div><ArrowUpRight className="mt-1 size-4 shrink-0 text-ink-muted" aria-hidden /></Link>)}
    </div></section>
  </div>;
}
