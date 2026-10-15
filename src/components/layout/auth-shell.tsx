"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin, Pause, Play } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { ABUJA_SLIDES, AuthCarousel } from "@/components/layout/auth-carousel";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

export function AuthShell({ children, trustStatement, eyebrow }: { children: ReactNode; trustStatement?: string; eyebrow?: string }) {
  const [slide, setSlide] = useState(0);
  const [rotationPaused, setRotationPaused] = useState(false);
  const { prefersReduced } = useReducedMotionSafe();
  const place = ABUJA_SLIDES[slide];
  const selectSlide = (index: number) => { setRotationPaused(true); setSlide(index); };
  const step = (delta: number) => selectSlide((slide + delta + ABUJA_SLIDES.length) % ABUJA_SLIDES.length);

  return (
    <div className="auth-scene">
      <div className="auth-scene-background">
        <AuthCarousel index={slide} onIndexChange={setSlide} onSelect={selectSlide} paused={rotationPaused} />
        <div className="auth-scene-scrim" aria-hidden="true" />
      </div>
      <header className="auth-scene-header">
        <Link href="/login" aria-label="K-Rides sign in"><Brand inverse /></Link>
        <div className="flex items-center gap-2" role="group" aria-label="Background slideshow controls">
          <button type="button" onClick={() => step(-1)} aria-label="Previous photo"><ChevronLeft className="size-4" aria-hidden /></button>
          {!prefersReduced ? <button type="button" onClick={() => setRotationPaused((value) => !value)} aria-label={rotationPaused ? "Play artwork slideshow" : "Pause artwork slideshow"}>{rotationPaused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}</button> : null}
          <button type="button" onClick={() => step(1)} aria-label="Next photo"><ChevronRight className="size-4" aria-hidden /></button>
        </div>
      </header>
      <div className="auth-scene-content">
        <aside className="auth-scene-story" aria-label="The K-Rides journey">
          <p className="auth-scene-eyebrow">{eyebrow ?? "Made for your everyday"}</p>
          <p className="auth-scene-title">{trustStatement ?? "Good journeys start here."}</p>
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-white/85">From the first hello to the last mile. A more considered way to move.</p>
          <p className="mt-10 flex items-center gap-2 text-xs text-white/80"><MapPin className="size-4" aria-hidden />{place.place} · Abuja</p>
        </aside>
        <main id="main" className="auth-scene-main">
          <div className="auth-scene-form">{children}</div>
          <p className="mt-7 text-center text-xs text-white/80">K-Rides · Every journey matters.</p>
        </main>
      </div>
    </div>
  );
}
