"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { RecordsTable } from "@/components/ui/records-table";
import type { DataColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import type { ApiUser } from "@/types/freebus-api";
import { displayPhone } from "@/lib/account-display";
import { ACCOUNT_ROLES, EMPTY_ACCOUNT_FILTERS, accountDate, accountName, accountRoleLabel, accountSearchText, contactPhoneHref, filterAccounts, type AccountFilters } from "./account-directory";

export function AccountsTable({ users, paid, currentUserId, onCreate, onManage }: { users: ApiUser[]; paid: boolean; currentUserId: string; onCreate: () => void; onManage: (user: ApiUser) => void }) {
  const [filters, setFilters] = useState<AccountFilters>(EMPTY_ACCOUNT_FILTERS);
  const update = (name: keyof AccountFilters, value: string) => setFilters((current) => ({ ...current, [name]: value }));
  const rows = filterAccounts(users, filters);
  const cities = [...new Set(users.map((user) => user.city?.trim()).filter((city): city is string => Boolean(city)))].sort();
  const filtered = Object.entries(filters).some(([key, value]) => value !== EMPTY_ACCOUNT_FILTERS[key as keyof AccountFilters]);
  const textColumn = (id: string, header: string, read: (user: ApiUser) => string | null | undefined): DataColumn<ApiUser> => ({ id, header, meta: true, sortBy: (user) => read(user) ?? "", cell: (user) => <span className="block max-w-64 break-words text-ink-secondary">{read(user)?.trim() || "Not provided"}</span> });
  const dateColumn = (id: string, header: string, read: (user: ApiUser) => string | null | undefined): DataColumn<ApiUser> => ({ id, header, meta: true, sortBy: (user) => Date.parse(read(user) ?? "") || 0, cell: (user) => accountDate(read(user)) });
  const columns: DataColumn<ApiUser>[] = [
    { id: "name", header: "Name", primary: true, sortBy: accountName, cell: (user) => <span className="whitespace-nowrap font-medium text-ink">{accountName(user)}{user.id === currentUserId ? <span className="ml-1 text-xs text-ink-muted">(you)</span> : null}</span> },
    { id: "email", header: "Email", secondary: true, sortBy: (user) => user.email, cell: (user) => <a className="text-ink-secondary underline underline-offset-4" href={`mailto:${user.email}`}>{user.email || "Not provided"}</a> },
    textColumn("username", "Username", (user) => user.username),
    { id: "phone", header: "Phone", meta: true, sortBy: (user) => user.phone, cell: (user) => contactPhoneHref(user.phone) ? <a className="whitespace-nowrap underline underline-offset-4" href={contactPhoneHref(user.phone)}>{displayPhone(user.phone)}</a> : displayPhone(user.phone) },
    { id: "role", header: "Role", meta: true, sortBy: (user) => user.role, cell: (user) => <StatusChip tone={user.role === "Admin" || user.role === "Root" ? "active" : "neutral"}>{accountRoleLabel(user.role, paid)}</StatusChip> },
    { id: "state", header: "Account", meta: true, sortBy: (user) => user.is_active ? 0 : 1, cell: (user) => <StatusChip tone={user.is_active ? "success" : "danger"}>{user.is_active ? "Active" : "Deactivated"}</StatusChip> },
    textColumn("address", "Address", (user) => user.address), textColumn("city", "City / area", (user) => user.city), textColumn("country", "Country", (user) => user.country),
    { id: "identity", header: "Identity", meta: true, sortBy: (user) => user.is_identity_verified ? 0 : 1, cell: (user) => <StatusChip tone={user.is_identity_verified ? "success" : "pending"}>{user.is_identity_verified ? "Verified" : "Not verified"}</StatusChip> },
  ];
  if (paid) columns.push(
    textColumn("identity-type", "Identity type", (user) => user.identity_type), textColumn("identity-number", "Identity number", (user) => user.identity_number),
    textColumn("track", "Driver track", (user) => user.driver_profile?.track), textColumn("driver-status", "Driver approval", (user) => user.driver_profile?.status),
    textColumn("licence", "Licence number", (user) => user.driver_profile?.licence_number), textColumn("licence-class", "Licence class", (user) => user.driver_profile?.licence_class),
    dateColumn("licence-expiry", "Licence expiry", (user) => user.driver_profile?.licence_expiry_date),
    textColumn("worker", "Koinonia worker", (user) => user.driver_profile ? user.driver_profile.is_koinonia_worker ? "Yes" : "No" : undefined),
    textColumn("department", "Department", (user) => user.driver_profile?.koinonia_department), textColumn("guarantor", "Guarantor", (user) => user.driver_profile?.guarantor_name),
    textColumn("guarantor-phone", "Guarantor phone", (user) => user.driver_profile?.guarantor_phone ? displayPhone(user.driver_profile.guarantor_phone) : undefined), textColumn("relationship", "Guarantor relationship", (user) => user.driver_profile?.guarantor_relationship),
    textColumn("vehicle", "Vehicle ID", (user) => user.driver_profile?.car_id ?? user.car),
  );
  columns.push(
    dateColumn("joined", "Registered", (user) => user.created_at),
    ...(paid ? [dateColumn("updated", "Last updated", (user) => user.updated_at), dateColumn("last-seen", "Last seen", (user) => user.last_seen), textColumn("id", "Account ID", (user) => user.id)] : []),
    { id: "actions", header: "Details & actions", actions: true, align: "end", cell: (user) => <Button size="sm" variant="secondary" onClick={() => onManage(user)}>Manage</Button> },
  );
  // Keep account actions within reach before the wider information columns.
  if (paid) columns.splice(1, 0, columns.pop()!);
  return <div className="min-w-0 space-y-4">
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-ink">Filter accounts</h2><Button size="sm" variant="ghost" disabled={!filtered} onClick={() => setFilters(EMPTY_ACCOUNT_FILTERS)}>Clear filters</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Select label="Role" value={filters.role} onChange={(event) => update("role", event.target.value)} options={[{ value: "all", label: "All roles" }, ...ACCOUNT_ROLES.map((role) => ({ value: role, label: accountRoleLabel(role, paid) }))]} />
        <Select label="Account status" value={filters.active} onChange={(event) => update("active", event.target.value)} options={[{ value: "all", label: "All accounts" }, { value: "active", label: "Active" }, { value: "inactive", label: "Deactivated" }]} />
        <Select label="Identity verification" value={filters.identity} onChange={(event) => update("identity", event.target.value)} options={[{ value: "all", label: "All verification states" }, { value: "verified", label: "Verified" }, { value: "unverified", label: "Not verified" }]} />
        <Select label="City / area" value={filters.city} onChange={(event) => update("city", event.target.value)} options={[{ value: "all", label: "All areas" }, ...cities.map((city) => ({ value: city, label: city }))]} />
        {paid ? <Select label="Driver track" value={filters.track} onChange={(event) => update("track", event.target.value)} options={[{ value: "all", label: "All tracks" }, { value: "professional", label: "Professional (includes Both)" }, { value: "volunteer", label: "Volunteer (includes Both)" }]} /> : null}
        <Input label="Registered from" type="date" value={filters.since} max={filters.until || undefined} onChange={(event) => update("since", event.target.value)} />
        <Input label="Registered until" type="date" value={filters.until} min={filters.since || undefined} onChange={(event) => update("until", event.target.value)} />
      </div>
    </div>
    {paid ? <p className="text-xs text-ink-secondary">Shared platform accounts · Scroll across the table to see all account and driver information. Open Manage for the full profile and account actions.</p> : null}
    <RecordsTable caption="Platform accounts" rows={rows} columns={columns} rowKey={(user) => user.id} searchIn={accountSearchText} searchPlaceholder="Search name, email, phone, username or area" initialSort={{ id: "name", direction: "asc" }} action={<Button onClick={onCreate}>Create account</Button>}
      empty={<EmptyState icon={Users} title={filtered ? "No accounts match these filters" : "No accounts yet"} description={filtered ? "Clear a filter to see more accounts." : "Create an account to get started."} />} />
  </div>;
}
