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
    "Verified volunteer and professional rides for the Koinonia community.",
};

export default function LandingPage() {
  return (
    <>
      <MarketingHeader />

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pt-28 pb-16 sm:px-6 sm:pt-32 sm:pb-22">
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
            title="Verified before the first ride."
            description="Every driver completes five checks."
          />
          <TrustSequence />
        </Section>

        {/* Two tracks */}
        <Section id="tracks">
          <SectionHeader
            eyebrow="Two transportation tracks"
            title="One network. Two ways to travel."
            description="Choose a volunteer seat or a paid professional ride."
          />
          <TrackCards />
        </Section>

        {/* Safety */}
        <Section id="safety" tone="dark">
          <SectionHeader
            eyebrow="Safety"
            title="Every journey stays visible."
            description="Live tracking, trusted contacts and help when you need it."
            tone="inverse"
          />
          <SafetyShowcase />

          <Reveal delay={0.18}>
            <div className="mt-8 flex flex-col gap-4 rounded-[var(--kx-radius-xl)] border border-white/10 bg-white/[0.055] p-5 sm:flex-row sm:items-center sm:p-6">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-gold-500 text-forest-950">
                <Activity className="size-5" strokeWidth={1.8} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="type-card-title text-white">Human oversight for active alerts.</p>
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
            title="Drive with K-Rides."
            description="Volunteer your spare seats or drive professionally."
          />
          <DriverPreview />

          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-wrap gap-3">
              <ButtonLink href="/driver/apply" variant="primary" size="lg" iconRight={ArrowRight}>
                Apply to drive
              </ButtonLink>
              <ButtonLink href="/#tracks" variant="secondary" size="lg">
                Compare the tracks
              </ButtonLink>
            </div>
          </Reveal>
        </Section>

      </main>

      <MarketingFooter />
    </>
  );
}
