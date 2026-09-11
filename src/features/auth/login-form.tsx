"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowRight,
  CarFront,
  HandHeart,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, PasswordInput } from "@/components/ui/input";
import { userService, ApiError } from "@/services";
import { UserRole } from "@/types/enums";
import { useSessionStore } from "@/stores/session-store";
import { loginSchema, type LoginValues } from "./schemas";

const ROLE_HOME: Record<string, string> = {
  [UserRole.PASSENGER]: "/passenger",
  [UserRole.DRIVER]: "/driver",
  [UserRole.ADMIN]: "/admin",
};

const DEMO_IDENTITIES = [
  {
    label: "Passenger",
    detail: "Request and track rides",
    identifier: "grace.adeyemi@example.com",
    icon: UserRound,
  },
  {
    label: "Volunteer driver",
    detail: "Serve after gatherings",
    identifier: "emeka.nwosu@example.com",
    icon: HandHeart,
  },
  {
    label: "Professional driver",
    detail: "Drive and view earnings",
    identifier: "chinedu.okafor@example.com",
    icon: CarFront,
  },
  {
    label: "Oversight admin",
    detail: "Monitor the network",
    identifier: "deborah.ajayi@koinonia.example",
    icon: ShieldCheck,
  },
] as const;

export function LoginForm() {
  const router = useRouter();
  const setRole = useSessionStore((state) => state.setRole);
  const setActiveDriverId = useSessionStore((state) => state.setActiveDriverId);
  const [formError, setFormError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "", remember: true },
  });

  async function signIn(identifier: string, password: string) {
    setFormError(null);
    try {
      const user = await userService.signIn({
        identifier,
        password,
      });

      // Remember which driver signed in, so the driver screens show that
      // person's track rather than a fixed demo account.
      setRole(user.role);
      setActiveDriverId(user.role === UserRole.DRIVER ? user.id : null);

      router.push(ROLE_HOME[user.role] ?? "/passenger");
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "We couldn't sign you in just now. Try again in a moment.",
      );
    }
  }

  async function onSubmit(values: LoginValues) {
    await signIn(values.identifier, values.password);
  }

  async function quickSignIn(identifier: string) {
    setDemoLoading(identifier);
    await signIn(identifier, "demo-password");
    setDemoLoading(null);
  }

  return (
    <div>
      <h1 className="type-page-title text-ink">Welcome back.</h1>
      <p className="type-body mt-2.5 text-ink-secondary">
        Sign in with the email, phone number or member ID on your membership
        record.
      </p>

      <div className="mt-7">
        <div className="flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-line" />
          <span className="type-micro text-ink-muted">Preview the product as</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {DEMO_IDENTITIES.map((identity) => {
            const Icon = identity.icon;
            return (
              <button
                key={identity.identifier}
                type="button"
                disabled={Boolean(demoLoading) || isSubmitting}
                onClick={() => quickSignIn(identity.identifier)}
                className="group flex min-h-16 items-center gap-3 rounded-[var(--kx-radius-md)] border border-line bg-surface-nested p-3 text-left transition-[border-color,transform,box-shadow] hover:-translate-y-px hover:border-forest-400 hover:shadow-sm disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-forest-700 ring-1 ring-line dark:text-gold-400">
                  <Icon className="size-4" strokeWidth={1.8} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="type-meta block font-semibold text-ink">
                    {demoLoading === identity.identifier
                      ? "Opening…"
                      : identity.label}
                  </span>
                  <span className="block truncate text-[0.75rem] text-ink-muted">
                    {identity.detail}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-5" noValidate>
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
          label="Email, phone or member ID"
          placeholder="grace.adeyemi@example.com"
          autoComplete="username"
          icon={Mail}
          error={errors.identifier?.message}
          {...register("identifier")}
        />

        <PasswordInput
          label="Password"
          placeholder="Your password"
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="flex items-center justify-between gap-4">
          <Checkbox label="Remember me" {...register("remember")} />
          <Link
            href="/forgot-password"
            className="kx-tap inline-flex items-center text-[0.8125rem] font-medium text-forest-700 underline-offset-4 hover:underline dark:text-gold-300"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          loading={isSubmitting}
          loadingLabel="Signing you in"
          iconRight={ArrowRight}
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

      <p className="type-meta mt-8 rounded-[var(--kx-radius-md)] border border-line bg-surface-nested px-4 py-3 text-ink-muted">
        Demo build — choose a role above for one-click access, or enter any
        listed demo account with any password.
      </p>
    </div>
  );
}
