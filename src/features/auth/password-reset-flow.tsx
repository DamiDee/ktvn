"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, ArrowRight, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, PasswordInput } from "@/components/ui/input";
import { AnimatedCheck } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { ApiError, userService } from "@/services";
import {
  newPasswordSchema,
  resetCodeSchema,
  resetIdentifierSchema,
  type NewPasswordValues,
  type ResetCodeValues,
  type ResetIdentifierValues,
} from "./schemas";

type Step = "identifier" | "verification" | "password" | "success";

const STEP_ORDER: Step[] = ["identifier", "verification", "password", "success"];

const stepVariants = {
  initial: (direction: number) => ({ opacity: 0, x: direction * 24 }),
  animate: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -24 }),
};

/** Four seamless steps: identifier → code → new password → confirmation. */
export function PasswordResetFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("identifier");
  const [direction, setDirection] = useState(1);
  const [destination, setDestination] = useState("");

  function goTo(next: Step) {
    setDirection(STEP_ORDER.indexOf(next) > STEP_ORDER.indexOf(step) ? 1 : -1);
    setStep(next);
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div>
      {step !== "success" ? (
        <ProgressBar
          value={(stepIndex + 1) / (STEP_ORDER.length - 1)}
          label={`Step ${stepIndex + 1} of ${STEP_ORDER.length - 1}`}
          size="sm"
          className="mb-8"
        />
      ) : null}

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={stepVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {step === "identifier" ? (
            <IdentifierStep
              onDone={(masked) => {
                setDestination(masked);
                goTo("verification");
              }}
            />
          ) : null}

          {step === "verification" ? (
            <VerificationStep
              destination={destination}
              onBack={() => goTo("identifier")}
              onDone={() => goTo("password")}
            />
          ) : null}

          {step === "password" ? (
            <NewPasswordStep onDone={() => goTo("success")} />
          ) : null}

          {step === "success" ? (
            <SuccessStep onContinue={() => router.push("/login")} />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-[var(--kx-radius-md)] border border-danger-500/25 bg-danger-50 px-4 py-3 dark:bg-danger-500/10"
    >
      <AlertCircle
        className="mt-0.5 size-4 shrink-0 text-danger-600 dark:text-red-300"
        strokeWidth={2}
        aria-hidden
      />
      <p className="type-meta text-danger-700 dark:text-red-200">{message}</p>
    </div>
  );
}

function IdentifierStep({ onDone }: { onDone: (masked: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetIdentifierValues>({
    resolver: zodResolver(resetIdentifierSchema),
    defaultValues: { identifier: "" },
  });

  return (
    <>
      <h1 className="type-page-title text-ink">Reset your password.</h1>
      <p className="type-body mt-2.5 text-ink-secondary">
        Tell us how to reach you and we&rsquo;ll send a six-digit code.
      </p>

      <form
        onSubmit={handleSubmit(async (values) => {
          setError(null);
          try {
            const result = await userService.requestPasswordReset(values.identifier);
            onDone(result.maskedDestination);
          } catch (caught) {
            setError(
              caught instanceof ApiError
                ? caught.message
                : "We couldn't send that code. Try again in a moment.",
            );
          }
        })}
        className="mt-8 space-y-5"
        noValidate
      >
        <FormError message={error} />

        <Input
          label="Email, phone or member ID"
          placeholder="grace.adeyemi@example.com"
          icon={Mail}
          error={errors.identifier?.message}
          {...register("identifier")}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          loading={isSubmitting}
          loadingLabel="Sending code"
          iconRight={ArrowRight}
        >
          Send code
        </Button>
      </form>

      <p className="type-meta mt-6 text-center text-ink-secondary">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-forest-700 underline-offset-4 hover:underline dark:text-gold-300"
        >
          Back to sign in
        </Link>
      </p>
    </>
  );
}

function VerificationStep({
  destination,
  onBack,
  onDone,
}: {
  destination: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetCodeValues>({
    resolver: zodResolver(resetCodeSchema),
    defaultValues: { code: "" },
  });

  return (
    <>
      <h1 className="type-page-title text-ink">Enter your code.</h1>
      <p className="type-body mt-2.5 text-ink-secondary">
        We sent a six-digit code to{" "}
        <span className="type-numeric font-medium text-ink">{destination}</span>.
      </p>

      <form
        onSubmit={handleSubmit(async (values) => {
          setError(null);
          try {
            await userService.verifyResetCode(values.code);
            onDone();
          } catch (caught) {
            setError(
              caught instanceof ApiError
                ? caught.message
                : "We couldn't check that code. Try again in a moment.",
            );
          }
        })}
        className="mt-8 space-y-5"
        noValidate
      >
        <FormError message={error} />

        <Input
          label="Verification code"
          placeholder="000000"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          icon={KeyRound}
          className="type-numeric tracking-[0.4em]"
          error={errors.code?.message}
          {...register("code")}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          loading={isSubmitting}
          loadingLabel="Checking code"
          iconRight={ArrowRight}
        >
          Continue
        </Button>

        <Button variant="ghost" size="sm" block icon={ArrowLeft} onClick={onBack}>
          Use a different account
        </Button>
      </form>
    </>
  );
}

function NewPasswordStep({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  return (
    <>
      <h1 className="type-page-title text-ink">Choose a new password.</h1>
      <p className="type-body mt-2.5 text-ink-secondary">
        Use at least eight characters, with an uppercase letter and a number.
      </p>

      <form
        onSubmit={handleSubmit(async () => {
          setError(null);
          try {
            await userService.completePasswordReset();
            onDone();
          } catch (caught) {
            setError(
              caught instanceof ApiError
                ? caught.message
                : "We couldn't save that password. Try again in a moment.",
            );
          }
        })}
        className="mt-8 space-y-5"
        noValidate
      >
        <FormError message={error} />

        <PasswordInput
          label="New password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          loading={isSubmitting}
          loadingLabel="Saving password"
        >
          Save password
        </Button>
      </form>
    </>
  );
}

function SuccessStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="text-center">
      <div className="mb-6 flex justify-center">
        <AnimatedCheck size={56} />
      </div>

      <h1 className="type-page-title text-ink">Password updated.</h1>
      <p className="type-body mx-auto mt-2.5 max-w-sm text-ink-secondary">
        You can sign in with your new password now. Any other devices signed in
        to this account will need it too.
      </p>

      <Button
        variant="primary"
        size="lg"
        block
        className="mt-8"
        iconRight={ArrowRight}
        onClick={onContinue}
      >
        Back to sign in
      </Button>
    </div>
  );
}
