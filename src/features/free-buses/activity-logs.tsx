"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { RecordsTable } from "@/components/ui/records-table";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { History } from "lucide-react";
import { useLiveQuery } from "./live-queries";
import { queryString } from "@/lib/freebus-contract";
import type { ApiUser } from "@/types/freebus-api";

interface ActivityLog { id: string; user_id: string; activity_type: string; details: Record<string, unknown>; target_id?: string | null; target_type?: string | null; created_at: string }
const activities = ["PointCreated", "PointUpdated", "PointDeleted", "BusCreated", "BusUpdated", "BusDeleted", "BusRoutesReset", "BusReset", "BusStateChanged", "BusRouteChanged", "BusStatusChanged", "BusAllocationChanged", "BusCapacityChanged", "RouteCreated", "RouteUpdated", "RouteDeleted", "RouteCompleted", "TripCreated", "TripUpdated", "TripDeleted", "TripStarted", "TripCompleted", "TripCancelled", "BookingCreated", "BookingCancelled", "BookingBoarded", "BookingPaymentUpdated", "UserLogin", "UserLogout", "UserCreated", "UserUpdated", "UserActivation", "UserDeactivation", "UserDeleted", "AccountCreated"];
function readable(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2"); }
function safeDetails(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeDetails);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /token|password|secret|identity_number|qr|signature/i.test(key) ? "[redacted]" : safeDetails(item)]));
  return value;
}
export function ActivityLogs() {
  const [filters, setFilters] = useState({ activity_type: "", user_id: "", target_type: "", target_id: "" });
  const [page, setPage] = useState(1);
  const [openLog, setOpenLog] = useState<ActivityLog | null>(null);
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
    {logs.error ? <ErrorState title="Could not load activity" description={logs.error.message} onRetry={() => void logs.refetch()} /> : logs.isPending ? <p role="status">Loading activity…</p> : <RecordsTable
      caption="Audit trail"
      rows={logs.data}
      rowKey={(log) => log.id}
      searchIn={(log) => { const actor = users.data?.find((u) => u.id === log.user_id); return `${readable(log.activity_type)} ${actor ? `${actor.first_name} ${actor.last_name}` : log.user_id} ${log.target_type ?? ""} ${log.target_id ?? ""} ${log.created_at}`; }}
      searchPlaceholder="Search this page of activity"
      initialSort={{ id: "when", direction: "desc" }}
      showCount={false}
      paginate={false}
      empty={<Card radius="xl"><EmptyState icon={History} size="sm" title="No activity matches these filters" description="Widen the filters above, or move to another page." /></Card>}
      action={<Button variant="secondary" onClick={() => void logs.refetch()} loading={logs.isFetching}>Refresh</Button>}
      columns={[
        { id: "activity", header: "Activity", primary: true, sortBy: (log) => log.activity_type, cell: (log) => <span className="font-medium text-ink">{readable(log.activity_type)}</span> },
        { id: "actor", header: "Performed by", secondary: true, sortBy: (log) => { const actor = users.data?.find((u) => u.id === log.user_id); return actor ? `${actor.first_name} ${actor.last_name}` : log.user_id; }, cell: (log) => { const actor = users.data?.find((u) => u.id === log.user_id); return <span className="break-all text-ink-secondary">{actor ? `${actor.first_name} ${actor.last_name}` : log.user_id}</span>; } },
        { id: "target", header: "Target", meta: true, sortBy: (log) => log.target_type ?? "", cell: (log) => <span className="text-ink-secondary">{log.target_type ?? "Account"}</span> },
        { id: "targetId", header: "Target ID", meta: true, hideBelow: "xl", cell: (log) => <span className="type-numeric break-all text-ink-muted">{log.target_id ?? "—"}</span> },
        { id: "when", header: "When", meta: true, sortBy: (log) => log.created_at, cell: (log) => <time className="type-numeric text-ink-secondary" dateTime={log.created_at}>{log.created_at.replace("T", " ").slice(0, 19)}</time> },
        { id: "actions", header: "Details", align: "end", actions: true, cell: (log) => <Button size="sm" variant="ghost" onClick={() => setOpenLog(log)}>View</Button> },
      ]}
    />}
    <div className="mt-5 flex items-center gap-3"><Button variant="secondary" disabled={page === 1 || logs.isFetching} onClick={() => setPage((p) => p - 1)}>Previous</Button><span className="text-sm text-ink-secondary">Page {page}</span><Button variant="secondary" disabled={logs.isFetching || !logs.data || logs.data.length < 25} onClick={() => setPage((p) => p + 1)}>Next</Button></div>
    <Modal open={Boolean(openLog)} onClose={() => setOpenLog(null)} title={openLog ? readable(openLog.activity_type) : "Activity"} size="lg">
      {openLog ? <LogDetail log={openLog} user={users.data?.find((u) => u.id === openLog.user_id)} /> : null}
    </Modal>
  </>;
}

function LogDetail({ log, user }: { log: ActivityLog; user?: ApiUser }) {
  const detail = useLiveQuery<ActivityLog>(`logs/${log.id}`);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <StatusChip tone="neutral">{log.target_type ?? "Account"}</StatusChip>
      <time className="type-meta text-ink-muted" dateTime={log.created_at}>{log.created_at.replace("T", " ").slice(0, 19)}</time>
    </div>
    <div><p className="type-micro text-ink-muted">Performed by</p><p className="mt-1 break-all text-ink">{user ? `${user.first_name} ${user.last_name} · ${user.role}` : log.user_id}</p></div>
    {log.target_id ? <div><p className="type-micro text-ink-muted">Target ID</p><p className="type-numeric mt-1 break-all text-ink">{log.target_id}</p></div> : null}
    <div><p className="type-micro text-ink-muted">Recorded details</p>
      {detail.error ? <p role="alert" className="mt-1 text-danger-600">{detail.error.message}</p>
        : <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-surface-nested p-3 text-xs text-ink">{detail.data ? JSON.stringify(safeDetails(detail.data.details), null, 2) : "Loading details…"}</pre>}
    </div>
  </div>;
}
