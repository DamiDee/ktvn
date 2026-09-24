import type { ApiUser, ApiRegistration } from "@/types/freebus-api";

/**
 * Direct browser access to the Free Buses API.
 *
 * The API owns the session: `POST /auth/login` sets HTTP-only `access_token` and
 * `refresh_token` cookies, and `credentials: "include"` returns them on every later
 * request. No token is ever read, stored or sent by this code — the browser holds the
 * cookies and cannot see inside them, and the API decides what each caller may do.
 *
 * This requires the API to allow this exact origin with
 * `Access-Control-Allow-Credentials: true` and to set its cookies `SameSite=None; Secure`.
 */
const BASE = (
  process.env.NEXT_PUBLIC_FREEBUS_API_BASE_URL ?? "https://api.freebus.cloud/api/v1"
).replace(/\/$/, "");

/**
 * The signed-in user's id, so the app can ask the API who it is talking to on a reload.
 * It is not a credential and grants nothing: `GET /users/{id}` still requires the cookie,
 * and the API refuses any id but the caller's own unless they are Admin or Root.
 */
const IDENTITY_KEY = "kr-freebus-user";

function rememberIdentity(id: string | null) {
  try {
    if (id) window.localStorage.setItem(IDENTITY_KEY, id);
    else window.localStorage.removeItem(IDENTITY_KEY);
  } catch {
    // Private browsing or blocked storage: the session still works until the tab closes.
  }
}

function recallIdentity(): string | null {
  try {
    return window.localStorage.getItem(IDENTITY_KEY);
  } catch {
    return null;
  }
}

export class FreebusError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "FreebusError";
  }
}

export async function freebusRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}/${path}`, {
      ...options,
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...options.headers },
    });
  } catch {
    // A blocked cross-site cookie or a CORS refusal also lands here, with no status.
    throw new FreebusError(
      "We couldn't reach the Free Buses service. Check your connection and try again.",
      0,
    );
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) rememberIdentity(null);
    throw new FreebusError(
      body?.message ??
        (response.status === 401
          ? "Please sign in again to continue."
          : "The request could not be completed."),
      response.status,
    );
  }
  // Most operations answer with a Message_* envelope; registration answers with a bare DTO.
  return body && Object.hasOwn(body, "data") ? body.data : body;
}

export const liveAuth = {
  async login(user: string, password: string) {
    const result = await freebusRequest<{ user: ApiUser; token_type: string }>("auth/login", {
      method: "POST",
      body: JSON.stringify({ user, password }),
    });
    if (!result?.user?.id) throw new FreebusError("Login did not return an account.", 502);
    if (!result.user.is_active)
      throw new FreebusError("This account is deactivated. Contact the oversight team.", 403);
    rememberIdentity(result.user.id);
    return result.user;
  },

  register: (payload: ApiRegistration) =>
    freebusRequest<ApiUser>("users", { method: "POST", body: JSON.stringify(payload) }),

  /**
   * Who the API says we are. The cookie is the credential; the stored id only says which
   * record to ask for, and the role on the returned profile is the one the app obeys.
   */
  async session() {
    const id = recallIdentity();
    if (!id) throw new FreebusError("Please sign in to use Free Buses.", 401);
    return freebusRequest<ApiUser>(`users/${id}`);
  },

  async logout() {
    try {
      await freebusRequest<unknown>("auth/logout", { method: "POST" });
    } finally {
      // Signing out locally must succeed even when the API cannot be reached.
      rememberIdentity(null);
    }
  },
};
