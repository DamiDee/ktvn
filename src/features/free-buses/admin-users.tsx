"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Users, ShieldAlert, UserX, UserCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { StatusChip } from "@/components/ui/badge";
import { RecordsTable } from "@/components/ui/records-table";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { PageLoader } from "@/components/ui/route-loader";
import { freebusRequest } from "@/services/freebus-api";
import { isOversight } from "@/lib/freebus-contract";
import type { ApiRole, ApiUser } from "@/types/freebus-api";
import { useLiveQuery } from "./live-queries";
import { useLiveUser } from "./live-shell";
import { CityPicker } from "@/components/ui/city-picker";

const ROLES: { value: ApiRole; label: string; short?: string; description: string }[] = [
  { value: "User", label: "Member", description: "Books a free seat and carries a boarding pass." },
  { value: "Driver", label: "Driver", description: "Drives a bus. Cannot reserve seats." },
  { value: "RouteCoordinator", label: "Route coordinator", short: "Coordinator", description: "Coordinates journeys on the ground." },
  { value: "Admin", label: "Admin", description: "Full oversight: fleet, journeys, points and system users." },
  { value: "Root", label: "Root", description: "Admin, plus the ability to manage other admins." },
];

const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label])) as Record<string, string>;

type Pending =
  | { kind: "role"; user: ApiUser; role: ApiRole }
  | { kind: "deactivate"; user: ApiUser }
  | { kind: "activate"; user: ApiUser }
  | { kind: "delete"; user: ApiUser };

