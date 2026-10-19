import { getSessionClient } from "@/services/session-client";
import { accountSession } from "@/lib/account-session";
import { ApiError } from "@/services/api-client";
import { PAID_RIDES_CONFIG } from "@/features/paid-rides/config";

/**
 * Transport for the Paid Rides admin API (`/api/v1/admin/*`).
 *
 * Same backend and session as Free Buses and the rest of Paid Rides: the
 * HTTP-only `access_token` cookie goes out with every request and an expired
 * token is refreshed once by the shared session client. Admin errors are
 * `{ code, message }`; they become `ApiError`s with copy safe to show.
 */

const REQUEST_TIMEOUT_MS = 15_000;

/** Plain-language copy for the codes the admin doc names, plus statuses. */
const ERROR_COPY: Record<string, string> = {
  unauthorized: "Your session has ended. Sign in again to continue.",
  forbidden: "This needs an Admin or Root account.",
  not_found: "We couldn't find that record. It may have changed.",
  conflict: "That record changed while you were working. Refresh and try again.",
  validation: "Some of those details weren't accepted. Check them and try again.",
  requests_restricted: "This member is restricted from requesting rides.",
  network: "We couldn't reach the network just now.",
  dispatch_unavailable: "Live driver locations are unavailable right now. Try again in a moment.",
  unavailable: "The service is unavailable right now. Try again in a moment.",
};

function codeForStatus(status: number): string {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  if (status >= 500) return "unavailable";
  return "unknown";
}

export class AdminApiError extends ApiError {
  readonly status: number | null;

  constructor(code: string, status: number | null, serverMessage?: string) {
    // Validation and conflict messages from the admin API explain what to fix
    // (e.g. "a reason is required"), so they are shown; others use our copy.
    const useServer = serverMessage && (code === "validation" || code === "conflict" || !ERROR_COPY[code]);
    super(useServer ? serverMessage : ERROR_COPY[code] ?? "Something went wrong. Try again.", code.toUpperCase(), status === null || status >= 500);
    this.name = "AdminApiError";
    this.status = status;
  }
}

function base(): string {
  return PAID_RIDES_CONFIG.apiBaseUrl.replace(/\/+$/, "");
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function withQuery(path: string, query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

interface AdminRequest {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

async function send(path: string, options: AdminRequest): Promise<Response> {
  if (!PAID_RIDES_CONFIG.apiBaseUrl) throw new AdminApiError("unavailable", null);
  const scope = accountSession.capture();
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = !options.signal ? timeout : typeof AbortSignal.any === "function" ? AbortSignal.any([options.signal, timeout]) : options.signal;
  const method = options.method ?? "GET";
  const body = options.body !== undefined ? JSON.stringify(options.body) : method === "POST" ? "{}" : undefined;
  let response: Response;
  try {
    response = await getSessionClient(base()).request(path.replace(/^\//, ""), { method, body, signal });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) throw new AdminApiError("network", null);
    throw new AdminApiError("network", null);
  }
  scope.assertCurrent();
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { code?: unknown; message?: unknown } | null;
    const code = typeof data?.code === "string" ? data.code.toLowerCase() : codeForStatus(response.status);
    throw new AdminApiError(code, response.status, typeof data?.message === "string" ? data.message : undefined);
  }
  return response;
}

export async function adminRequest<T = unknown>(path: string, options: AdminRequest = {}): Promise<T> {
  const response = await send(path, options);
  if (response.status === 204) return undefined as T;
  return (await response.json().catch(() => null)) as T;
}

/** Downloads a file response (the CSV export) through the authenticated session. */
export async function adminDownload(path: string, fallbackName: string): Promise<void> {
  const response = await send(path, {});
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const name = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
