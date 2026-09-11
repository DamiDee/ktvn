import type { Metadata } from "next";
import { Activity, ArrowRight, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { HeroMockup } from "@/components/marketing/hero-mockup";
import { Section, SectionHeader, Reveal } from "@/components/marketing/section";
import { TrustSequence } from "@/components/marketing/trust-sequence";
import { TrackCards } from "@/components/marketing/track-cards";
import { SafetyShowcase } from "@/components/marketing/safety-showcase";
import { DriverPreview } from "@/components/marketing/driver-preview";
import { HeroCopy } from "@/components/marketing/hero-copy";
import { CommunityStory } from "@/components/marketing/community-story";
import { LiquidBackdrop } from "@/components/ui/liquid-backdrop";

export const metadata: Metadata = {
  title: "Move together. Travel with confidence.",
  description:
    "A verified transportation network built for the Koinonia community. Find trusted volunteer or professional drivers, travel with live trip visibility, and stay connected from departure to destination.",
};

export default function LandingPage() {
  return (
    <>
      <MarketingHeader />

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pt-28 pb-20 sm:px-6 sm:pt-36 sm:pb-28">
          <LiquidBackdrop className="-z-10 opacity-80" />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(72%_60%_at_50%_0%,color-mix(in_srgb,var(--kx-forest-200)_45%,transparent),transparent_70%)] dark:bg-[radial-gradient(72%_60%_at_50%_0%,color-mix(in_srgb,var(--kx-forest-500)_18%,transparent),transparent_70%)]"
            aria-hidden
          />

          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center lg:gap-10">
            <HeroCopy />
            <HeroMockup />
          </div>
        </section>

        {/* The people and gathering the network exists to serve */}
        <Section id="community" tone="subtle" className="overflow-hidden">
          <CommunityStory />
        </Section>

        {/* Trust */}
        <Section id="trust">
          <SectionHeader
            eyebrow="Verification"
            title={
              <>
                Verification isn&rsquo;t a badge.
                <br className="hidden sm:block" /> It&rsquo;s the foundation.
              </>
            }
            description="Every driver passes the same five checks before carrying a single member — whether they drive as a volunteer or professionally."
          />
          <TrustSequence />
        </Section>

        {/* Two tracks */}
        <Section id="tracks">
          <SectionHeader
            eyebrow="Two transportation tracks"
            title="One network. Two ways to travel."
            description="Both tracks share the same verification, the same live tracking and the same oversight. What differs is whether the journey is given or paid for."
          />
          <TrackCards />
        </Section>

        {/* Safety */}
        <Section id="safety" tone="dark">
          <SectionHeader
            eyebrow="Safety"
            title="Every journey stays visible."
            description="From the moment a driver is matched to the moment you arrive, the trip is on a map, shareable with someone you trust, and reachable by the safety team."
            tone="inverse"
          />
          <SafetyShowcase />

          <Reveal delay={0.18}>
            <div className="mt-8 flex flex-col gap-4 rounded-[var(--kx-radius-xl)] border border-white/10 bg-white/[0.055] p-5 sm:flex-row sm:items-center sm:p-6">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-gold-500 text-forest-950">
                <Activity className="size-5" strokeWidth={1.8} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="type-card-title text-white">Human oversight, when it matters.</p>
                <p className="type-meta mt-1 text-white/60">
                  The safety team can see active journeys, respond to alerts and
                  review unusual route activity without exposing unnecessary
                  member details.
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/8 px-3 py-2 text-[0.75rem] font-medium text-white/70 ring-1 ring-inset ring-white/10">
                <ShieldCheck className="size-3.5 text-gold-400" aria-hidden />
                Privacy-aware monitoring
              </span>
            </div>
          </Reveal>
        </Section>

        {/* Drivers */}
        <Section id="drivers">
          <SectionHeader
            eyebrow="For drivers"
            title="Already heading there? Take someone with you."
            description="Whether you drive in service or professionally, the application, the verification and the standard are the same."
          />
          <DriverPreview />

          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-wrap gap-3">
              <ButtonLink href="/driver/apply" variant="primary" size="lg" iconRight={ArrowRight}>
                Start an application
              </ButtonLink>
              <ButtonLink href="/#tracks" variant="secondary" size="lg">
                Compare the tracks
              </ButtonLink>
            </div>
          </Reveal>
        </Section>

        {/* Final CTA */}
        <Section id="get-started">
          <Reveal>
            <div className="kx-grain relative overflow-hidden rounded-[var(--kx-radius-2xl)] border border-line bg-gradient-to-br from-surface to-canvas-mist px-6 py-14 text-center sm:px-12 sm:py-20 dark:to-forest-900/40">
              <h2 className="type-display mx-auto max-w-3xl text-ink">
                Transportation built around trust.
              </h2>
              <p className="type-body-lg mx-auto mt-5 max-w-xl text-ink-secondary">
                Join the members already travelling together to and from
                ministry events.
              </p>

              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <ButtonLink href="/signup" variant="gold" size="xl" pill>
                  Request a Ride
                </ButtonLink>
                <ButtonLink href="/driver/apply" variant="secondary" size="xl" pill>
                  Become a Driver
                </ButtonLink>
              </div>
            </div>
          </Reveal>
        </Section>
      </main>

      <MarketingFooter />
    </>
  );
}
