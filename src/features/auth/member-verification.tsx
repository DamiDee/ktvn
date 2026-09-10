"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, IdCard, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatedCheck, StatusBadge } from "@/components/ui/badge";
import { RouteLoader } from "@/components/ui/route-loader";
import { MEMBERSHIP_PRESENTATION } from "@/constants/status-presentation";
import { MembershipStatus } from "@/types/enums";
import { userService } from "@/services";
import {
  memberVerificationSchema,
  type MemberVerificationValues,
} from "./schemas";

/**
 * Membership verification card. Walks the five membership states, animating a
 * checkmark when the record is confirmed.
 */
export function MemberVerification() {
  const router = useRouter();
  const [status, setStatus] = useState<MembershipStatus>(
    MembershipStatus.UNVERIFIED,
  );

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<MemberVerificationValues>({
    resolver: zodResolver(memberVerificationSchema),
    defaultValues: { memberId: "" },
  });

  async function check(memberId: string) {
    setStatus(MembershipStatus.CHECKING);
    const result = await userService.verifyMembership(memberId);
    setStatus(result);
  }

  const presentation = MEMBERSHIP_PRESENTATION[status];

  return (
    <div>
      <h1 className="type-page-title text-ink">Confirm your membership.</h1>
      <p className="type-body mt-2.5 text-ink-secondary">
        We check your identifier against the community register. This only
        happens once.
      </p>

      <div className="mt-8 overflow-hidden rounded-[var(--kx-radius-xl)] border border-line bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <p className="type-micro text-ink-muted">Membership status</p>
          <StatusBadge presentation={presentation} live={status === MembershipStatus.CHECKING} />
        </div>

        <div className="px-5 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={status}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28 }}
            >
              {status === MembershipStatus.CHECKING ? (
                <RouteLoader
                  size="sm"
                  messages={[
                    "Checking the community register",
                    "Matching your membership record",
                  ]}
                  className="py-2"
                />
              ) : status === MembershipStatus.VERIFIED ? (
                <div className="flex flex-col items-center gap-4 py-2 text-center">
                  <AnimatedCheck size={48} />
                  <div>
                    <p className="type-card-title text-ink">Membership confirmed</p>
                    <p className="type-meta mt-1 text-ink-secondary">
                      You can request rides on either track.
                    </p>
                  </div>
                </div>
              ) : (
                <p
                  className={cn(
                    "type-body text-center",
                    status === MembershipStatus.REJECTED
                      ? "text-danger-600 dark:text-red-300"
                      : "text-ink-secondary",
                  )}
                >
                  {presentation.detail}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {status === MembershipStatus.VERIFIED ? (
        <Button
          variant="primary"
          size="lg"
          block
          className="mt-6"
          iconRight={ArrowRight}
          onClick={() => router.push("/passenger")}
        >
          Continue to your dashboard
        </Button>
      ) : (
        <form
          onSubmit={handleSubmit((values) => check(values.memberId))}
          className="mt-6 space-y-5"
          noValidate
        >
          <Input
            label="Member ID"
            placeholder="KOI-2019-004821"
            hint="Find this on your membership card or in the members' portal."
            icon={IdCard}
            error={errors.memberId?.message}
            disabled={status === MembershipStatus.CHECKING}
            {...register("memberId")}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            loading={status === MembershipStatus.CHECKING}
            loadingLabel="Checking"
            icon={
              status === MembershipStatus.ACTION_REQUIRED ||
              status === MembershipStatus.REJECTED
                ? RefreshCw
                : undefined
            }
          >
            {status === MembershipStatus.UNVERIFIED
              ? "Check membership"
              : "Check again"}
          </Button>

          {status === MembershipStatus.ACTION_REQUIRED ||
          status === MembershipStatus.REJECTED ? (
            <Button
              variant="ghost"
              size="sm"
              block
              onClick={() => check(getValues("memberId"))}
            >
              Contact the membership desk
            </Button>
          ) : null}
        </form>
      )}
    </div>
  );
}
