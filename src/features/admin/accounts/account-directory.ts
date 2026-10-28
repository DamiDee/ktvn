import type { ApiUser } from "../../../types/freebus-api.ts";
import { displayName, displayPhone } from "../../../lib/account-display.ts";

export const ACCOUNT_ROLES = ["User", "Driver", "RouteCoordinator", "Admin", "Root"] as const;
export function accountRoleLabel(role: string, paid = false): string {
  return role === "User" ? paid ? "Passenger" : "Member" : role === "RouteCoordinator" ? "Route coordinator" : role;
}
export function accountName(user: ApiUser): string { return displayName(`${user.first_name ?? ""} ${user.last_name ?? ""}`) || "Unnamed account"; }
export function accountSearchText(user: ApiUser): string {
  const profile = user.driver_profile;
  return [user.id, accountName(user), user.email, user.username, user.phone, displayPhone(user.phone), user.phone?.replace(/\D/g, ""), user.address, user.city, user.country, user.role, accountRoleLabel(user.role, true), accountRoleLabel(user.role, false), profile?.licence_number, profile?.guarantor_name, profile?.guarantor_phone, profile?.koinonia_department].filter(Boolean).join(" ");
}
export interface AccountFilters { role: string; active: string; identity: string; city: string; track: string; since: string; until: string }
export const EMPTY_ACCOUNT_FILTERS: AccountFilters = { role: "all", active: "all", identity: "all", city: "all", track: "all", since: "", until: "" };
export function filterAccounts(users: ApiUser[], filters: AccountFilters): ApiUser[] {
  return users.filter((user) => {
    if (filters.role !== "all" && user.role !== filters.role) return false;
    if (filters.active !== "all" && user.is_active !== (filters.active === "active")) return false;
    if (filters.identity !== "all" && user.is_identity_verified !== (filters.identity === "verified")) return false;
    if (filters.city !== "all" && (user.city?.trim() || "") !== filters.city) return false;
    if (filters.track !== "all") {
      const track = user.driver_profile?.track?.toLowerCase();
      if (user.role !== "Driver" || (track !== filters.track && track !== "both")) return false;
    }
    const joined = accountDay(user.created_at);
    if (filters.since && (!joined || joined < filters.since)) return false;
    if (filters.until && (!joined || joined > filters.until)) return false;
    return true;
  });
}
const readableDate = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", year: "numeric", month: "short", day: "numeric" });
const filterDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });
export function accountDay(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const parts = filterDate.formatToParts(new Date(value));
  return ["year", "month", "day"].map((name) => parts.find((part) => part.type === name)?.value).join("-");
}
export function accountDate(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not available";
  return readableDate.format(new Date(value));
}
export function contactPhoneHref(value?: string | null): string | undefined {
  const phone = value?.replace(/[\s().-]/g, "");
  return phone && /^\+?\d{7,15}$/.test(phone) ? `tel:${phone}` : undefined;
}
