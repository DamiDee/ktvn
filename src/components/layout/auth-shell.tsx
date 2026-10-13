"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Brand } from "@/components/layout/brand";
import { ABUJA_SLIDES, AuthCarousel } from "@/components/layout/auth-carousel";

export function AuthShell({ children, trustStatement, eyebrow }: { children: ReactNode; trustStatement?: string; eyebrow?: string }) {
  const [slide, setSlide] = useState(0);
  const place = ABUJA_SLIDES[slide];
  const step = (delta: number) => setSlide((current) => (current + delta + ABUJA_SLIDES.length) % ABUJA_SLIDES.length);

  return (
    <div className="premium-auth">
      <aside className="premium-auth-visual" aria-label="The K-Rides journey">
        <AuthCarousel index={slide} onIndexChange={setSlide} />
        <div className="premium-auth-scrim" aria-hidden="true" />
        <div className="premium-auth-caption pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
          <Link href="/login" aria-label="K-Rides sign in" className="w-fit"><Brand inverse /></Link>
          <div>
            <div className="mb-5 hidden items-center gap-2 text-xs font-medium tracking-[.14em] text-white/85 uppercase lg:flex"><span className="size-1.5 rounded-full bg-[#b7ccff]" />{eyebrow ?? "Made for your everyday"}</div>
            <p className="premium-auth-title">{trustStatement ?? "Good journeys start here."}</p>
            <p className="mt-5 hidden max-w-xs text-sm leading-relaxed text-white/80 lg:block">From the first hello to the last mile. A more considered way to move.</p>
            <div className="mt-8 hidden items-center justify-between gap-4 border-t border-white/20 pt-5 text-xs text-white/80 lg:flex">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={place.place} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }} className="flex min-w-0 items-center gap-2" aria-live="polite">
                  <MapPin className="size-4 shrink-0" aria-hidden />
                  <span className="truncate"><span className="font-semibold text-white">{place.place}</span> · {place.line}</span>
                </motion.span>
              </AnimatePresence>
              <span className="flex shrink-0 gap-2">
                <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className="flex size-9 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-white/22"><ChevronLeft className="size-4" aria-hidden /></button>
                <button type="button" onClick={() => step(1)} aria-label="Next photo" className="flex size-9 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-white/22"><ChevronRight className="size-4" aria-hidden /></button>
              </span>
            </div>
          </div>
        </div>
      </aside>
      <main id="main" className="premium-auth-main">
        <div className="absolute top-3 right-3 lg:top-2"><ThemeToggle /></div>
        <div className="premium-auth-form">{children}</div>
        <p className="mt-10 text-center text-xs text-ink-muted">K-Rides · Every journey matters.</p>
      </main>
    </div>
  );
}
