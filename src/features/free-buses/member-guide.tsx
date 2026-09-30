"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ArrowRight, BusFront, Ticket, MapPin, UserRound, HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

const steps = [
  { title: "Choose where you’re going", icon: BusFront, text: "Open Find a bus. Choose To church or To home, then your pickup or drop-off point. Check the date, departure time and available seats before continuing.", href: "/passenger/free-buses", action: "Find a bus" },
  { title: "Confirm your free seat", icon: Ticket, text: "Tap Book a free seat, review the journey and confirm. Your seat and bus are confirmed only after the server returns your boarding pass. If your connection drops, check Passes before trying again.", href: "/passenger/free-buses/passes", action: "Check my passes" },
  { title: "Meet your bus", icon: MapPin, text: "Your ticket shows the bus registration, seat, departure time in Abuja time, and all published route stops. Check the boarding point and landmark. Show the signed QR code to the coordinator; the pass changes when boarding is confirmed.", href: "/passenger/free-buses/passes", action: "View boarding passes" },
  { title: "Plan your journey home", icon: HandHeart, text: "For now, book your return separately under To home. The same-bus round-trip checkbox is a device-only preference, not a return reservation. Child-seat booking is not connected yet; ask the boarding team for assistance.", href: "/passenger/free-buses", action: "Find a journey home" },
  { title: "You’re in control", icon: UserRound, text: "Use Profile for your account details, My journeys for history, and Ask for a route when no suitable departure is available. A route request is not a seat booking. Release a confirmed seat you no longer need so another member can travel.", href: "/passenger/profile", action: "Open my profile" },
] as const;

export function MemberGuide({ userId, pathname }: { userId: string; pathname: string }) {
  const router = useRouter();
  const storageKey = `kr-member-guide:v1:${userId}`;
  const [welcome, setWelcome] = useState(() => { try { return window.localStorage.getItem(storageKey) !== "seen"; } catch { return true; } });
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const current = steps[step];
  const Icon = current.icon;
  function dismiss() { setWelcome(false); try { window.localStorage.setItem(storageKey, "seen"); } catch { /* Help remains available if storage is blocked. */ } }
  const tip = pathname.includes("passes") ? "Your pass carries your seat, bus, route stops and signed QR code." : pathname.includes("requests") ? "Requesting a route does not reserve a seat. Book once a departure is published." : pathname.includes("profile") ? "These are the details on your member account." : "Choose a journey, confirm a free seat, then show your boarding pass.";
  return <div className="mx-auto mb-5 max-w-3xl print:hidden">
    {welcome ? <section className="rounded-2xl border border-gold-500/25 bg-gold-500/5 p-4"><h2 className="text-sm font-semibold text-ink">New to K-Rides? Let’s get you there.</h2><p className="mt-1 text-sm text-ink-secondary">A short walkthrough, from your first booking to boarding.</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" icon={BookOpen} onClick={() => { setStep(0); setOpen(true); }}>Take the walkthrough</Button><Button size="sm" variant="ghost" onClick={dismiss}>Maybe later</Button></div></section> : <div className="flex flex-wrap items-center justify-between gap-2"><p className="max-w-md text-xs text-ink-secondary">{tip}</p><Button size="sm" variant="ghost" icon={BookOpen} onClick={() => { setStep(0); setOpen(true); }}>How to use K-Rides</Button></div>}
    <Modal open={open} onClose={() => setOpen(false)} title="Your K-Rides guide" description={`Step ${step + 1} of ${steps.length}`} footer={<><Button variant="ghost" disabled={step === 0} onClick={() => setStep((n) => n - 1)}>Back</Button><Button iconRight={ArrowRight} onClick={() => { if (step === steps.length - 1) { dismiss(); setOpen(false); } else setStep((n) => n + 1); }}>{step === steps.length - 1 ? "Got it" : "Next"}</Button></>}>
      <div className="flex gap-1.5" aria-hidden>{steps.map((_, index) => <span key={index} className={`h-1 flex-1 rounded-full ${index <= step ? "bg-gold-500" : "bg-line"}`} />)}</div>
      <div className="mt-6" aria-live="polite"><Icon className="mb-4 size-8 text-gold-700 dark:text-gold-300" aria-hidden /><h3 className="text-xl font-semibold text-ink">{current.title}</h3><p className="mt-3 text-sm leading-relaxed text-ink-secondary">{current.text}</p><Button size="sm" variant="secondary" className="mt-5" onClick={() => { dismiss(); setOpen(false); router.push(current.href); }}>{current.action}</Button></div>
    </Modal>
  </div>;
}
