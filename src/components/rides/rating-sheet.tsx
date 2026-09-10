"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Rating } from "@/components/ui/rating";
import { Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { shortName } from "@/lib/format";

const QUICK_NOTES = [
  "Punctual",
  "Careful driver",
  "Clean vehicle",
  "Friendly",
  "Knew the route",
];

/**
 * Two-way rating. The same sheet serves a passenger rating a driver and a
 * driver rating a passenger — only the copy changes.
 */
export function RatingSheet({
  open,
  onClose,
  subjectName,
  subjectAvatarUrl,
  onSubmit,
  role = "driver",
}: {
  open: boolean;
  onClose: () => void;
  subjectName: string;
  subjectAvatarUrl?: string;
  onSubmit?: (stars: number, comment: string) => void;
  role?: "driver" | "passenger";
}) {
  const { toast } = useToast();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const first = subjectName.split(" ")[0];

  function toggleNote(note: string) {
    setNotes((current) =>
      current.includes(note)
        ? current.filter((value) => value !== note)
        : [...current, note],
    );
  }

  async function submit() {
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 700));

    const fullComment = [notes.join(", "), comment]
      .filter(Boolean)
      .join(" — ");

    onSubmit?.(stars, fullComment);
    setSubmitting(false);
    setDone(true);
    toast({ title: "Thanks for the feedback", tone: "success" });

    window.setTimeout(() => {
      onClose();
      setDone(false);
    }, 1400);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        done
          ? "Thank you"
          : `How was your ${role === "driver" ? "ride" : "passenger"} with ${first}?`
      }
      description={
        done
          ? undefined
          : "Ratings are shared with the oversight team, never shown to the person you rated alongside your name."
      }
    >
      {done ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="inline-flex size-14 items-center justify-center rounded-full bg-success-500 text-white"
          >
            <Check className="size-7" strokeWidth={3} aria-hidden />
          </motion.span>
          <p className="type-body text-ink-secondary">
            Your rating has been recorded.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <Avatar
              name={subjectName}
              src={subjectAvatarUrl}
              size="xl"
              verified
            />
            <p className="type-card-title text-ink">
              {shortName(subjectName)}
            </p>

            <Rating
              value={stars}
              onChange={(value) => setStars(value)}
              size="lg"
              label={`Rate ${first}`}
            />

            {stars > 0 ? (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="type-meta text-ink-secondary"
              >
                {["", "Poor", "Fair", "Good", "Great", "Excellent"][stars]}
              </motion.p>
            ) : null}
          </div>

          {stars > 0 ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-4 overflow-hidden"
            >
              <div>
                <p className="type-micro mb-2.5 text-ink-muted">
                  Anything stand out?
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_NOTES.map((note) => {
                    const selected = notes.includes(note);
                    return (
                      <button
                        key={note}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleNote(note)}
                        className={cn(
                          // 40px tall so these are still comfortable to tap.
                          "inline-flex h-10 items-center rounded-full px-3.5 text-[0.8125rem] font-medium transition-colors",
                          selected
                            ? "bg-forest-800 text-white dark:bg-gold-500 dark:text-forest-950"
                            : "bg-surface-nested text-ink-secondary ring-1 ring-inset ring-line hover:text-ink",
                        )}
                      >
                        {note}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Textarea
                label="Anything else? (optional)"
                placeholder="Your comments go to the oversight team."
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
              />
            </motion.div>
          ) : null}

          <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
            <Button
              variant="primary"
              size="lg"
              className="sm:flex-1"
              disabled={stars === 0}
              loading={submitting}
              loadingLabel="Submitting"
              onClick={submit}
            >
              Submit rating
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="sm:flex-1"
              onClick={onClose}
              disabled={submitting}
            >
              Skip
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
