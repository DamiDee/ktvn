import Link from "next/link";
import { ArrowRight, CarFront, UserRound } from "lucide-react";

export function RegistrationChoice() {
  return <div>
    <p className="type-micro mb-3 text-ink-muted">Join K-Rides</p>
    <h1 className="type-page-title text-ink">How would you like to join?</h1>
    <p className="type-body mt-3 text-ink-secondary">Choose what you want to do. We’ll take you to the right registration form.</p>
    <div className="mt-8 space-y-4">
      <Link href="/signup?role=passenger" className="group flex min-h-32 items-center gap-4 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-gold-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-500">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-forest-100 text-forest-800 dark:bg-forest-700/25 dark:text-forest-200"><UserRound className="size-6" aria-hidden /></span>
        <span className="min-w-0 flex-1"><span className="block text-lg font-semibold text-ink">Passenger</span><span className="mt-1 block text-sm leading-relaxed text-ink-secondary">Book paid rides or reserve a Freebus seat.</span></span>
        <ArrowRight className="size-5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>
      <Link href="/driver/apply" className="group flex min-h-32 items-center gap-4 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-gold-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-500">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold-100 text-gold-800 dark:bg-gold-500/15 dark:text-gold-300"><CarFront className="size-6" aria-hidden /></span>
        <span className="min-w-0 flex-1"><span className="block text-lg font-semibold text-ink">Driver</span><span className="mt-1 block text-sm leading-relaxed text-ink-secondary">Apply to drive with your personal, licence, and vehicle details.</span></span>
        <ArrowRight className="size-5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>
    </div>
    <p className="type-meta mt-7 text-center text-ink-secondary">Already registered? <Link href="/login" className="font-medium text-forest-700 underline underline-offset-4 dark:text-gold-300">Sign in</Link></p>
  </div>;
}
