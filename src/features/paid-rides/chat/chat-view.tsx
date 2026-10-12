"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowLeft, ArrowUp, Check, CheckCheck, Clock3, Phone, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import type { RideMessage } from "../domain/types";
import { PersonAvatar } from "../components/ride-ui";

/**
 * Ride chat, iMessage-calm. Optimistic bubbles reconcile with the server by
 * client id; delivery and read receipts update in place; the list only
 * auto-scrolls when the reader is already at the bottom. The composer stays
 * above the on-screen keyboard (visualViewport) and the safe area.
 */

const MAX_LENGTH = 500;

export interface ChatViewProps {
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  backHref: string;
  callHref?: string;
  messages: RideMessage[];
  typing: boolean;
  available: boolean;
  unavailableReason?: string;
  quickReplies: string[];
  emptyHint: string;
  loading: boolean;
  onSend: (body: string) => void;
  onRetry: (message: RideMessage) => void;
  onViewed: () => void;
  onTyping?: (typing: boolean) => void;
}

/** Height of the visible viewport, which shrinks when the keyboard opens on iOS. */
function useVisualViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setHeight(viewport.height);
    update();
    viewport.addEventListener("resize", update);
    return () => viewport.removeEventListener("resize", update);
  }, []);
  return height;
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function ChatView(props: ChatViewProps) {
  const { messages, typing, onViewed } = props;
  const { prefersReduced } = useReducedMotionSafe();
  const viewportHeight = useVisualViewportHeight();
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const atBottom = useRef(true);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draft, setDraft] = useState("");
  const [showJump, setShowJump] = useState(false);
  const lastIncoming = [...messages].reverse().find((message) => message.from === "them");

  // Reading the conversation clears the unread badge.
  useEffect(() => {
    onViewed();
  }, [onViewed, lastIncoming?.id]);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    if (atBottom.current) {
      element.scrollTo({ top: element.scrollHeight, behavior: prefersReduced ? "auto" : "smooth" });
    } else {
      setShowJump(true);
    }
  }, [messages.length, typing, prefersReduced]);

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, []);

  function onScroll() {
    const element = scroller.current;
    if (!element) return;
    atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
    if (atBottom.current) setShowJump(false);
  }

  function send(body: string) {
    const text = body.trim();
    if (!text || !props.available) return;
    atBottom.current = true;
    props.onSend(text);
    setDraft("");
    props.onTyping?.(false);
    input.current?.focus();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    send(draft);
  }

  function onDraftChange(value: string) {
    setDraft(value.slice(0, MAX_LENGTH));
    if (!props.onTyping) return;
    props.onTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => props.onTyping?.(false), 2500);
  }

  return (
    <div className="absolute inset-x-0 top-0 z-40 flex flex-col bg-[var(--kx-bg)] lg:inset-y-4 lg:left-auto lg:right-auto lg:mx-auto lg:w-[34rem] lg:rounded-[var(--ride-radius-xl)] lg:shadow-[var(--ride-elev-4)]" style={{ height: viewportHeight ? `${viewportHeight}px` : "100dvh" }}>
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-glass)] px-3 pb-3 backdrop-blur-xl lg:rounded-t-[var(--ride-radius-xl)]" style={{ paddingTop: "calc(var(--ride-safe-top) + 10px)" }}>
        <Link href={props.backHref} aria-label="Back to trip" className="ride-press flex size-11 items-center justify-center rounded-full hover:bg-[var(--surface-secondary)]">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <PersonAvatar name={props.title} src={props.avatarUrl} size={38} />
        <div className="min-w-0 flex-1">
          <h1 className="ride-heading-md truncate">{props.title}</h1>
          <p className="ride-caption truncate" aria-live="polite">
            {typing ? "typing…" : props.subtitle}
          </p>
        </div>
        {props.callHref ? (
          <a href={props.callHref} aria-label={`Call ${props.title}`} className="ride-press flex size-11 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
            <Phone className="size-[1.1rem]" aria-hidden />
          </a>
        ) : null}
      </header>

      <div ref={scroller} onScroll={onScroll} className="kx-scroll-thin relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4" role="log" aria-label="Messages" aria-live="polite">
        {props.loading ? (
          <div className="space-y-3" aria-hidden>
            <div className="kx-skeleton h-10 w-48 !rounded-[18px]" />
            <div className="kx-skeleton ml-auto h-10 w-40 !rounded-[18px]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="mx-auto mt-10 max-w-xs text-center">
            <p className="ride-body font-semibold">No messages yet</p>
            <p className="ride-body-sm mt-1 text-[var(--text-secondary)]">{props.emptyHint}</p>
          </div>
        ) : (
          <ol className="space-y-1.5">
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const newDay = !previous || dayLabel(previous.sentAt) !== dayLabel(message.sentAt);
              const mine = message.from === "me";
              const grouped = previous && previous.from === message.from && !newDay && Date.parse(message.sentAt) - Date.parse(previous.sentAt) < 120_000;
              return (
                <li key={message.clientId ?? message.id}>
                  {newDay ? <p className="ride-caption my-3 text-center font-semibold">{dayLabel(message.sentAt)}</p> : null}
                  <motion.div
                    initial={prefersReduced ? false : { opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className={cn("flex flex-col", mine ? "items-end" : "items-start", !grouped && index > 0 && "mt-3")}
                  >
                    <div
                      className={cn(
                        "max-w-[78%] px-3.5 py-2 text-[0.9375rem] leading-[1.4] break-words whitespace-pre-wrap",
                        mine
                          ? "rounded-[20px] rounded-br-[6px] bg-[var(--ride-primary)] text-[var(--ride-on-primary)]"
                          : "rounded-[20px] rounded-bl-[6px] bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-[var(--kx-shadow-xs)]",
                        message.status === "failed" && "opacity-60",
                      )}
                    >
                      {message.body}
                    </div>
                    <p className="ride-caption mt-0.5 flex items-center gap-1 px-1">
                      <span className="ride-num">{timeLabel(message.sentAt)}</span>
                      {mine ? <DeliveryState message={message} onRetry={() => props.onRetry(message)} /> : null}
                    </p>
                  </motion.div>
                </li>
              );
            })}
          </ol>
        )}
        <AnimatePresence>
          {typing ? (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 inline-flex gap-1 rounded-[20px] rounded-bl-[6px] bg-[var(--surface-primary)] px-4 py-3" aria-label={`${props.title} is typing`}>
              {[0, 1, 2].map((dot) => (
                <span key={dot} className="ride-typing-dot size-2 rounded-full bg-[var(--text-tertiary)]" style={{ animationDelay: `${dot * 0.15}s` }} />
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {showJump ? (
        <button
          type="button"
          onClick={() => {
            atBottom.current = true;
            setShowJump(false);
            scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
          }}
          className="ride-press absolute left-1/2 z-10 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full bg-[var(--surface-primary)] px-3.5 text-[0.8125rem] font-semibold shadow-[var(--ride-elev-2)]"
          style={{ bottom: 140 }}
        >
          <ArrowDown className="size-4" aria-hidden /> New messages
        </button>
      ) : null}

      <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-primary)] px-3 pt-2 lg:rounded-b-[var(--ride-radius-xl)]" style={{ paddingBottom: "calc(var(--ride-safe-bottom) + 6px)" }}>
        {props.available ? (
          <>
            {props.quickReplies.length ? (
              <div className="kx-no-scrollbar -mx-3 mb-2 flex gap-2 overflow-x-auto px-3" role="group" aria-label="Quick replies">
                {props.quickReplies.map((reply) => (
                  <button key={reply} type="button" onClick={() => send(reply)} className="ride-press h-9 shrink-0 rounded-full border border-[var(--border-subtle)] px-3.5 text-[0.8125rem] font-medium">
                    {reply}
                  </button>
                ))}
              </div>
            ) : null}
            <form onSubmit={onSubmit} className="flex items-end gap-2">
              <label className="sr-only" htmlFor="ride-chat-input">
                Message
              </label>
              <textarea
                id="ride-chat-input"
                ref={input}
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send(draft);
                  }
                }}
                rows={1}
                placeholder="Message"
                enterKeyHint="send"
                className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-[var(--border-strong)] bg-[var(--surface-secondary)] px-4 py-2.5 text-[1rem] leading-[1.4] focus:border-[var(--ride-primary)] focus:outline-none"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Send message"
                className="ride-press flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--ride-primary)] text-[var(--ride-on-primary)] disabled:opacity-40"
              >
                <ArrowUp className="size-5" strokeWidth={2.4} aria-hidden />
              </button>
            </form>
            {draft.length > MAX_LENGTH - 60 ? (
              <p className="ride-caption ride-num mt-1 text-right">
                {draft.length}/{MAX_LENGTH}
              </p>
            ) : null}
          </>
        ) : (
          <p className="ride-body-sm py-3 text-center text-[var(--text-secondary)]">{props.unavailableReason ?? "Chat is closed for this ride."}</p>
        )}
      </div>
    </div>
  );
}

function DeliveryState({ message, onRetry }: { message: RideMessage; onRetry: () => void }) {
  switch (message.status) {
    case "sending":
      return <Clock3 className="size-3" aria-label="Sending" />;
    case "sent":
      return <Check className="size-3.5" aria-label="Sent" />;
    case "delivered":
      return <CheckCheck className="size-3.5" aria-label="Delivered" />;
    case "read":
      return <CheckCheck className="size-3.5 text-[var(--ride-info)]" aria-label="Read" />;
    case "failed":
      return (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-semibold text-[var(--ride-danger)]">
          <RotateCcw className="size-3" aria-hidden /> Not sent · Retry
        </button>
      );
  }
}
