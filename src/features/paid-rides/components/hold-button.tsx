"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { vibrate } from "../capabilities";

/**
 * Press-and-hold confirmation for serious actions (sending an SOS alert).
 * Deliberate enough that a pocket tap can't fire it, quick enough for an
 * emergency. Works with touch, mouse and keyboard (hold Space or Enter).
 */
export function HoldButton({
  holdMs,
  onConfirm,
  disabled,
  children,
  hint,
  className,
}: {
  holdMs: number;
  onConfirm: () => void;
  disabled?: boolean;
  children: ReactNode;
  hint: string;
  className?: string;
}) {
  const [progress, setProgress] = useState(0);
  const start = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const fired = useRef(false);
  const hintId = useId();

  const stop = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = null;
    start.current = null;
    if (!fired.current) setProgress(0);
  };

  const begin = () => {
    if (disabled || start.current !== null) return;
    fired.current = false;
    start.current = performance.now();
    vibrate(20);
    const step = (now: number) => {
      if (start.current === null) return;
      const value = Math.min(1, (now - start.current) / holdMs);
      setProgress(value);
      if (value >= 1) {
        fired.current = true;
        start.current = null;
        frame.current = null;
        vibrate([40, 60, 40]);
        onConfirm();
        return;
      }
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  };

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled}
        aria-describedby={hintId}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          begin();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !event.repeat) {
            event.preventDefault();
            begin();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") stop();
        }}
        onContextMenu={(event) => event.preventDefault()}
        className={cn(
          "relative h-16 w-full touch-none select-none overflow-hidden rounded-full bg-[var(--ride-sos)] text-[1.0625rem] font-semibold text-white shadow-[var(--ride-elev-5)] disabled:opacity-50",
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-[var(--ride-sos-pressed)]"
          style={{ width: `${progress * 100}%` }}
        />
        <span className="relative">{progress > 0 && progress < 1 ? `Keep holding… ${Math.ceil((1 - progress) * (holdMs / 1000))}` : children}</span>
      </button>
      <p id={hintId} className="ride-caption mt-2 text-center">
        {hint}
      </p>
    </div>
  );
}
