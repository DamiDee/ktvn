import type { ApiUser } from "../types/freebus-api";

export function memberProfileDetails(user: ApiUser) {
  const display = (value: string | undefined | null) => value?.trim() || "Not provided";
  return [
    { label: "First name", value: display(user.first_name) },
    { label: "Last name", value: display(user.last_name) },
    { label: "Email", value: display(user.email) },
    { label: "Username", value: display(user.username) },
    { label: "Phone", value: display(user.phone) },
    { label: "Address", value: display(user.address) },
    { label: "Country", value: display(user.country) },
  ];
}

/** Account timestamps may have no timezone. Display their calendar date without shifting it. */
export function memberSince(value: string) {
  const day = value?.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "Not available";
  const date = new Date(`${day}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) return "Not available";
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(date);
}
