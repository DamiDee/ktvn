"use client";

import { Check, Heart, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import styles from "./boarded-celebration.module.css";

/** Decorative confirmation, never a representation of the bus's live position. */
export function BoardedCelebration({ completed = false }: { completed?: boolean }) {
  return <section className={cn(styles.confirmation, !completed && styles.animate)} aria-label="Boarding confirmation">
    <div className="relative z-10 px-5 pt-6 sm:px-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-gold-300/30 bg-gold-300/10 px-3 py-1.5 text-xs font-medium text-gold-200"><ShieldCheck className="size-3.5" aria-hidden />Boarding confirmed</div>
      <div role="status" aria-live="polite" className="mt-4">
        <h2 className="text-[1.8rem] font-semibold leading-tight tracking-tight text-white sm:text-[2.15rem]">{completed ? "A journey shared." : "You’re on board."}</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/70">{completed ? "Thank you for travelling with the community. See you on the next one." : "Your pass is checked. Settle in, breathe easy, and enjoy the company."}</p>
      </div>
    </div>

    <div className={styles.scene} aria-hidden="true">
      <svg viewBox="0 0 480 176" className="block h-auto w-full" fill="none">
        <circle cx="352" cy="50" r="28" fill="#E9C45C" opacity=".12" />
        <circle cx="352" cy="50" r="17" fill="#E9C45C" opacity=".22" />
        <path d="M0 119C59 78 94 76 139 107C183 138 239 83 297 101C355 119 398 86 480 104V155H0Z" fill="#24433A" />
        <path d="M0 138C100 101 145 127 229 132C310 137 370 107 480 133V164H0Z" fill="#315347" />
        <path d="M51 122V90L61 80L71 90V122M378 118V85H402V120M407 122V96H424V128" stroke="#E9C45C" strokeOpacity=".17" strokeWidth="2" />
        <path d="M0 151H480" stroke="#8CA095" strokeOpacity=".35" />
        <path className={styles.road} d="M-72 166H552" stroke="#E9C45C" strokeOpacity=".45" strokeWidth="2" strokeDasharray="25 35" />
        <g className={styles.bus}>
          <ellipse cx="241" cy="148" rx="115" ry="6" fill="#000" opacity=".24" />
          <path d="M142 67C142 61 147 56 153 56H298C312 56 322 65 328 80L339 108V132C339 137 335 140 330 140H143C137 140 133 136 133 130V78C133 72 137 67 142 67Z" fill="#E0AD28" />
          <path d="M145 68H300C308 68 314 73 317 82L325 105H145V68Z" fill="#173632" />
          <path d="M190 68V105M227 68V105M264 68V105M300 68V105" stroke="#E0AD28" strokeWidth="5" />
          <path d="M151 74H179L151 98V74ZM233 74H254L233 94V74Z" fill="#FFF" opacity=".13" />
          <path d="M133 115H339V130H133Z" fill="#F2DA95" />
          <path d="M300 110V138M318 110V138" stroke="#173632" strokeOpacity=".35" strokeWidth="2" />
          <rect x="334" y="112" width="7" height="7" rx="2" fill="#FFF8DA" />
          <rect x="131" y="112" width="5" height="8" rx="2" fill="#BD573B" />
          <text x="222" y="125" textAnchor="middle" fontSize="9" letterSpacing="2" fontWeight="700" fill="#173632">K-RIDES</text>
          {[170, 295].map((cx) => <g key={cx}><circle cx={cx} cy="140" r="13" fill="#091D18" /><circle cx={cx} cy="140" r="7" fill="#CECEC0" /><g className={styles.wheel}><path d={`M${cx - 5} 140H${cx + 5}M${cx} 135V145`} stroke="#173632" strokeWidth="2" /></g></g>)}
          <rect x="331" y="91" width="9" height="4" rx="2" fill="#F2DA95" />
        </g>
      </svg>
      <span className={styles.check}><Check className="size-5" strokeWidth={3} /></span>
    </div>
    <div className="relative z-10 flex items-center justify-center gap-2 border-t border-white/10 px-4 py-3.5 text-xs text-gold-100/80"><Heart className="size-3.5" aria-hidden />A free ride. A little more together.</div>
    <p className="sr-only">Your QR pass has been used. The bus illustration is not live tracking.</p>
  </section>;
}
