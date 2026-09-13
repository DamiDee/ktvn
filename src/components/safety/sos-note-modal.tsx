"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

/** Common situations, so a shaking hand doesn't have to type a sentence. */
const QUICK_NOTES = [
  "I feel unsafe",
  "The driver took a wrong turn",
  "There has been an accident",
  "Someone needs medical help",
  "The vehicle has broken down",
];

/**
 * The note that follows an SOS.
 *
 * The alert is already sent by the time this opens — nothing here holds it up.
 * This is the safety team asking what is happening so they can respond to the
 * right thing, and it can be skipped entirely.
 */
export function SosNoteModal({
  open,
  onClose,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (note: string) => void;
}) {
  const [note, setNote] = useState("");

  function close() {
    setNote("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="What's happening?"
      description="Your alert has already been sent. Adding a note helps the safety team respond to the right thing."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Skip
          </Button>
          <Button
            variant="danger"
            disabled={!note.trim()}
            onClick={() => {
              onSend(note.trim());
              setNote("");
            }}
          >
            Send note
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-[var(--kx-radius-md)] border border-sos-500/30 bg-sos-50 px-4 py-3 dark:bg-sos-500/12">
          <ShieldAlert
            className="mt-0.5 size-4 shrink-0 text-sos-600 dark:text-red-300"
            strokeWidth={2}
            aria-hidden
          />
          <p className="type-meta text-ink-secondary">
            The safety team can see your alert now. If you are in immediate
            danger, call your local emergency number as well.
          </p>
        </div>

        <div>
          <p className="type-micro mb-2 text-ink-muted">Quick notes</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_NOTES.map((quick) => {
              const selected = note === quick;
              return (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setNote(selected ? "" : quick)}
                  aria-pressed={selected}
                  className={cn(
                    "inline-flex h-10 items-center rounded-full border px-3.5 text-[0.8125rem] font-medium transition-colors",
                    selected
                      ? "border-sos-500 bg-sos-500 text-white"
                      : "border-line bg-surface text-ink-secondary hover:bg-surface-nested hover:text-ink",
                  )}
                >
                  {quick}
                </button>
              );
            })}
          </div>
        </div>

        <Textarea
          label="Your note"
          placeholder="Anything the team should know right now"
          rows={3}
          required
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </Modal>
  );
}
