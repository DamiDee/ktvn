"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, Mail } from "lucide-react";
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

export function LoginForm() {
  const router = useRouter();
  const setActiveDriverId = useSessionStore((state) => state.setActiveDriverId);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "", remember: true },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      const user = await userService.signIn({
        identifier: values.identifier,
        password: values.password,
      });

      // Remember which driver signed in, so the driver screens show that
      // person's track rather than a fixed demo account.
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

  return (
    <div>
      <h1 className="type-page-title text-ink">Welcome back.</h1>
      <p className="type-body mt-2.5 text-ink-secondary">
        Sign in with the email, phone number or member ID on your membership
        record.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
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
        Demo build — any password works. Try{" "}
        <code className="type-numeric text-ink-secondary">
          grace.adeyemi@example.com
        </code>{" "}
        for a passenger,{" "}
        <code className="type-numeric text-ink-secondary">
          emeka.nwosu@example.com
        </code>{" "}
        for a driver, or{" "}
        <code className="type-numeric text-ink-secondary">
          deborah.ajayi@koinonia.example
        </code>{" "}
        for admin.
      </p>
    </div>
  );
}
