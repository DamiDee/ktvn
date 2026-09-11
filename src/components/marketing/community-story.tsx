"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { CarFront, HeartHandshake, ShieldCheck } from "lucide-react";
import { Reveal } from "./section";

const humanPromises = [
  {
    icon: HeartHandshake,
    title: "Known community",
  },
  {
    icon: ShieldCheck,
    title: "Verified people",
  },
  {
    icon: CarFront,
    title: "A calmer way home",
  },
];

export function CommunityStory() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)] lg:gap-16">
      <Reveal className="relative">
        <div className="absolute -inset-6 -z-10 rounded-[40%_60%_54%_46%/44%_38%_62%_56%] bg-gold-300/16 blur-2xl dark:bg-gold-400/8" />
        <motion.figure
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative aspect-[16/10] overflow-hidden rounded-[var(--kx-radius-2xl)] bg-forest-900 shadow-xl"
        >
          <Image
            src="/images/koinonia-community-gathering.jpg"
            alt="A large Koinonia congregation gathered together during a ministry service."
            fill
            sizes="(max-width: 1024px) 100vw, 58vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-950/62 via-transparent to-transparent" />
          <figcaption className="absolute right-5 bottom-5 left-5 flex items-end justify-between gap-4 text-white sm:right-7 sm:bottom-7 sm:left-7">
            <div>
              <p className="type-micro text-gold-300">The community behind every journey</p>
              <p className="mt-2 max-w-md text-[1rem] font-medium text-white/90">
                One gathering. Many routes home.
              </p>
            </div>
            <span className="hidden size-11 shrink-0 rounded-[68%_32%_62%_38%/72%_42%_58%_28%] border border-white/30 bg-white/12 backdrop-blur-md sm:block" />
          </figcaption>
        </motion.figure>
      </Reveal>

      <div>
        <Reveal>
          <p className="type-micro text-gold-700 dark:text-gold-400">Human by design</p>
          <h2 className="type-page-title mt-3 text-ink">
            People first, technology second.
          </h2>
          <p className="type-body mt-4 max-w-lg text-ink-secondary">
            K-Rides helps members leave gatherings with a clear pickup and an
            accountable person behind the wheel.
          </p>
        </Reveal>

        <div className="mt-6 flex flex-wrap gap-2.5">
          {humanPromises.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} delay={0.08 * index}>
                <div className="group inline-flex items-center gap-2.5 rounded-full border border-line bg-surface/80 py-2 pr-4 pl-2 shadow-xs transition-[transform,border-color] hover:-translate-y-px hover:border-line-strong">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-forest-100 text-forest-700 dark:bg-gold-400/12 dark:text-gold-300">
                    <Icon className="size-4" strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="type-meta font-medium text-ink">{item.title}</span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </div>
  );
}
