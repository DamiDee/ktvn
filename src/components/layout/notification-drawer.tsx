"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  CreditCard,
  HandHeart,
  Route,
  ShieldAlert,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { backdropVariants } from "@/lib/motion";
import { formatRelativeTime } from "@/lib/format";
import { queryKeys } from "@/constants/query-keys";
import { userService } from "@/services";
import { NotificationCategory } from "@/types/enums";
import type { Notification } from "@/types/models";
import { IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { useSessionStore } from "@/stores/session-store";
import { useFreeBuses } from "@/features/free-buses/use-free-buses";

const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  [NotificationCategory.RIDE]: Route,
  [NotificationCategory.VERIFICATION]: ShieldCheck,
  [NotificationCategory.PAYMENT]: CreditCard,
  [NotificationCategory.SAFETY]: ShieldAlert,
  [NotificationCategory.SERVICE]: HandHeart,
};

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  [NotificationCategory.RIDE]: "Ride",
  [NotificationCategory.VERIFICATION]: "Verification",
  [NotificationCategory.PAYMENT]: "Payment",
  [NotificationCategory.SAFETY]: "Safety",
  [NotificationCategory.SERVICE]: "Service",
};

type Filter = "ALL" | NotificationCategory;

/** Bus broadcasts share the existing inbox, and are never shown to drivers. */
function useNotificationFeed() {
  const role = useSessionStore((state) => state.role);
  const pathname = usePathname();
  const eligible = role !== "DRIVER" && !pathname.startsWith("/driver");
  const buses = useFreeBuses(eligible);
  const base = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => userService.listNotifications(),
  });
  const data = useMemo<Notification[]>(() => [
    ...(eligible ? buses.data?.notices ?? [] : []).map((notice): Notification => ({
      id: notice.id,
      category: NotificationCategory.SERVICE,
      title: notice.title,
      body: notice.body,
      createdAt: notice.createdAt,
      read: false,
      priority: "HIGH",
      href: role === "ADMIN" ? "/admin/free-buses" : "/passenger/free-buses",
    })),
    ...(base.data ?? []),
  ], [base.data, buses.data?.notices, eligible, role]);
  return { data, isLoading: base.isLoading };
}

/** Notification bell with an unread dot. */
export function NotificationBell({ tone = "inverse" }: { tone?: "inverse" | "default" }) {
  const toggle = useSessionStore((state) => state.toggleNotifications);
  const { data } = useNotificationFeed();

  const unread = data?.filter((item) => !item.read).length ?? 0;
  const hasCritical = data?.some(
    (item) => !item.read && item.priority === "CRITICAL",
  );

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
      }
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-full transition-colors",
        tone === "inverse"
          ? "text-white/70 hover:bg-white/10 hover:text-white"
          : "text-ink-secondary hover:bg-[color-mix(in_srgb,var(--kx-text)_7%,transparent)] hover:text-ink",
      )}
    >
      <motion.span
        // Only new important notifications move the bell at all.
        animate={unread > 0 ? { rotate: [0, -8, 7, -4, 0] } : { rotate: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <Bell className="size-[1.15rem]" strokeWidth={1.8} aria-hidden />
      </motion.span>

      {unread > 0 ? (
        <span
          className={cn(
            "absolute top-2 right-2.5 size-2 rounded-full ring-2",
            hasCritical ? "bg-sos-500" : "bg-gold-500",
            tone === "inverse" ? "ring-forest-800" : "ring-surface",
          )}
          aria-hidden
        />
      ) : null}
    </button>
  );
}

export function NotificationDrawer() {
  const open = useSessionStore((state) => state.notificationsOpen);
  const close = useSessionStore((state) => state.closeNotifications);
  const [filter, setFilter] = useState<Filter>("ALL");

  const { data, isLoading } = useNotificationFeed();

  const sorted = useMemo(() => {
    if (!data) return [];
    // SOS and other critical notices override the normal ordering.
    const weight = (item: Notification) =>
      item.priority === "CRITICAL" ? 0 : item.priority === "HIGH" ? 1 : 2;

    return [...data].sort((a, b) => {
      const byPriority = weight(a) - weight(b);
      if (byPriority !== 0) return byPriority;
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, [data]);

  const filtered =
    filter === "ALL"
      ? sorted
      : sorted.filter((item) => item.category === filter);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          <motion.div
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={close}
            className="absolute inset-0 bg-[var(--kx-overlay)] backdrop-blur-[4px]"
            aria-hidden
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <h2 className="type-section-title text-ink">Notifications</h2>
              <IconButton icon={X} label="Close notifications" size="sm" onClick={close} />
            </div>

            <div className="px-5 pb-3">
              <Tabs
                variant="pill"
                label="Notification categories"
                value={filter}
                onChange={setFilter}
                items={[
                  { value: "ALL" as Filter, label: "All" },
                  ...Object.values(NotificationCategory).map((category) => ({
                    value: category as Filter,
                    label: CATEGORY_LABEL[category],
                  })),
                ]}
              />
            </div>

            <div className="kx-scroll-thin flex-1 overflow-y-auto px-5 pb-6">
              {isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="flex gap-3 py-3">
                      <Skeleton className="size-9 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-40 rounded-full" />
                        <Skeleton className="h-3 w-full rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  size="sm"
                  title="Nothing here yet."
                  description="Ride updates, verification news and safety notices will appear here."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {filtered.map((item) => (
                    <NotificationRow key={item.id} notification={item} onNavigate={close} />
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function NotificationRow({
  notification,
  onNavigate,
}: {
  notification: Notification;
  onNavigate: () => void;
}) {
  const Icon = CATEGORY_ICON[notification.category];
  const critical = notification.priority === "CRITICAL";

  const content = (
    <div className="flex gap-3 py-4">
      <span
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
          critical
            ? "bg-sos-50 text-sos-600 dark:bg-sos-500/16 dark:text-red-200"
            : "bg-surface-nested text-ink-secondary",
        )}
      >
        <Icon className="size-4" strokeWidth={1.8} aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.9375rem] font-medium text-ink">
            {notification.title}
          </p>
          {!notification.read ? (
            <span
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                critical ? "bg-sos-500" : "bg-gold-500",
              )}
              aria-label="Unread"
            />
          ) : null}
        </div>
        <p className="type-meta mt-1 text-ink-secondary">{notification.body}</p>
        <p className="type-meta mt-1.5 text-ink-muted">
          {CATEGORY_LABEL[notification.category]} ·{" "}
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>
    </div>
  );

  if (notification.href) {
    return (
      <li>
        <Link
          href={notification.href}
          onClick={onNavigate}
          className="-mx-2 block rounded-[var(--kx-radius-md)] px-2 transition-colors hover:bg-surface-nested"
        >
          {content}
        </Link>
      </li>
    );
  }

  return <li>{content}</li>;
}
