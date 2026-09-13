import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { KoinoniaMark } from "@/components/ui/route-loader";
import { RouteMedallion } from "@/components/ui/route-medallion";

export default function NotFound() {
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center"
    >
      <Link
        href="/"
        className="kx-tap mb-10 inline-flex items-center gap-2.5"
        aria-label="Koinonia VTN — home"
      >
        <KoinoniaMark className="size-6 text-forest-800 dark:text-gold-400" />
        <span className="text-[0.9375rem] font-semibold tracking-[-0.02em] text-ink">
          Koinonia
          <span className="ml-1.5 font-normal text-ink-muted">VTN</span>
        </span>
      </Link>

      <RouteMedallion icon={Compass} />

      <h1 className="type-page-title mt-6 text-ink">
        This part of the journey isn&rsquo;t here.
      </h1>
      <p className="type-body-lg mx-auto mt-3 max-w-md text-ink-secondary">
        The page you&rsquo;re looking for doesn&rsquo;t exist yet, or the link
        has changed. Head back and pick up from somewhere familiar.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/" variant="primary" size="lg" pill icon={ArrowLeft}>
          Back to home
        </ButtonLink>
        <ButtonLink href="/passenger/rides" variant="secondary" size="lg" pill>
          Go to your dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
