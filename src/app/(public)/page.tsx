import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { HeroMockup } from "@/components/marketing/hero-mockup";
import { Section, SectionHeader, Reveal } from "@/components/marketing/section";
import { TrustSequence } from "@/components/marketing/trust-sequence";
import { TrackCards } from "@/components/marketing/track-cards";
import { SafetyShowcase } from "@/components/marketing/safety-showcase";
import { SharedRidesSection } from "@/components/marketing/shared-rides-section";
import { DriverPreview } from "@/components/marketing/driver-preview";
import { OversightPanel } from "@/components/marketing/oversight-panel";
import { HeroCopy } from "@/components/marketing/hero-copy";

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
        <section className="relative overflow-hidden px-4 pt-28 pb-16 sm:px-6 sm:pt-36 sm:pb-24">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(72%_60%_at_50%_0%,color-mix(in_srgb,var(--kx-forest-200)_45%,transparent),transparent_70%)] dark:bg-[radial-gradient(72%_60%_at_50%_0%,color-mix(in_srgb,var(--kx-forest-500)_18%,transparent),transparent_70%)]"
            aria-hidden
          />

          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center lg:gap-10">
            <HeroCopy />
            <HeroMockup />
          </div>
        </section>

        {/* Trust */}
        <Section id="trust" tone="subtle">
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
        </Section>

        {/* Shared rides */}
        <Section id="shared" tone="subtle">
          <SectionHeader
            eyebrow="Shared rides"
            title="Share the journey, not the uncertainty."
            description="Up to three passengers travel together along the same route. On the professional track the fare divides between whoever is riding."
          />
          <SharedRidesSection />
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

        {/* Oversight */}
        <Section id="oversight" tone="dark">
          <SectionHeader
            eyebrow="Oversight"
            title="Someone is always watching the network."
            description="The oversight team sees active journeys, the verification queue and any raised alert. Individual member details stay private."
            tone="inverse"
          />
          <OversightPanel />
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
