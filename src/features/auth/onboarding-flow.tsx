"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  HandHeart,
  MapPin,
  Share2,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { MapCanvas } from "@/components/maps/map-canvas";
import { KoinoniaMark } from "@/components/ui/route-loader";
import { VerifiedBadge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buildRoute } from "@/lib/geo";
import { LOCATIONS } from "@/mocks/locations";
import { DriverTrack } from "@/types/enums";
import { TRACK_DESCRIPTION } from "@/constants/status-presentation";
import { useRideSimulation } from "@/features/rides/use-ride-simulation";

const STEPS = [
  "welcome",
  "verified",
  "tracks",
  "safety",
  "ready",
] as const;

type StepId = (typeof STEPS)[number];

const slideVariants = {
  initial: (direction: number) => ({ opacity: 0, x: direction * 32 }),
  animate: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -32 }),
};

export function OnboardingFlow() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  function go(next: number) {
    setDirection(next > index ? 1 : -1);
    setIndex(Math.max(0, Math.min(STEPS.length - 1, next)));
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="kx-tap inline-flex items-center gap-2.5"
          aria-label="Koinonia VTN — home"
        >
          <KoinoniaMark className="size-6 text-forest-800 dark:text-gold-400" />
          <span className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-ink">
            Koinonia
            <span className="ml-1.5 font-normal text-ink-muted">VTN</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {!isLast ? (
            <Link
              href="/signup"
              className="kx-tap inline-flex items-center text-[0.8125rem] font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Skip
            </Link>
          ) : null}
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-3xl">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            >
              <StepContent step={step} />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="px-5 pb-8 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="md"
            icon={ArrowLeft}
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className={cn("shrink-0 px-3 sm:px-5", index === 0 && "invisible")}
          >
            {/* Label is dropped on the narrowest screens so the row still fits. */}
            <span className="hidden xs:inline">Back</span>
          </Button>

          <div
            className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:gap-2"
            role="tablist"
            aria-label="Onboarding progress"
          >
            {STEPS.map((id, stepIndex) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={stepIndex === index}
                aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
                onClick={() => go(stepIndex)}
                className="kx-tap p-1.5"
              >
                <motion.span
                  animate={{ width: stepIndex === index ? 24 : 6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 26 }}
                  className={cn(
                    "block h-1.5 rounded-full",
                    stepIndex === index
                      ? "bg-forest-700 dark:bg-gold-500"
                      : "bg-[color-mix(in_srgb,var(--kx-text)_16%,transparent)]",
                  )}
                />
              </button>
            ))}
          </div>

          {isLast ? (
            <div className="w-11 shrink-0 sm:w-[88px]" aria-hidden />
          ) : (
            <Button
              variant="primary"
              size="md"
              iconRight={ArrowRight}
              onClick={() => go(index + 1)}
              className="shrink-0 px-4 sm:px-5"
            >
              <span className="hidden xs:inline">Continue</span>
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function StepContent({ step }: { step: StepId }) {
  switch (step) {
    case "welcome":
      return <WelcomeStep />;
    case "verified":
      return <VerifiedStep />;
    case "tracks":
      return <TracksStep />;
    case "safety":
      return <SafetyStep />;
    case "ready":
      return <ReadyStep />;
  }
}

function StepFrame({
  headline,
  body,
  children,
}: {
  headline: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <h1 className="type-page-title mx-auto max-w-xl text-ink">{headline}</h1>
      {body ? (
        <p className="type-body-lg mx-auto mt-4 max-w-lg text-ink-secondary">
          {body}
        </p>
      ) : null}
      {children ? <div className="mt-9">{children}</div> : null}
    </div>
  );
}

function WelcomeStep() {
  const converging = [
    buildRoute(LOCATIONS.gwarinpa, LOCATIONS.koinoniaCentre, { seed: "conv-1" }),
    buildRoute(LOCATIONS.wuseII, LOCATIONS.koinoniaCentre, { seed: "conv-2" }),
    buildRoute(LOCATIONS.kubwa, LOCATIONS.koinoniaCentre, { seed: "conv-3" }),
  ];

  const first = useRideSimulation({ route: converging[0], durationSeconds: 18 });
  const second = useRideSimulation({ route: converging[1], durationSeconds: 22 });
  const third = useRideSimulation({ route: converging[2], durationSeconds: 26 });

  const movers = [first, second, third];

  return (
    <StepFrame
      headline="Welcome to a safer way to move together."
      body="Members travelling the same way, in vehicles that have been checked, on journeys that stay visible."
    >
      <div className="overflow-hidden rounded-[var(--kx-radius-2xl)] border border-line shadow-lg">
        <MapCanvas
          className="h-[300px] w-full sm:h-[360px]"
          description="Several members converging on Koinonia Centre from across the city."
          routes={converging.map((route, index) => ({
            id: `conv-${index}`,
            path: route,
            variant: index === 0 ? "primary" : "alternate",
            animateDraw: true,
          }))}
          markers={[
            {
              id: "centre",
              position: LOCATIONS.koinoniaCentre,
              kind: "destination",
            },
            ...movers.flatMap((mover, index) =>
              mover.position
                ? [
                    {
                      id: `mover-${index}`,
                      position: mover.position,
                      kind: "vehicle" as const,
                      heading: mover.heading,
                      track:
                        index === 1
                          ? DriverTrack.PROFESSIONAL
                          : DriverTrack.VOLUNTEER,
                    },
                  ]
                : [],
            ),
          ]}
        />
      </div>
    </StepFrame>
  );
}

function VerifiedStep() {
  const cards = [
    { name: "Grace A.", role: "Verified Member", tone: "forest" as const },
    { name: "Chinedu O.", role: "Verified Driver", tone: "gold" as const },
    { name: "Toyota Camry", role: "Vehicle Verified", tone: "lilac" as const },
  ];

  return (
    <StepFrame
      headline="Every rider. Every driver. Verified."
      body="Passengers and drivers both belong to the verified community, and every vehicle is checked before it carries anyone."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card, index) => (
          <motion.div
            key={card.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 + index * 0.14 }}
            className="rounded-[var(--kx-radius-lg)] border border-line bg-surface p-5"
          >
            <div className="flex justify-center">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  delay: 0.45 + index * 0.14,
                }}
                className="inline-flex size-10 items-center justify-center rounded-full bg-forest-600 text-white dark:bg-gold-500 dark:text-forest-950"
              >
                <BadgeCheck className="size-5" strokeWidth={2} aria-hidden />
              </motion.span>
            </div>
            <p className="type-card-title mt-4 text-ink">{card.name}</p>
            <div className="mt-2 flex justify-center">
              <VerifiedBadge label={card.role} tone={card.tone} />
            </div>
          </motion.div>
        ))}
      </div>
    </StepFrame>
  );
}

