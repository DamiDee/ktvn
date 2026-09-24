"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Car,
  ChevronRight,
  HandHeart,
  Mail,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, PasswordInput } from "@/components/ui/input";
import { userService, ApiError } from "@/services";
import { UserRole } from "@/types/enums";
import { useSessionStore } from "@/stores/session-store";
import { loginSchema, liveLoginSchema, type LoginValues } from "./schemas";
import { LIVE_FREE_BUSES } from "@/lib/freebus-config";
import { FreebusError } from "@/services/freebus-api";
import { useQueryClient } from "@tanstack/react-query";

const ROLE_HOME: Record<string, string> = {
  [UserRole.PASSENGER]: "/passenger/rides",
  [UserRole.DRIVER]: "/driver",
  [UserRole.ADMIN]: "/admin",
};

interface DemoAccount {
  id: string;
  label: string;
  detail: string;
  email: string;
  icon: LucideIcon;
}

/**
 * One tap into each side of the product.
 *
 * The two driver accounts are deliberately separate: the tracks look and
 * behave differently, and the quickest way to see that is to sign in as each.
 */
const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "passenger",
    label: "Member",
    detail: "Request a ride, follow a journey",
    email: "grace.adeyemi@example.com",
    icon: UserRound,
  },
  {
    id: "volunteer",
    label: "Volunteer driver",
    detail: "Serving — never a fare in sight",
    email: "emeka.nwosu@example.com",
    icon: HandHeart,
  },
  {
    id: "professional",
    label: "Professional driver",
    detail: "Requests, trips and earnings",
    email: "chinedu.okafor@example.com",
    icon: Car,
  },
  {
    id: "admin",
    label: "Oversight",
    detail: "Live rides, verification, incidents",
    email: "deborah.ajayi@koinonia.example",
    icon: BadgeCheck,
  },
];

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setActiveDriverId = useSessionStore((state) => state.setActiveDriverId);
  const setActiveMemberId = useSessionStore((state) => state.setActiveMemberId);
  const setRole = useSessionStore((state) => state.setRole);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(LIVE_FREE_BUSES ? liveLoginSchema : loginSchema),
    defaultValues: { identifier: "", password: "", remember: true },
  });

  async function signIn(identifier: string, password: string) {
    const user = await userService.signIn({ identifier, password });

    // Remember which driver signed in, so the driver screens show that
    // person's track rather than a fixed demo account.
    setActiveDriverId(user.role === UserRole.DRIVER ? user.id : null);
    setActiveMemberId(user.role === UserRole.PASSENGER ? user.id : null);
    setRole(user.role);

    queryClient.clear();
    router.push(LIVE_FREE_BUSES ? (user.role === UserRole.ADMIN ? "/admin/free-buses" : "/passenger/free-buses") : ROLE_HOME[user.role] ?? "/passenger/rides");
  }

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      await signIn(values.identifier, values.password);
    } catch (error) {
      setFormError(
        error instanceof ApiError || error instanceof FreebusError
          ? error.message
          : "We couldn't sign you in just now. Try again in a moment.",
      );
    }
  }

  async function enterPreview(account: DemoAccount) {
    setFormError(null);
    setPreviewing(account.id);
    try {
      await signIn(account.email, "preview");
    } catch (error) {
      setPreviewing(null);
      setFormError(
        error instanceof ApiError
          ? error.message
          : "We couldn't open that preview. Try again in a moment.",
      );
    }
  }

  const busy = isSubmitting || previewing !== null;

  return (
    <div>
      <h1 className="type-page-title text-ink">Welcome back.</h1>
      <p className="type-body mt-2.5 text-ink-secondary">
        {LIVE_FREE_BUSES ? "Sign in with your email or username to use Free Buses." : "Sign in with the email or phone number on your membership record."}
      </p>

      {/* Demo accounts — one click into any side of the product */}
      {!LIVE_FREE_BUSES ? <><div className="mt-7 rounded-[var(--kx-radius-xl)] border border-line bg-surface-nested p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="type-card-title text-ink">Preview the product</p>
          <span className="type-micro text-ink-muted">Demo build</span>
        </div>
        <p className="type-meta mt-1 text-ink-secondary">
          Sign in as one of these in a single click. No password needed.
        </p>

        <ul className="mt-4 space-y-2">
          {DEMO_ACCOUNTS.map((account) => {
            const Icon = account.icon;
            const loading = previewing === account.id;

            return (
              <li key={account.id}>
                <button
                  type="button"
                  onClick={() => enterPreview(account)}
                  disabled={busy}
                  aria-busy={loading}
                  className={cn(
                    "flex min-h-[60px] w-full items-center gap-3.5 rounded-[var(--kx-radius-md)] border border-line bg-surface px-4 py-3 text-left",
                    "transition-[border-color,background-color,transform] duration-[165ms]",
                    "hover:border-line-strong hover:bg-surface-nested active:scale-[0.995]",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    loading && "border-forest-400 dark:border-gold-500/50",
                  )}
                >
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-nested text-ink-secondary">
                    <Icon className="size-4.5" strokeWidth={1.8} aria-hidden />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="type-body block truncate font-medium text-ink">
                      {account.label}
                    </span>
                    <span className="type-meta block truncate text-ink-muted">
                      {loading ? "Signing you in…" : account.detail}
                    </span>
                  </span>

                  <ChevronRight
                    className="size-4 shrink-0 text-ink-muted"
                    strokeWidth={2}
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-7 flex items-center gap-3">
        <span className="kx-hairline flex-1" role="presentation" />
        <span className="type-micro text-ink-muted">or sign in</span>
        <span className="kx-hairline flex-1" role="presentation" />
      </div>

      </> : null}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5" noValidate>
        {formError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-[var(--kx-radius-md)] border border-danger-500/25 bg-danger-50 px-4 py-3 dark:bg-danger-500/10"
          >
            <AlertCircle
              className="mt-0.5 size-4 shrink-0 text-danger-600 dark:text-red-300"
              strokeWidth={2}
              aria-hidden
            />
            <p className="type-meta text-danger-700 dark:text-red-200">{formError}</p>
          </div>
        ) : null}

        <Input
          label={LIVE_FREE_BUSES ? "Email or username" : "Email or phone number"}
          placeholder="grace.adeyemi@example.com"
          autoComplete="username"
          icon={Mail}
          error={errors.identifier?.message}
          required
          {...register("identifier")}
        />

        <PasswordInput
          label="Password"
          placeholder="Your password"
          error={errors.password?.message}
          required
          {...register("password")}
        />

        {!LIVE_FREE_BUSES ? <div className="flex items-center justify-between gap-4">
          <Checkbox label="Remember me" {...register("remember")} />
          <Link
            href="/forgot-password"
            className="kx-tap inline-flex items-center text-[0.8125rem] font-medium text-forest-700 underline-offset-4 hover:underline dark:text-gold-300"
          >
            Forgot password?
          </Link>
        </div> : <p className="type-meta text-ink-muted">Your session stays signed in for up to 8 hours. Password recovery is not connected yet.</p>}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          loading={isSubmitting}
          loadingLabel="Signing you in"
          iconRight={ArrowRight}
          disabled={busy}
        >
          Sign In
        </Button>
      </form>

      <p className="type-meta mt-6 text-center text-ink-secondary">
        New here?{" "}
        <Link
          href="/signup"
          className="font-medium text-forest-700 underline-offset-4 hover:underline dark:text-gold-300"
        >
          Create account
        </Link>
      </p>
    </div>
  );
}
