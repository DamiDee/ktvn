"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BusFront,
  UserRound,
  Ticket,
  LayoutDashboard,
  Route,
  MapPin,
  ScanLine,
  History,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { PageLoader } from "@/components/ui/route-loader";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { liveAuth, FreebusError } from "@/services/freebus-api";
import { isOversight } from "@/lib/freebus-contract";
import type { ApiUser } from "@/types/freebus-api";

// ─── Session context ──────────────────────────────────────────────────────────

const SessionContext = createContext<ApiUser | null>(null);
export function useLiveUser() {
  const user = useContext(SessionContext);
  if (!user) throw new Error("Free Buses requires an authenticated session.");
  return user;
}

// ─── Navigation definitions ───────────────────────────────────────────────────

const ADMIN_NAV = [
  { href: "/admin/free-buses",          label: "Overview",  icon: LayoutDashboard },
  { href: "/admin/free-buses/buses",    label: "Buses",     icon: BusFront },
  { href: "/admin/free-buses/routes",   label: "Routes",    icon: Route },
  { href: "/admin/free-buses/points",   label: "Points",    icon: MapPin },
  { href: "/admin/free-buses/boarding", label: "Boarding",  icon: ScanLine },
  { href: "/admin/free-buses/activity", label: "Activity",  icon: History },
];

const MEMBER_NAV = [
  { href: "/passenger/free-buses",       label: "Find a Bus",     icon: BusFront },
  { href: "/passenger/free-buses/passes", label: "Boarding Passes", icon: Ticket },
  { href: "/passenger/profile",          label: "Profile",         icon: UserRound },
];

// ─── Admin sidebar ────────────────────────────────────────────────────────────