function TracksStep() {
  return (
    <StepFrame
      headline="Choose how you travel."
      body="Both tracks pass the same verification. The difference is whether the journey is given in service or paid for."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            icon: HandHeart,
            title: "Volunteer",
            description: TRACK_DESCRIPTION[DriverTrack.VOLUNTEER],
            detail: "A member with a free seat, going where you're going.",
            tone: "gold" as const,
          },
          {
            icon: Wallet,
            title: "Professional",
            description: TRACK_DESCRIPTION[DriverTrack.PROFESSIONAL],
            detail: "A fare shown before you request, and a receipt after.",
            tone: "lilac" as const,
          },
        ].map((track, index) => {
          const Icon = track.icon;
          return (
            <motion.div
              key={track.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.48, delay: 0.12 + index * 0.12 }}
              className={cn(
                "rounded-[var(--kx-radius-xl)] border p-6 text-left",
                track.tone === "gold"
                  ? "border-gold-200/80 bg-gold-50/60 dark:border-gold-700/30 dark:bg-gold-500/8"
                  : "border-lilac-200/70 bg-lilac-50/60 dark:border-lilac-700/30 dark:bg-lilac-500/8",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-[var(--kx-radius-sm)]",
                  track.tone === "gold"
                    ? "bg-gold-500/18 text-gold-700 dark:text-gold-300"
                    : "bg-lilac-500/16 text-lilac-700 dark:text-lilac-300",
                )}
              >
                <Icon className="size-5" strokeWidth={1.7} aria-hidden />
              </span>
              <p className="type-card-title mt-4 text-ink">{track.title}</p>
              <p className="type-body mt-1.5 font-medium text-ink">
                {track.description}
              </p>
              <p className="type-meta mt-2 text-ink-secondary">{track.detail}</p>
            </motion.div>
          );
        })}
      </div>
    </StepFrame>
  );
}

function SafetyStep() {
  const features = [
    { icon: MapPin, label: "Live route" },
    { icon: Share2, label: "Share Trip" },
    { icon: ShieldAlert, label: "SOS" },
    { icon: Users, label: "Trusted contact" },
  ];

  return (
    <StepFrame
      headline="Your journey doesn't disappear after you enter the car."
      body="The trip stays on a map, shareable with someone you trust, and reachable by the safety team until you arrive."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 0.12 + index * 0.09 }}
              className="flex flex-col items-center gap-3 rounded-[var(--kx-radius-lg)] border border-line bg-surface p-5"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-forest-50 text-forest-700 dark:bg-forest-500/16 dark:text-forest-200">
                <Icon className="size-4.5" strokeWidth={1.7} aria-hidden />
              </span>
              <p className="type-meta font-medium text-ink">{feature.label}</p>
            </motion.div>
          );
        })}
      </div>

      <p className="type-meta mx-auto mt-6 max-w-md text-ink-muted">
        These tools keep you visible and reachable. They reduce risk — they
        don&rsquo;t remove it, and the network doesn&rsquo;t insure journeys.
      </p>
    </StepFrame>
  );
}

function ReadyStep() {
  return (
    <StepFrame
      headline="Ready when you are."
      body="Create an account with your membership identifier, or sign in if you already have one."
    >
      <div className="mx-auto flex max-w-sm flex-col gap-3">
        <ButtonLink href="/signup" variant="primary" size="lg" block iconRight={ArrowRight}>
          Create Account
        </ButtonLink>
        <ButtonLink href="/login" variant="secondary" size="lg" block>
          Sign In
        </ButtonLink>
      </div>
    </StepFrame>
  );
}
