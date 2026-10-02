"use client";
import { useState, type ReactNode } from "react";
import { BookOpen, ArrowRight, BusFront, Ticket, MapPin, UserRound, HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useMounted } from "@/hooks/use-media-query";
import { guideKey, parseGuideProgress, type GuideProgress } from "@/lib/member-guide";

const steps = [
  { title: "Choose a scheduled journey", icon: BusFront, text: "Open Find a bus. Choose To church or To home, then check the travel day, Abuja departure time and seats. Trip requests also use published schedules only; you can request ahead of the travel day." },
  { title: "Choose your stops and seats", icon: MapPin, text: "Select both your pickup point and drop-off before booking. Intermediate stops appear when your route has them. Include children who need seats, then review the journey before confirming." },
  { title: "Keep both passes for a round trip", icon: HandHeart, text: "If a return time is scheduled, select Include my return journey. Open Passes after booking and check for two separate tickets: To church and To home. If either is missing, ask the team before booking again. One QR code is not two passes." },
  { title: "Meet your bus", icon: Ticket, text: "Your pass shows your bus registration, seat, chosen boarding point, destination and stops. Show the correct journey’s QR code to the coordinator. Your pass changes when boarding is confirmed. If a booking loses connection, check Passes before retrying." },
  { title: "You’re ready to travel", icon: UserRound, text: "A trip request is not a seat reservation. Only a confirmed pass secures your seat. Release a seat you no longer need so someone else can travel. Use Profile for account details and My journeys for history. You can reopen this guide at any time." },
] as const;

type Props = { userId: string; pathname: string; children: ReactNode };
export function MemberGuide(props: Props) {
  const mounted = useMounted();
  // No member action is mounted until the completion check has finished.
  return mounted ? <GuideSession {...props} /> : <p role="status">Preparing your K-Rides guide…</p>;
}

function GuideSession({ userId, pathname, children }: Props) {
  const [progress, setProgress] = useState(() => {
    try { return parseGuideProgress(window.localStorage.getItem(guideKey(userId))); }
    catch { return parseGuideProgress(null); }
  });
  const [review, setReview] = useState(false);
  const [step, setStep] = useState(progress.step);
  const [acknowledged, setAcknowledged] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const required = !progress.completed_at;
  const open = required || review;
  const current = steps[step];
  const Icon = current.icon;

  function save(next: GuideProgress) {
    setProgress(next);
    try { window.localStorage.setItem(guideKey(userId), JSON.stringify(next)); }
    catch { setStorageWarning(true); }
  }
  function advance() {
    if (step < steps.length - 1) {
      setStep(step + 1);
      if (required) save({ ...progress, step: step + 1 });
    } else if (acknowledged || !required) {
      if (required) save({ ...progress, step, completed_at: new Date().toISOString() });
      setReview(false);
    }
  }
  const tip = pathname.includes("passes") ? "Show the correct outbound or return pass at boarding." : pathname.includes("requests") ? "Choose a scheduled departure. A request is not a reservation." : "Choose a journey, select your stops, then show your boarding pass.";
  return <>
    <div className="mx-auto mb-5 max-w-3xl print:hidden">
      {required ? <section className="rounded-2xl border border-gold-500/30 bg-gold-500/10 p-5"><h1 className="text-lg font-semibold text-ink">Welcome aboard. Start with your guide.</h1><p className="mt-2 text-sm text-ink-secondary">Complete all five steps to unlock bookings and your member pages.</p></section> : <div className="flex flex-wrap items-center justify-between gap-2"><p className="max-w-md text-xs text-ink-secondary">{tip}</p><Button size="sm" variant="ghost" icon={BookOpen} onClick={() => { setStep(0); setReview(true); }}>How to use K-Rides</Button></div>}
      {storageWarning ? <p role="status" className="mt-2 text-xs text-ink-secondary">This browser could not save your guide progress. You can continue, but may need to repeat it after reloading.</p> : null}
    </div>
    {!required ? children : null}
    <Modal open={open} dismissible={!required} onClose={() => { if (!required) setReview(false); }} title={required ? "Welcome to K-Rides" : "Your K-Rides guide"} description={`Step ${step + 1} of ${steps.length}${required ? " · Required before your first journey" : ""}`} footer={<><Button variant="ghost" disabled={step === 0} onClick={() => setStep((n) => n - 1)}>Back</Button><Button iconRight={ArrowRight} disabled={required && step === steps.length - 1 && !acknowledged} onClick={advance}>{step === steps.length - 1 ? required ? "Complete guide & continue" : "Done" : "Next"}</Button></>}>
      <div className="flex gap-1.5" aria-hidden>{steps.map((_, index) => <span key={index} className={`h-1 flex-1 rounded-full ${index <= step ? "bg-gold-500" : "bg-line"}`} />)}</div>
      <div className="mt-6" aria-live="polite"><Icon className="mb-4 size-8 text-gold-700 dark:text-gold-300" aria-hidden /><h3 className="text-xl font-semibold text-ink">{current.title}</h3><p className="mt-3 text-sm leading-relaxed text-ink-secondary">{current.text}</p></div>
      {required && step === steps.length - 1 ? <div className="mt-5"><Checkbox label="I understand how to book and use my boarding passes" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /></div> : null}
    </Modal>
  </>;
}
