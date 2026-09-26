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
import {
  DriverAccountStatus,
  DriverAvailability,
  InspectionStatus,
  MembershipStatus,
} from "@/types/enums";
import { CODE_LENGTH } from "@/features/auth/schemas";
import { LIVE_FREE_BUSES } from "@/lib/freebus-config";
import { liveAuth } from "./freebus-api";
import type { ApiUser } from "@/types/freebus-api";
import type { Driver, Notification, Passenger, User } from "@/types/models";
import { ApiError, MockDelay, request, type RequestOptions } from "./api-client";

export interface Credentials {
  identifier: string;
  password: string;
}

export interface SignUpPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  username?: string;
  address?: string;
  country?: string;
}

function appUser(user: ApiUser): User {
  return {
    id: user.id, fullName: `${user.first_name} ${user.last_name}`, email: user.email,
    phone: user.phone, joinedAt: user.created_at, ninVerified: user.is_identity_verified,
    membershipStatus: MembershipStatus.UNVERIFIED,
    role: user.role === "Admin" || user.role === "Root" || user.role === "RouteCoordinator" ? "ADMIN" : user.role === "User" ? "PASSENGER" : "DRIVER",
  };
}

function enforceInspectionPolicy(driver: Driver): Driver {
  if (driver.inspection?.status === InspectionStatus.MISSED) {
    driver.accountStatus = DriverAccountStatus.DEACTIVATED;
    driver.availability = DriverAvailability.OFFLINE;
    driver.deactivationReason =
      "Your account was deactivated because you missed the scheduled vehicle inspection.";
  }
  return driver;
}

export const userService = {
  async signIn(
    credentials: Credentials,
    options?: RequestOptions,
  ): Promise<User> {
    if (LIVE_FREE_BUSES) return appUser(await liveAuth.login(credentials.identifier, credentials.password));
    return request(
      () => {
        const identifier = credentials.identifier.trim().toLowerCase();
        const match = [...PASSENGERS, ...DRIVERS, ADMIN_USER].find(
          (user) =>
            user.email.toLowerCase() === identifier ||
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
    if (LIVE_FREE_BUSES) {
      const [first_name, ...last] = payload.fullName.trim().split(/\s+/);
      return appUser(await liveAuth.register({
        first_name, last_name: last.join(" "), email: payload.email, phone: payload.phone,
        username: payload.username ?? "", address: payload.address ?? "", country: payload.country ?? "",
        password: payload.password,
      }));
    }
    return request(
      () => ({
        ...CURRENT_PASSENGER,
        id: "usr-new",
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        ninVerified: false,
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
        if (code.replace(/\D/g, "").length < CODE_LENGTH) {
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

  /**
   * Sends the membership one-time code to an email address.
   *
   * The address is echoed back masked, so the screen can say where the code
   * went without printing the whole address on a shared phone.
   */
  async sendMembershipCode(
    email: string,
    options?: RequestOptions,
  ): Promise<{ maskedEmail: string; expiresInSeconds: number }> {
    return request(
      () => {
        const trimmed = email.trim();
        if (!trimmed.includes("@")) {
          throw new ApiError(
            "That doesn't look like an email address.",
            "INVALID_EMAIL",
            true,
          );
        }
        return {
          maskedEmail: trimmed.replace(/^(.).*(@.*)$/, "$1\u2022\u2022\u2022\u2022\u2022$2"),
          expiresInSeconds: 600,
        };
      },
      { delayMs: MockDelay.slow, ...options },
    );
  },

  /**
   * Confirms membership from the emailed code.
   *
   * The mock accepts any code of the right length, except one reserved value
   * that returns ACTION_REQUIRED so that state stays reachable in the UI.
   */
  async verifyMembershipCode(
    code: string,
    options?: RequestOptions,
  ): Promise<MembershipStatus> {
    return request(
      () => {
        const digits = code.replace(/\D/g, "");
        if (digits.length !== CODE_LENGTH) {
          throw new ApiError(
            "That code doesn't look right. Check and try again.",
            "INVALID_CODE",
            true,
          );
        }
        if (digits === "0".repeat(CODE_LENGTH)) {
          return MembershipStatus.ACTION_REQUIRED;
        }
        return MembershipStatus.VERIFIED;
      },
      { delayMs: MockDelay.normal, ...options },
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
      () =>
        enforceInspectionPolicy(
          driverId ? (findDriver(driverId) ?? CURRENT_DRIVER) : CURRENT_DRIVER,
        ),
      { delayMs: MockDelay.fast, ...options },
    );
  },

  async getAdmin(options?: RequestOptions): Promise<User> {
    return request(() => ADMIN_USER, { delayMs: MockDelay.fast, ...options });
  },

  async listDrivers(options?: RequestOptions): Promise<Driver[]> {
    return request(() => DRIVERS.map(enforceInspectionPolicy), {
      delayMs: MockDelay.normal,
      ...options,
    });
  },

  async listPassengers(options?: RequestOptions): Promise<Passenger[]> {
    return request(() => PASSENGERS, { delayMs: MockDelay.normal, ...options });
  },

  async getDriver(id: string, options?: RequestOptions): Promise<Driver | null> {
    return request(() => {
      const driver = findDriver(id);
      return driver ? enforceInspectionPolicy(driver) : null;
    }, {
      delayMs: MockDelay.fast,
      ...options,
    });
  },

  async scheduleDriverInspection(
    driverId: string,
    appointment: { scheduledAt: string; location: string; note?: string },
    options?: RequestOptions,
  ): Promise<Driver> {
    return request(() => {
      const driver = findDriver(driverId);
      if (!driver) {
        throw new ApiError("Driver not found.", "NOT_FOUND", false);
      }
      driver.inspection = {
        ...driver.inspection,
        status: InspectionStatus.SCHEDULED,
        nextDueAt: driver.inspection?.nextDueAt ?? appointment.scheduledAt,
        ...appointment,
      };
      return driver;
    }, { delayMs: MockDelay.normal, ...options });
  },

  async updateDriverAccountStatus(
    driverId: string,
    accountStatus: DriverAccountStatus,
    reason?: string,
    options?: RequestOptions,
  ): Promise<Driver> {
    return request(() => {
      const driver = findDriver(driverId);
      if (!driver) {
        throw new ApiError("Driver not found.", "NOT_FOUND", false);
      }
      driver.accountStatus = accountStatus;
      driver.flagged = accountStatus === DriverAccountStatus.FLAGGED;
      driver.deactivationReason =
        accountStatus === DriverAccountStatus.DEACTIVATED ? reason : undefined;
      if (accountStatus === DriverAccountStatus.DEACTIVATED) {
        driver.availability = DriverAvailability.OFFLINE;
      }
      return driver;
    }, { delayMs: MockDelay.normal, ...options });
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