export function AdminUsers() {
  const me = useLiveUser();
  const client = useQueryClient();
  const users = useLiveQuery<ApiUser[]>("users");
  const [create, setCreate] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = () => client.invalidateQueries({ queryKey: ["freebus-live"] });

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      setCreate(false);
      setPending(null);
      setNotice(done);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The change could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (users.error)
    return (
      <>
        <PageHeader eyebrow="Free Buses · Oversight" title="System Users" />
        <ErrorState
          title="Could not load accounts"
          description={users.error.message}
          onRetry={() => void refresh()}
        />
      </>
    );
  if (!users.data) return <PageLoader message="Loading accounts" />;

  /** Root is the only role that may hand out or withdraw oversight. */
  const canChangeOversight = me.role === "Root";
  const isSelf = (user: ApiUser) => user.id === me.id;

  const confirmation: Record<Pending["kind"], (p: Pending) => { title: string; description: string; label: string; danger: boolean }> = {
    role: (p) => ({
      title: `Change ${p.user.first_name}'s role?`,
      description:
        p.kind === "role"
          ? `${p.user.first_name} ${p.user.last_name} becomes ${ROLE_LABEL[p.role]}. ${
              isOversight(p.role)
                ? "They will be able to manage the fleet, journeys, points and other people's accounts."
                : p.role === "Driver" || p.role === "RouteCoordinator"
                  ? "They will lose the ability to book a free seat for themselves."
                  : "They will lose any oversight access they have now."
            }`
          : "",
      label: "Change role",
      danger: p.kind === "role" && (isOversight(p.role) || isOversight(p.user.role)),
    }),
    deactivate: (p) => ({
      title: `Deactivate ${p.user.first_name} ${p.user.last_name}?`,
      description:
        "They will be signed out and cannot sign in again until an admin reactivates the account. Their booking history is kept.",
      label: "Deactivate",
      danger: true,
    }),
    activate: (p) => ({
      title: `Reactivate ${p.user.first_name} ${p.user.last_name}?`,
      description: "They will be able to sign in again with their existing password.",
      label: "Reactivate",
      danger: false,
    }),
    delete: (p) => ({
      title: `Permanently delete ${p.user.first_name} ${p.user.last_name}?`,
      description: `This erases the account for good and cannot be undone. ${p.user.email} will no longer be able to sign in, and any seat they are holding is released. Deactivating instead keeps their history and is reversible.`,
      label: "Delete for good",
      danger: true,
    }),
  };

  const ask = confirmation[pending?.kind ?? "activate"];
  const view = pending ? ask(pending) : null;

  async function apply() {
    if (!pending) return;
    const { user } = pending;
    const name = `${user.first_name} ${user.last_name}`;
    if (pending.kind === "role")
      await run(
        () =>
          freebusRequest(`users/${user.id}/role`, {
            method: "PATCH",
            body: JSON.stringify({ role: pending.role }),
          }),
        `${name} is now ${ROLE_LABEL[pending.role]}.`,
      );
    else if (pending.kind === "deactivate")
      await run(
        () => freebusRequest(`users/${user.id}/deactivate`, { method: "PATCH" }),
        `${name} was deactivated and can no longer sign in.`,
      );
    else if (pending.kind === "activate")
      await run(
        () => freebusRequest(`users/${user.id}/activate`, { method: "PATCH" }),
        `${name} can sign in again.`,
      );
    else
      await run(
        () => freebusRequest(`users/${user.id}`, { method: "DELETE" }),
        `${name} was permanently deleted.`,
      );
  }

  const counts = ROLES.map((role) => ({
    ...role,
    count: users.data.filter((user) => user.role === role.value).length,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Free Buses · Oversight"
        title="System Users"
        description="Every account on the platform, and what it is allowed to do."
      />

      {notice ? (
        <p role="status" className="mb-4 rounded-xl border border-line bg-surface p-4 text-ink">
          {notice}
        </p>
      ) : null}
      {error && !create && !pending ? (
        <p role="alert" className="mb-4 text-danger-600">
          {error}
        </p>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2">
        {counts.map((role) => (
          <StatusChip key={role.value} tone={isOversight(role.value) ? "active" : "neutral"}>
            {role.count} {role.label}
            {role.count === 1 ? "" : "s"}
          </StatusChip>
        ))}
      </div>

      <RecordsTable
        caption="Platform accounts"
        rows={users.data}
        rowKey={(user) => user.id}
        searchIn={(user) =>
          `${user.first_name} ${user.last_name} ${user.email} ${user.username} ${user.phone} ${ROLE_LABEL[user.role] ?? user.role}`
        }
        searchPlaceholder="Search name, email, username or phone"
        initialSort={{ id: "name", direction: "asc" }}
        empty={
          <Card radius="xl">
            <EmptyState icon={Users} size="sm" title="No accounts yet" description="Create the first account to get started." />
          </Card>
        }
        action={<Button onClick={() => { setError(""); setCreate(true); }}>Create account</Button>}
        columns={[
          {
            id: "name",
            header: "Name",
            primary: true,
            sortBy: (user) => `${user.first_name} ${user.last_name}`,
            cell: (user) => (
              <span className="whitespace-nowrap font-medium text-ink">
                {user.first_name} {user.last_name}
                {isSelf(user) ? <span className="type-meta ml-1.5 text-ink-muted">(you)</span> : null}
              </span>
            ),
          },
          {
            id: "email",
            header: "Email",
            secondary: true,
            sortBy: (user) => user.email,
            cell: (user) => <span className="break-all text-ink-secondary">{user.email}</span>,
          },
          {
            id: "username",
            header: "Username",
            meta: true,
            hideBelow: "xl",
            sortBy: (user) => user.username,
            cell: (user) => <span className="type-numeric text-ink-secondary">{user.username}</span>,
          },
          {
            id: "phone",
            header: "Phone",
            meta: true,
            hideBelow: "xl",
            cell: (user) => <span className="type-numeric text-ink-secondary">{user.phone}</span>,
          },
          {
            id: "role",
            header: "Role",
            meta: true,
            sortBy: (user) => user.role,
            cell: (user) => (
              <StatusChip tone={isOversight(user.role) ? "active" : user.role === "User" ? "neutral" : "info"}>
                {ROLE_LABEL[user.role] ?? user.role}
              </StatusChip>
            ),
          },
          {
            id: "state",
            header: "Account",
            meta: true,
            sortBy: (user) => (user.is_active ? 0 : 1),
            cell: (user) => (
              <StatusChip tone={user.is_active ? "success" : "danger"}>
                {user.is_active ? "Active" : "Deactivated"}
              </StatusChip>
            ),
          },
          {
            id: "actions",
            header: "Actions",
            align: "end",
            actions: true,
            cell: (user) => {
              // Nobody edits their own role or account state — that is how an
              // organisation locks itself out of its own oversight.
              const locked = isSelf(user) || (isOversight(user.role) && !canChangeOversight);
              return (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <select
                    aria-label={`Role for ${user.first_name} ${user.last_name}`}
                    value={user.role}
                    disabled={locked}
                    onChange={(event) => {
                      setError("");
                      setPending({ kind: "role", user, role: event.target.value as ApiRole });
                    }}
                    className="h-8 w-[7.25rem] rounded-[var(--kx-radius-sm)] border border-line bg-surface px-1.5 text-[0.75rem] text-ink disabled:opacity-50"
                  >
                    {ROLES.map((role) => (
                      <option
                        key={role.value}
                        value={role.value}
                        disabled={isOversight(role.value) && !canChangeOversight}
                      >
                        {role.short ?? role.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={user.is_active ? UserX : UserCheck}
                    disabled={locked}
                    aria-label={`${user.is_active ? "Deactivate" : "Reactivate"} ${user.first_name} ${user.last_name}`}
                    title={user.is_active ? "Deactivate" : "Reactivate"}
                    className="!px-2"
                    onClick={() => {
                      setError("");
                      setPending({ kind: user.is_active ? "deactivate" : "activate", user });
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    className="!px-2 !text-danger-600"
                    disabled={locked}
                    aria-label={`Delete ${user.first_name} ${user.last_name}`}
                    title="Delete"
                    onClick={() => {
                      setError("");
                      setPending({ kind: "delete", user });
                    }}
                  />
                </div>
              );
            },
          },
        ]}
      />

      {!canChangeOversight ? (
        <p className="type-meta mt-4 inline-flex items-start gap-2 text-ink-muted">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Only a Root account can grant or withdraw Admin and Root access.
        </p>
      ) : null}

      <Modal
        open={create}
        onClose={() => {
          if (!busy) setCreate(false);
        }}
        title="Create an account"
        size="lg"
      >
        <CreateUserForm
          busy={busy}
          error={error}
          canChangeOversight={canChangeOversight}
          onSubmit={(payload) =>
            run(
              () => freebusRequest("users/admin", { method: "POST", body: JSON.stringify(payload) }),
              `${payload.first_name} ${payload.last_name} was created as ${ROLE_LABEL[payload.role]}.`,
            )
          }
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => {
          if (!busy) setPending(null);
        }}
        tone={view?.danger ? "danger" : "default"}
        title={view?.title ?? "Confirm change"}
        description={`${view?.description ?? ""}${error ? ` Error: ${error}` : ""}`}
        confirmLabel={view?.label ?? "Confirm"}
        loading={busy}
        onConfirm={apply}
      />
    </>
  );
}

interface CreatePayload {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  phone: string;
  address: string;
  country: string;
  city: string;
  password: string;
  role: ApiRole;
  is_active: boolean;
}

function CreateUserForm({
  busy,
  error,
  canChangeOversight,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  canChangeOversight: boolean;
  onSubmit: (payload: CreatePayload) => Promise<boolean>;
}) {
  const [role, setRole] = useState<ApiRole>("User");
  const [city, setCity] = useState("");
  const [validation, setValidation] = useState("");
  const chosen = ROLES.find((r) => r.value === role);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setValidation("");
        const data = new FormData(event.currentTarget);
        const value = (name: string) => String(data.get(name) ?? "").trim();
        if (city.trim().length < 2 || city.length > 100 || /[<>\u0000-\u001f]/.test(city)) {
          setValidation("Choose a city or area from the dropdown, or confirm an unlisted area.");
          return;
        }
        if (value("password") !== value("confirm")) {
          setValidation("The two passwords do not match.");
          return;
        }
        await onSubmit({
          first_name: value("first_name"),
          last_name: value("last_name"),
          email: value("email"),
          username: value("username"),
          phone: value("phone"),
          address: value("address"),
          country: value("country"),
          city: city.trim(),
          password: value("password"),
          role,
          is_active: true,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="First name" name="first_name" required autoComplete="off" />
        <Input label="Last name" name="last_name" required autoComplete="off" />
      </div>
      <Input label="Email" name="email" type="email" required autoComplete="off" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Username" name="username" required minLength={3} autoComplete="off" />
        <Input label="Phone" name="phone" type="tel" required autoComplete="off" />
      </div>
      <Input label="Address" name="address" required autoComplete="off" />
      <Input label="Country" name="country" required defaultValue="Nigeria" autoComplete="off" />
      <CityPicker value={city} onChange={setCity} disabled={busy} />

      <Select
        label="Role"
        value={role}
        onChange={(event) => setRole(event.target.value as ApiRole)}
        options={ROLES.filter((option) => canChangeOversight || !isOversight(option.value)).map(
          (option) => ({ value: option.value, label: option.label }),
        )}
      />
      {chosen ? <p className="type-meta -mt-2 text-ink-secondary">{chosen.description}</p> : null}
      {isOversight(role) ? (
        <p className="type-meta inline-flex items-start gap-2 rounded-xl border border-danger-600/30 bg-danger-50/60 p-3 text-danger-700 dark:bg-danger-700/10 dark:text-red-300">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          This account will be able to schedule and delete journeys, reset the fleet and manage
          other people&rsquo;s accounts.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Temporary password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        <Input label="Confirm password" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <p className="type-meta text-ink-muted">
        Share this password with them directly and ask them to change it after their first sign-in.
      </p>

      {error || validation ? (
        <p role="alert" className="text-danger-600">
          {error || validation}
        </p>
      ) : null}
      <Button block type="submit" loading={busy}>
        Create account
      </Button>
    </form>
  );
}
