import {
  ADMIN_USER,
  CURRENT_DRIVER,
  CURRENT_PASSENGER,
  DRIVERS,
  PASSENGERS,
  findDriver,
  findPassenger,
} from "@/mocks/people";
import { NOTIFICATIONS } from "@/mocks/notifications";
import { MembershipStatus } from "@/types/enums";
import type { Driver, Notification, Passenger, User } from "@/types/models";
import { ApiError, MockDelay, request, type RequestOptions } from "./api-client";

export interface Credentials {
  identifier: string;
  password: string;
}

export interface SignUpPayload {
  fullName: string;
  memberId: string;
  email: string;
  phone: string;
  password: string;
}

export const userService = {
  async signIn(
    credentials: Credentials,
    options?: RequestOptions,
  ): Promise<User> {
    return request(
      () => {
        const identifier = credentials.identifier.trim().toLowerCase();
        const match = [...PASSENGERS, ...DRIVERS, ADMIN_USER].find(
          (user) =>
            user.email.toLowerCase() === identifier ||
            user.memberId.toLowerCase() === identifier ||
            user.phone.replace(/\s/g, "") === identifier.replace(/\s/g, ""),
        );

        // Any password is accepted while the backend is mocked; an unknown
        // identifier still fails so the error state is reachable.
        if (!match) {
          throw new ApiError(
            "We couldn't find an account with those details.",
            "NOT_FOUND",
            false,
          );
        }

        return match;
      },
      { delayMs: MockDelay.normal, ...options },
    );
  },

  async signUp(payload: SignUpPayload, options?: RequestOptions): Promise<User> {
    return request(
      () => ({
        ...CURRENT_PASSENGER,
        id: "usr-new",
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        memberId: payload.memberId,
        membershipStatus: MembershipStatus.CHECKING,
        joinedAt: new Date().toISOString(),
      }),
      { delayMs: MockDelay.slow, ...options },
    );
  },

  async requestPasswordReset(
    identifier: string,
    options?: RequestOptions,
  ): Promise<{ maskedDestination: string }> {
    return request(
      () => {
        const isEmail = identifier.includes("@");
        const masked = isEmail
          ? identifier.replace(/^(.).*(@.*)$/, "$1•••••$2")
          : identifier.replace(/\d(?=\d{3})/g, "•");
        return { maskedDestination: masked };
      },
      { delayMs: MockDelay.normal, ...options },
    );
  },

  async verifyResetCode(
    code: string,
    options?: RequestOptions,
  ): Promise<{ token: string }> {
    return request(
      () => {
        if (code.replace(/\D/g, "").length < 6) {
          throw new ApiError(
            "That code doesn't look right. Check and try again.",
            "INVALID_CODE",
            true,
          );
        }
        return { token: "reset-token" };
      },
      { delayMs: MockDelay.fast, ...options },
    );
  },

  async completePasswordReset(options?: RequestOptions): Promise<void> {
    return request(() => undefined, { delayMs: MockDelay.normal, ...options });
  },

  /** Membership check — drives the verify-member screen's state machine. */
  async verifyMembership(
    memberId: string,
    options?: RequestOptions,
  ): Promise<MembershipStatus> {
    return request(
      () => {
        const trimmed = memberId.trim().toUpperCase();
        if (!trimmed) return MembershipStatus.UNVERIFIED;
        const known = PASSENGERS.some(
          (passenger) => passenger.memberId.toUpperCase() === trimmed,
        );
        if (known) return MembershipStatus.VERIFIED;
        if (/^KOI-\d{4}-\d{6}$/.test(trimmed)) {
          return MembershipStatus.ACTION_REQUIRED;
        }
        return MembershipStatus.REJECTED;
      },
      { delayMs: MockDelay.slow, ...options },
    );
  },

  async getCurrentPassenger(options?: RequestOptions): Promise<Passenger> {
    return request(() => CURRENT_PASSENGER, {
      delayMs: MockDelay.fast,
      ...options,
    });
  },

  /**
   * The signed-in driver. `driverId` exists so the demo can show both the
   * volunteer and professional experiences; with a real backend the session
   * decides and the argument goes away.
   */
  async getCurrentDriver(
    driverId?: string,
    options?: RequestOptions,
  ): Promise<Driver> {
    return request(
      () => (driverId ? (findDriver(driverId) ?? CURRENT_DRIVER) : CURRENT_DRIVER),
      { delayMs: MockDelay.fast, ...options },
    );
  },

  async getAdmin(options?: RequestOptions): Promise<User> {
    return request(() => ADMIN_USER, { delayMs: MockDelay.fast, ...options });
  },

  async listDrivers(options?: RequestOptions): Promise<Driver[]> {
    return request(() => DRIVERS, { delayMs: MockDelay.normal, ...options });
  },

  async listPassengers(options?: RequestOptions): Promise<Passenger[]> {
    return request(() => PASSENGERS, { delayMs: MockDelay.normal, ...options });
  },

  async getDriver(id: string, options?: RequestOptions): Promise<Driver | null> {
    return request(() => findDriver(id) ?? null, {
      delayMs: MockDelay.fast,
      ...options,
    });
  },

  async getPassenger(
    id: string,
    options?: RequestOptions,
  ): Promise<Passenger | null> {
    return request(() => findPassenger(id) ?? null, {
      delayMs: MockDelay.fast,
      ...options,
    });
  },

  async listNotifications(options?: RequestOptions): Promise<Notification[]> {
    return request(() => NOTIFICATIONS, { delayMs: MockDelay.fast, ...options });
  },
};