function AdminSidebar({
  user,
  pathname,
  onSignOut,
  signingOut,
}: {
  user: ApiUser;
  pathname: string;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavLink = ({ href, label, icon: Icon }: (typeof ADMIN_NAV)[0]) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-[var(--kx-radius-md)] px-3 py-2.5 text-sm font-medium transition-all duration-150",
          active
            ? "bg-forest-800 text-white shadow-md dark:bg-gold-400 dark:text-forest-950"
            : "text-ink-secondary hover:bg-surface-nested hover:text-ink",
        )}
      >
        <Icon
          className={cn(
            "size-[1.05rem] shrink-0 transition-colors",
            active ? "text-white/90 dark:text-forest-950/80" : "text-ink-muted group-hover:text-ink-secondary",
          )}
          aria-hidden
        />
        <span className="truncate">{label}</span>
        {active && <ChevronRight className="ml-auto size-3.5 opacity-50" aria-hidden />}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex size-8 items-center justify-center rounded-[10px] bg-forest-800 dark:bg-gold-400">
          <BusFront className="size-4.5 text-white dark:text-forest-950" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-ink">K-Rides</p>
          <p className="text-[0.7rem] font-medium text-ink-muted">Free Buses</p>
        </div>
      </div>

      <div className="mx-3 mb-3 h-px bg-line" />

      {/* User chip */}
      <div className="mx-3 mb-4 flex items-center gap-2.5 rounded-[var(--kx-radius-md)] bg-surface-nested px-3 py-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-forest-700 text-[0.65rem] font-bold text-white dark:bg-gold-500 dark:text-forest-950">
          {user.first_name[0]}{user.last_name[0]}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[0.8125rem] font-semibold text-ink">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-[0.7rem] text-ink-muted">Oversight</p>
        </div>
      </div>

      {/* Nav links */}
      <nav aria-label="Admin navigation" className="flex-1 space-y-0.5 px-3 overflow-y-auto">
        {ADMIN_NAV.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      {/* Footer controls */}
      <div className="mt-auto space-y-1 p-3 border-t border-line">
        <ThemeToggle />
        <button
          onClick={onSignOut}
          disabled={signingOut}
          className="flex w-full items-center gap-3 rounded-[var(--kx-radius-md)] px-3 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-700/20 dark:hover:text-red-400 disabled:opacity-50"
        >
          <LogOut className="size-[1.05rem] shrink-0" aria-hidden />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-line lg:bg-surface">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-[8px] bg-forest-800 dark:bg-gold-400">
            <BusFront className="size-4 text-white dark:text-forest-950" aria-hidden />
          </div>
          <span className="text-sm font-semibold text-ink">K-Rides</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="inline-flex size-9 items-center justify-center rounded-[var(--kx-radius-sm)] text-ink-secondary hover:bg-surface-nested"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-[var(--kx-overlay)] backdrop-blur-[4px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface shadow-2xl">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-[8px] bg-forest-800 dark:bg-gold-400">
                  <BusFront className="size-4 text-white dark:text-forest-950" aria-hidden />
                </div>
                <span className="text-sm font-semibold text-ink">K-Rides</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-nested"
              >
                <X className="size-4.5" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

// ─── Member sidebar ───────────────────────────────────────────────────────────

function MemberSidebar({
  user,
  pathname,
  onSignOut,
  signingOut,
}: {
  user: ApiUser;
  pathname: string;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavLink = ({ href, label, icon: Icon }: (typeof MEMBER_NAV)[0]) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-[var(--kx-radius-md)] px-3 py-2.5 text-sm font-medium transition-all duration-150",
          active
            ? "bg-forest-800 text-white shadow-md dark:bg-gold-400 dark:text-forest-950"
            : "text-ink-secondary hover:bg-surface-nested hover:text-ink",
        )}
      >
        <Icon
          className={cn(
            "size-[1.05rem] shrink-0 transition-colors",
            active ? "text-white/90 dark:text-forest-950/80" : "text-ink-muted group-hover:text-ink-secondary",
          )}
          aria-hidden
        />
        <span className="truncate">{label}</span>
        {active && <ChevronRight className="ml-auto size-3.5 opacity-50" aria-hidden />}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex size-8 items-center justify-center rounded-[10px] bg-forest-800 dark:bg-gold-400">
          <BusFront className="size-4.5 text-white dark:text-forest-950" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-ink">K-Rides</p>
          <p className="text-[0.7rem] font-medium text-ink-muted">Free Buses</p>
        </div>
      </div>

      <div className="mx-3 mb-3 h-px bg-line" />

      {/* User chip */}
      <div className="mx-3 mb-4 flex items-center gap-2.5 rounded-[var(--kx-radius-md)] bg-surface-nested px-3 py-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-forest-700 text-[0.65rem] font-bold text-white dark:bg-gold-500 dark:text-forest-950">
          {user.first_name[0]}{user.last_name[0]}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[0.8125rem] font-semibold text-ink">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-[0.7rem] text-ink-muted">Member</p>
        </div>
      </div>

      {/* Nav links */}
      <nav aria-label="Member navigation" className="flex-1 space-y-0.5 px-3 overflow-y-auto">
        {MEMBER_NAV.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto space-y-1 p-3 border-t border-line">
        <ThemeToggle />
        <button
          onClick={onSignOut}
          disabled={signingOut}
          className="flex w-full items-center gap-3 rounded-[var(--kx-radius-md)] px-3 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-700/20 dark:hover:text-red-400 disabled:opacity-50"
        >
          <LogOut className="size-[1.05rem] shrink-0" aria-hidden />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-line lg:bg-surface">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-[8px] bg-forest-800 dark:bg-gold-400">
            <BusFront className="size-4 text-white dark:text-forest-950" aria-hidden />
          </div>
          <span className="text-sm font-semibold text-ink">K-Rides</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="inline-flex size-9 items-center justify-center rounded-[var(--kx-radius-sm)] text-ink-secondary hover:bg-surface-nested"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-[var(--kx-overlay)] backdrop-blur-[4px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface shadow-2xl">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-[8px] bg-forest-800 dark:bg-gold-400">
                  <BusFront className="size-4 text-white dark:text-forest-950" aria-hidden />
                </div>
                <span className="text-sm font-semibold text-ink">K-Rides</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-nested"
              >
                <X className="size-4.5" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

    </>
  );
}


// ─── Shell ────────────────────────────────────────────────────────────────────

export function LiveFreeBusShell({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const session = useQuery({
    queryKey: ["freebus-live", "session"],
    queryFn: liveAuth.session,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  if (session.isPending) return <PageLoader message="Checking your session" />;
  if (session.error || !session.data) {
    const signedOut =
      session.error instanceof FreebusError && session.error.status === 401;
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        {signedOut ? (
          <EmptyState
            icon={BusFront}
            title="Sign in to Free Buses"
            description="Use your member or oversight account to continue."
            action={<ButtonLink href="/login">Sign in</ButtonLink>}
          />
        ) : (
          <>
            <ErrorState
              title="We couldn't verify your session"
              description={session.error?.message ?? "Please try again."}
              onRetry={() => void session.refetch()}
            />
            <ButtonLink href="/login">Back to sign in</ButtonLink>
          </>
        )}
      </main>
    );
  }

  const user = session.data;
  const allowed = admin ? isOversight(user.role) : user.role === "User";
  const home = isOversight(user.role) ? "/admin/free-buses" : "/passenger/free-buses";
  const memberNav = user.role === "User" && !admin;

  const allNav = memberNav ? MEMBER_NAV : ADMIN_NAV;
  const connectedPage =
    allNav.some((item) => pathname === item.href) ||
    (memberNav && /^\/passenger\/free-buses\/passes\/[^/]+$/.test(pathname));

  async function signOut() {
    setBusy(true);
    setLogoutError("");
    try {
      await liveAuth.logout();
      client.clear();
      router.replace("/login");
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Couldn't sign out.");
    } finally {
      setBusy(false);
    }
  }

  // ── Admin layout: sidebar + content ───────────────────────────────────────
  if (!memberNav) {
    return (
      <SessionContext.Provider value={user}>
        <div className="flex flex-col min-h-dvh bg-canvas lg:flex-row">
          <AdminSidebar
            user={user}
            pathname={pathname}
            onSignOut={signOut}
            signingOut={busy}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Mobile top bar is rendered inside AdminSidebar already */}
            <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-8">
              {logoutError && (
                <p role="alert" className="mb-4 text-danger-600">
                  {logoutError}
                </p>
              )}
              {!allowed ? (
                <EmptyState
                  icon={BusFront}
                  title="This page isn't available for your role"
                  description="Use the Free Buses page for your account."
                  action={<ButtonLink href={home}>Open Free Buses</ButtonLink>}
                />
              ) : !connectedPage ? (
                <EmptyState
                  icon={BusFront}
                  title="We're focused on Free Buses"
                  description="Other modules remain part of the demo and are not connected to this live account."
                  action={<ButtonLink href={home}>Open Free Buses</ButtonLink>}
                />
              ) : (
                children
              )}
            </main>
          </div>
        </div>
      </SessionContext.Provider>
    );
  }

  // ── Member layout: sidebar (desktop) + bottom tab bar (mobile) ───────────
  return (
    <SessionContext.Provider value={user}>
      <div className="flex flex-col min-h-dvh bg-canvas lg:flex-row">
        <MemberSidebar
          user={user}
          pathname={pathname}
          onSignOut={signOut}
          signingOut={busy}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-8">
            {logoutError && (
              <p role="alert" className="mb-4 text-danger-600">
                {logoutError}
              </p>
            )}
            {!allowed ? (
              <EmptyState
                icon={BusFront}
                title="This page isn't available for your role"
                description={
                  user.role === "Driver"
                    ? "Free Buses booking is reserved for members, excluding drivers."
                    : "Use the Free Buses page for your account."
                }
                action={
                  isOversight(user.role) || user.role === "User" ? (
                    <ButtonLink href={home}>Open Free Buses</ButtonLink>
                  ) : undefined
                }
              />
            ) : !connectedPage ? (
              <EmptyState
                icon={BusFront}
                title="We're focused on Free Buses"
                description="Other modules remain part of the demo and are not connected to this live account."
                action={<ButtonLink href={home}>Open Free Buses</ButtonLink>}
              />
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </SessionContext.Provider>
  );
}

