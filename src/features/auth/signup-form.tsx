"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, Mail, Phone, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, PasswordInput } from "@/components/ui/input";
import { userService, ApiError } from "@/services";
import { signUpSchema, liveSignUpSchema, passwordStrength, type SignUpValues, type LiveSignUpValues } from "./schemas";
import { LIVE_FREE_BUSES } from "@/lib/freebus-config";
import { FreebusError } from "@/services/freebus-api";
import type { Resolver } from "react-hook-form";
import { useToast } from "@/components/ui/toast";

const STRENGTH_COLOURS = [
  "bg-line-strong",
  "bg-danger-500",
  "bg-gold-500",
  "bg-gold-400",
  "bg-success-500",
] as const;

export function SignUpForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues & Partial<LiveSignUpValues>>({
    resolver: zodResolver(LIVE_FREE_BUSES ? liveSignUpSchema : signUpSchema) as Resolver<SignUpValues & Partial<LiveSignUpValues>>,
    mode: "onBlur",
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      username: "",
      address: "",
      country: "Nigeria",
      password: "",
      confirmPassword: "",
    },
  });

  const password = useWatch({ control, name: "password" });
  const strength = passwordStrength(password ?? "");

  async function onSubmit(values: SignUpValues & Partial<LiveSignUpValues>) {
    setFormError(null);
    try {
      await userService.signUp({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
        username: values.username,
        address: values.address,
        country: values.country,
      });
      if (LIVE_FREE_BUSES) toast({ title: "Account created", description: "Sign in with your new email or username.", tone: "success" });
      router.push(LIVE_FREE_BUSES ? "/login" : "/verify-member");
    } catch (error) {
      setFormError(
        error instanceof ApiError || error instanceof FreebusError
          ? error.message
          : "We couldn't create your account just now. Try again in a moment.",
      );
    }
  }

  return (
    <div>
      <h1 className="type-page-title text-ink">Create your account.</h1>
      <p className="type-body mt-2.5 text-ink-secondary">
        Join your community and book a seat on a free bus to service.
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
          label="Full name"
          placeholder="Grace Adeyemi"
          autoComplete="name"
          icon={User}
          error={errors.fullName?.message}
          required
          {...register("fullName")}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            icon={Mail}
            error={errors.email?.message}
            required
            {...register("email")}
          />

          <Input
            label="Phone"
            type="tel"
            placeholder="+234 802 000 0000"
            autoComplete="tel"
            icon={Phone}
            error={errors.phone?.message}
            required
            {...register("phone")}
          />
        </div>

        {LIVE_FREE_BUSES ? <>
          <Input label="Username" autoComplete="username" required error={errors.username?.message} {...register("username")} />
          <Input label="Address" autoComplete="street-address" required error={errors.address?.message} {...register("address")} />
          <Input label="Country" autoComplete="country-name" required error={errors.country?.message} {...register("country")} />
        </> : null}

        <div>
          <PasswordInput
            label="Password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            error={errors.password?.message}
            required
            {...register("password")}
          />

          {password ? (
            <div className="mt-2.5 flex items-center gap-3">
              <div className="flex flex-1 gap-1" aria-hidden>
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors duration-[250ms]",
                      step <= strength.score
                        ? STRENGTH_COLOURS[strength.score]
                        : "bg-[color-mix(in_srgb,var(--kx-text)_10%,transparent)]",
                    )}
                  />
                ))}
              </div>
              <span className="type-meta shrink-0 text-ink-muted">
                {strength.label}
              </span>
            </div>
          ) : null}
        </div>

        <PasswordInput
          label="Confirm password"
          placeholder="Re-enter your password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          required
          {...register("confirmPassword")}
        />

        <Checkbox
          label={
            <>
              I accept the{" "}
              <Link href="/#terms" className="font-medium text-forest-700 underline underline-offset-4 dark:text-gold-300">
                terms of use
              </Link>{" "}
              and{" "}
              <Link href="/#privacy" className="font-medium text-forest-700 underline underline-offset-4 dark:text-gold-300">
                privacy notice
              </Link>
              .
            </>
          }
          error={errors.acceptedTerms?.message}
          {...register("acceptedTerms")}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          loading={isSubmitting}
          loadingLabel="Creating your account"
          iconRight={ArrowRight}
        >
          Create Account
        </Button>
      </form>

      <p className="type-meta mt-6 text-center text-ink-secondary">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-forest-700 underline-offset-4 hover:underline dark:text-gold-300"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
