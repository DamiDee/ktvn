"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";
import { useLiveQuery } from "./live-queries";
import { queryString } from "@/lib/freebus-contract";
import type { ApiUser } from "@/types/freebus-api";

interface ActivityLog { id: string; user_id: string; activity_type: string; details: Record<string, unknown>; target_id?: string | null; target_type?: string | null; created_at: string }
const activities = ["PointCreated", "PointUpdated", "PointDeleted", "BusCreated", "BusUpdated", "BusDeleted", "BusRoutesReset", "BusReset", "BusStateChanged", "BusRouteChanged", "BusStatusChanged", "BusAllocationChanged", "BusCapacityChanged", "RouteCreated", "RouteUpdated", "RouteDeleted", "RouteCompleted", "BookingCreated", "BookingCancelled", "BookingBoarded", "BookingPaymentUpdated", "UserLogin", "UserLogout", "UserCreated", "UserUpdated", "UserActivation", "UserDeactivation", "UserDeleted", "AccountCreated"];
function readable(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2"); }
function safeDetails(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeDetails);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /token|password|secret|identity_number|qr|signature/i.test(key) ? "[redacted]" : safeDetails(item)]));
  return value;
}
export function ActivityLogs() {
  const [filters, setFilters] = useState({ activity_type: "", user_id: "", target_type: "", target_id: "" });
  const [page, setPage] = useState(1);
  const logs = useLiveQuery<ActivityLog[]>(`logs${queryString({ ...filters, page, size: 25 })}`);
  const users = useLiveQuery<ApiUser[]>("users");
  return <>
    <PageHeader eyebrow="Free Buses · Oversight" title="Activity" description="The server's audit trail: who changed what and when." />
    <Card className="mb-5"><form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); setPage(1); setFilters({ activity_type: String(data.get("activity") ?? ""), user_id: String(data.get("user") ?? ""), target_type: String(data.get("target") ?? ""), target_id: String(data.get("id") ?? "").trim() }); }}>
      <Select label="Activity type" name="activity" options={[{ value: "", label: "All activity" }, ...activities.map((value) => ({ value, label: readable(value) }))]} />
      <Select label="Performed by" name="user" options={[{ value: "", label: "Everyone" }, ...(users.data ?? []).map((u) => ({ value: u.id, label: `${u.first_name} ${u.last_name} · ${u.role}` }))]} />
      <Input label="Target type" name="target" placeholder="e.g. Bus" /><Input label="Target ID" name="id" placeholder="Optional UUID" pattern="[0-9a-fA-F-]{36}" />
      <Button type="submit">Apply filters</Button>
    </form></Card>
    {users.error ? <p className="mb-3 text-sm text-ink-muted">Names are unavailable. Actor IDs are shown instead.</p> : null}
    {logs.error ? <ErrorState title="Could not load activity" description={logs.error.message} onRetry={() => void logs.refetch()} /> : logs.isPending ? <p role="status">Loading activity…</p> : <div className="space-y-3">{logs.data.map((log) => <LogRow key={log.id} log={log} user={users.data?.find((u) => u.id === log.user_id)} />)}{!logs.data.length ? <Card>No activity matches these filters.</Card> : null}</div>}
    <div className="mt-5 flex items-center gap-3"><Button variant="secondary" disabled={page === 1 || logs.isFetching} onClick={() => setPage((p) => p - 1)}>Previous</Button><span className="text-sm text-ink-secondary">Page {page}</span><Button variant="secondary" disabled={logs.isFetching || !logs.data || logs.data.length < 25} onClick={() => setPage((p) => p + 1)}>Next</Button><Button variant="ghost" onClick={() => void logs.refetch()}>Refresh</Button></div>
  </>;
}
function LogRow({ log, user }: { log: ActivityLog; user?: ApiUser }) {
  const [expanded, setExpanded] = useState(false);
  const detail = useLiveQuery<ActivityLog>(`logs/${log.id}`, expanded);
  return <Card><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold text-ink">{readable(log.activity_type)}</h2><p className="mt-1 break-all text-sm text-ink-secondary">{user ? `${user.first_name} ${user.last_name}` : log.user_id}</p></div><time className="text-sm text-ink-muted">{log.created_at.replace("T", " ")}</time></div><p className="mt-2 break-all text-sm text-ink-secondary">{log.target_type ?? "Account"}{log.target_id ? ` · ${log.target_id}` : ""}</p><Button variant="ghost" size="sm" className="mt-2" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>{expanded ? "Hide details" : "View details"}</Button>{expanded ? detail.error ? <p role="alert">{detail.error.message}</p> : <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-surface-nested p-3 text-xs text-ink">{detail.data ? JSON.stringify(safeDetails(detail.data.details), null, 2) : "Loading details…"}</pre> : null}</Card>;
}
