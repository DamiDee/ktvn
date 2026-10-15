"use client";

import { ThemeToggle } from "./theme-toggle";

export function AppearanceSettings() {
  return (
    <section aria-label="Appearance" className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <div>
        <h2 className="type-card-title text-ink">Appearance</h2>
        <p className="mt-1 text-sm text-ink-secondary">Light, system or dark. Make it yours.</p>
      </div>
      <ThemeToggle />
    </section>
  );
}
