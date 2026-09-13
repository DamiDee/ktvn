"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, KeyRound, Mail, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatedCheck, StatusBadge } from "@/components/ui/badge";
import { RouteLoader } from "@/components/ui/route-loader";
import { MEMBERSHIP_PRESENTATION } from "@/constants/status-presentation";
import { MembershipStatus } from "@/types/enums";
import { userService } from "@/services";
import { ApiError } from "@/services/api-client";
import {
  CODE_LENGTH,
  emailCodeSchema,
  emailRequestSchema,
  type EmailCodeValues,
  type EmailRequestValues,
} from "./schemas";

/**
 * Membership confirmation by emailed one-time code.
 *
 * Two steps: ask for the address, then take the code. The membership status
 * badge stays visible the whole way through so the member can always see
 * where they stand.
 */
export function MemberVerification() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [status, setStatus] = useState<MembershipStatus>(
    MembershipStatus.UNVERIFIED,
  );

  return (
    <div>
      <h1 className="type-page-title text-ink">Confirm your membership.</h1>
      <p className="type-body mt-2.5 text-ink-secondary">
        We email you a {CODE_LENGTH}-digit code to confirm the address on your
        membership record. This only happens once.
      </p>

      <div className="mt-8 overflow-hidden rounded-[var(--kx-radius-xl)] border border-line bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <p className="type-micro text-ink-muted">Membership status</p>
          <StatusBadge
            presentation={MEMBERSHIP_PRESENTATION[status]}
            live={status === MembershipStatus.CHECKING}
          />
        </div>

        <div className="px-5 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={
                status === MembershipStatus.VERIFIED
                  ? "done"
                  : status === MembershipStatus.CHECKING
                    ? "checking"
                    : sentTo
                      ? "code"
                      : "email"
              }
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28 }}
            >
              {status === MembershipStatus.CHECKING ? (
                <RouteLoader
                  size="sm"
                  messages={[
                    "Checking your code",
                    "Matching your membership record",
                  ]}
                  className="py-2"
                />
              ) : status === MembershipStatus.VERIFIED ? (
                <VerifiedPanel />
              ) : sentTo ? (
                <CodeStep
                  maskedEmail={sentTo}
                  status={status}
                  onStatus={setStatus}
                  onUseAnotherEmail={() => {
                    setSentTo(null);
                    setStatus(MembershipStatus.UNVERIFIED);
                  }}
                />
              ) : (
                <EmailStep onSent={setSentTo} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function VerifiedPanel() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <AnimatedCheck size={48} />
      <div>
        <p className="type-card-title text-ink">Membership confirmed</p>
        <p className="type-meta mt-1 text-ink-secondary">
          You can request rides on either track.
        </p>
      </div>
      <Button
        variant="primary"
        size="lg"
        block
        iconRight={ArrowRight}
        onClick={() => router.push("/passenger/rides")}
      >
        Continue to your rides
      </Button>
    </div>
  );
}

function EmailStep({ onSent }: { onSent: (maskedEmail: string) => void }) {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailRequestValues>({
    resolver: zodResolver(emailRequestSchema),
    defaultValues: { email: "" },
  });

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        try {
          const result = await userService.sendMembershipCode(values.email);
          onSent(result.maskedEmail);
        } catch (caught) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "We couldn't send that code. Try again in a moment.",
          );
        }
      })}
      className="space-y-5"
      noValidate
    >
      {error ? (
        <p className="type-meta text-danger-600 dark:text-red-300">{error}</p>
      ) : null}

      <Input
        label="Email address"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        hint="Use the address on your membership record."
        icon={Mail}
        required
        error={errors.email?.message}
        {...register("email")}
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
        Email me a code
      </Button>
    </form>
  );
}

function CodeStep({
  maskedEmail,
  status,
  onStatus,
  onUseAnotherEmail,
}: {
  maskedEmail: string;
  status: MembershipStatus;
  onStatus: (status: MembershipStatus) => void;
  onUseAnotherEmail: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailCodeValues>({
    resolver: zodResolver(emailCodeSchema),
    defaultValues: { code: "" },
  });

  const resend = useCallback(async () => {
    setError(null);
    setResent(false);
    await userService.sendMembershipCode(`x@${maskedEmail.split("@")[1] ?? "x"}`);
    setResent(true);
  }, [maskedEmail]);

  const needsAttention =
    status === MembershipStatus.ACTION_REQUIRED ||
    status === MembershipStatus.REJECTED;

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        setResent(false);
        onStatus(MembershipStatus.CHECKING);
        try {
          const result = await userService.verifyMembershipCode(values.code);
          onStatus(result);
        } catch (caught) {
          onStatus(MembershipStatus.UNVERIFIED);
          setError(
            caught instanceof ApiError
              ? caught.message
              : "We couldn't check that code. Try again in a moment.",
          );
        }
      })}
      className="space-y-5"
      noValidate
    >
      <p className="type-meta text-center text-ink-secondary">
        We emailed a {CODE_LENGTH}-digit code to{" "}
        <span className="font-medium text-ink">{maskedEmail}</span>.
      </p>

      {error ? (
        <p className="type-meta text-center text-danger-600 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {resent ? (
        <p className="type-meta text-center text-ink-secondary">
          A new code is on its way. The previous one no longer works.
        </p>
      ) : null}

      {needsAttention ? (
        <p
          className={cn(
            "type-meta text-center",
            status === MembershipStatus.REJECTED
              ? "text-danger-600 dark:text-red-300"
              : "text-ink-secondary",
          )}
        >
          {MEMBERSHIP_PRESENTATION[status].detail}
        </p>
      ) : null}

      <Input
        label="Verification code"
        placeholder={"0".repeat(CODE_LENGTH)}
        inputMode="numeric"
        maxLength={CODE_LENGTH}
        autoComplete="one-time-code"
        icon={KeyRound}
        required
        className="type-numeric tracking-[0.35em]"
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
        Confirm membership
      </Button>

      <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          block
          icon={RefreshCw}
          onClick={resend}
        >
          Send a new code
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          block
          icon={ArrowLeft}
          onClick={onUseAnotherEmail}
        >
          Use a different email
        </Button>
      </div>
    </form>
  );
}
