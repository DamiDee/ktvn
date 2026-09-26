"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
  UsersRound,
  LineChart,
  HandHeart,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { PageLoader } from "@/components/ui/route-loader";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { liveAuth, FreebusError } from "@/services/freebus-api";
import { isOversight, canBoard, liveHome } from "@/lib/freebus-contract";
import type { ApiUser } from "@/types/freebus-api";

// ─── Session context ──────────────────────────────────────────────────────────

const SessionContext = createContext<ApiUser | null>(null);
export function useLiveUser() {
  const user = useContext(SessionContext);
  if (!user) throw new Error("Free Buses requires an authenticated session.");
  return user;
}

// ─── Navigation definitions ───────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  /** Short label for the mobile tab bar, where width is scarce. */
  short?: string;
  icon: LucideIcon;
}

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/free-buses", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/free-buses/buses", label: "Buses", icon: BusFront },
  { href: "/admin/free-buses/routes", label: "Routes", icon: Route },
  { href: "/admin/free-buses/trips", label: "Trips", icon: Ticket },
  { href: "/admin/free-buses/ride-requests", label: "Ride Requests", icon: ClipboardList },
  { href: "/admin/free-buses/points", label: "Points", icon: MapPin },
  { href: "/admin/free-buses/boarding", label: "Boarding", icon: ScanLine },
  { href: "/admin/free-buses/users", label: "System Users", icon: UsersRound },
  { href: "/admin/free-buses/activity", label: "Activity", icon: History },
];


const COORDINATOR_NAV: NavItem[] = [
  { href: "/admin/free-buses/buses", label: "Buses", icon: BusFront },
  { href: "/admin/free-buses/boarding", label: "Bookings & boarding", icon: ScanLine },
];

const MEMBER_NAV: NavItem[] = [
  { href: "/passenger/free-buses", label: "Find a bus", short: "Buses", icon: BusFront },
  { href: "/passenger/free-buses/passes", label: "Boarding passes", short: "Passes", icon: Ticket },
  { href: "/passenger/free-buses/requests", label: "Ask for a route", short: "Ask", icon: HandHeart },
  { href: "/passenger/free-buses/trips", label: "My journeys", short: "Journeys", icon: LineChart },
  { href: "/passenger/profile", label: "Profile", short: "Profile", icon: UserRound },
];

function initials(user: ApiUser) {
  return `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();
}

function roleLabel(user: ApiUser) {
  return user.role === "RouteCoordinator" ? "Route Coordinator" : isOversight(user.role) ? "Oversight" : user.role === "User" ? "Member" : user.role;
}

/** Closes a transient overlay on Escape and stops the page behind it scrolling. */
function useOverlay(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
}

// ─── Shared pieces ────────────────────────────────────────────────────────────

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "flex items-center justify-center rounded-[10px] bg-gold-400",
          compact ? "size-7" : "size-8",
        )}
      >
        <BusFront
          className={cn("text-forest-950", compact ? "size-4" : "size-4.5")}
          aria-hidden
        />
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight text-ink">K-Rides</p>
        {!compact ? (
          <p className="text-[0.7rem] font-medium text-ink-muted">Free Buses</p>
        ) : null}
      </div>
    </div>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-[var(--kx-radius-md)] px-3 py-2.5 text-sm font-medium transition-all duration-150",
        active
          ? "bg-gold-400 text-forest-950 shadow-gold"
          : "text-ink-secondary hover:bg-surface-nested hover:text-ink",
      )}
    >
      <Icon
        className={cn(
          "size-[1.05rem] shrink-0 transition-colors",
          active
            ? "text-forest-950/80"
            : "text-ink-muted group-hover:text-ink-secondary",
        )}
        aria-hidden
      />
      <span className="truncate">{item.label}</span>
      {active ? <ChevronRight className="ml-auto size-3.5 opacity-50" aria-hidden /> : null}
    </Link>
  );
}

function SignOutButton({
  onSignOut,
  signingOut,
  className,
}: {
  onSignOut: () => void;
  signingOut: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSignOut}
      disabled={signingOut}
      className={cn(
        "flex w-full items-center gap-3 rounded-[var(--kx-radius-md)] px-3 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50 dark:hover:bg-danger-700/20 dark:hover:text-red-400",
        className,
      )}
    >
      <LogOut className="size-[1.05rem] shrink-0" aria-hidden />
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}

function UserChip({ user }: { user: ApiUser }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[var(--kx-radius-md)] bg-surface-nested px-3 py-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold-500 text-[0.65rem] font-bold text-forest-950">
        {initials(user)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[0.8125rem] font-semibold text-ink">
          {user.first_name} {user.last_name}
        </p>
        <p className="text-[0.7rem] text-ink-muted">{roleLabel(user)}</p>
      </div>
    </div>
  );
}

/**
 * The sidebar body, shared by the desktop rail and the mobile drawer. The drawer
 * supplies its own header, so it asks for this without the brand block.
 */
function SidebarBody({
  user,
  items,
  pathname,
  onSignOut,
  signingOut,
  onNavigate,
  withBrand = true,
  navLabel,
}: {
  user: ApiUser;
  items: NavItem[];
  pathname: string;
  onSignOut: () => void;
  signingOut: boolean;
  onNavigate?: () => void;
  withBrand?: boolean;
  navLabel: string;
}) {
  return (
    <div className="flex h-full flex-col">
      {withBrand ? (
        <>
          <div className="px-4 py-5">
            <Brand />
          </div>
          <div className="mx-3 mb-3 h-px bg-line" />
        </>
      ) : null}

      <div className="mx-3 mb-4">
        <UserChip user={user} />
      </div>

      <nav aria-label={navLabel} className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="mt-auto space-y-1 border-t border-line p-3">
        <ThemeToggle />
        <SignOutButton onSignOut={onSignOut} signingOut={signingOut} />
      </div>
    </div>
  );
}

// ─── Admin chrome: desktop rail + labelled mobile drawer ──────────────────────

function AdminChrome({
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
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  useOverlay(open, close);

  const navigation = user.role === "RouteCoordinator" ? COORDINATOR_NAV : ADMIN_NAV;
  const active = navigation.find((item) => item.href === pathname);

  return (
    <>
      <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-line lg:bg-surface">
        <SidebarBody
          user={user}
          items={navigation}
          pathname={pathname}
          onSignOut={onSignOut}
          signingOut={signingOut}
          navLabel="Oversight navigation"
        />
      </aside>

      {/* Mobile bar. The menu control says what it opens and where you already are. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label={`Open menu${active ? `. Current page: ${active.label}` : ""}`}
          className="kx-tap -ml-1 flex min-w-0 items-center gap-2 rounded-[var(--kx-radius-md)] px-2 py-1.5 text-left transition-colors hover:bg-surface-nested"
        >
          <Menu className="size-5 shrink-0 text-ink-secondary" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight text-ink">
              {active?.label ?? "Free Buses"}
            </span>
            <span className="block text-[0.7rem] leading-tight text-ink-muted">Tap for menu</span>
          </span>
        </button>
        <ThemeToggle />
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-[var(--kx-overlay)] backdrop-blur-[4px]"
            onClick={close}
            aria-hidden
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-[17.5rem] flex-col bg-surface shadow-2xl"
            role="dialog"
            aria-modal
            aria-label="Oversight menu"
          >
            <div className="flex items-center justify-between px-4 py-4">
              <Brand compact />
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="kx-tap inline-flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-nested"
              >
                <X className="size-4.5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <SidebarBody
                user={user}
                items={navigation}
                pathname={pathname}
                onSignOut={onSignOut}
                signingOut={signingOut}
                onNavigate={close}
                withBrand={false}
                navLabel="Oversight navigation"
              />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

// ─── Member chrome: desktop rail + mobile tab bar and account sheet ───────────

function MemberChrome({
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
  const [account, setAccount] = useState(false);
  const close = () => setAccount(false);
  useOverlay(account, close);

  return (
    <>
      <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-line lg:bg-surface">
        <SidebarBody
          user={user}
          items={MEMBER_NAV}
          pathname={pathname}
          onSignOut={onSignOut}
          signingOut={signingOut}
          navLabel="Member navigation"
        />
      </aside>

      {/* Mobile top bar: brand, theme, and an account button that is visibly an account. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Brand compact />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setAccount(true)}
            aria-expanded={account}
            aria-label={`Account and sign out. Signed in as ${user.first_name} ${user.last_name}`}
            className="kx-tap flex size-8 items-center justify-center rounded-full bg-gold-500 text-[0.7rem] font-bold text-forest-950 transition-opacity hover:opacity-90"
          >
            {initials(user)}
          </button>
        </div>
      </header>

      {account ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-[var(--kx-overlay)] backdrop-blur-[4px]"
            onClick={close}
            aria-hidden
          />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-[var(--kx-radius-2xl)] bg-surface pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-2xl"
            role="dialog"
            aria-modal
            aria-label="Your account"
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
            <div className="p-4">
              <UserChip user={user} />
              <p className="type-meta mt-3 truncate text-ink-muted">{user.email}</p>
              <div className="mt-4 space-y-1">
                <Link
                  href="/passenger/profile"
                  onClick={close}
                  className="flex w-full items-center gap-3 rounded-[var(--kx-radius-md)] px-3 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-nested hover:text-ink"
                >
                  <UserRound className="size-[1.05rem] shrink-0" aria-hidden />
                  Your profile
                </Link>
                <SignOutButton onSignOut={onSignOut} signingOut={signingOut} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MemberTabBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Member sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur lg:hidden"
    >
      <ul className="flex">
        {MEMBER_NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 px-1 py-2 text-[0.6875rem] font-medium transition-colors",
                  active ? "text-gold-800 dark:text-gold-300" : "text-ink-muted",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="truncate">{item.short ?? item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
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
    const signedOut = session.error instanceof FreebusError && session.error.status === 401;
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
  const allowed = admin ? canBoard(user.role) : user.role === "User";
  const home = liveHome(user.role);
  const memberNav = user.role === "User" && !admin;

  const items = memberNav ? MEMBER_NAV : user.role === "RouteCoordinator" ? COORDINATOR_NAV : ADMIN_NAV;
  const connectedPage =
    items.some((item) => pathname === item.href) ||
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

  const body = !allowed ? (
    <EmptyState
      icon={BusFront}
      title="This page isn't available for your role"
      description={
        user.role === "Driver"
          ? "Free Buses booking is reserved for members, excluding drivers."
          : "Use the Free Buses page for your account."
      }
      action={
        canBoard(user.role) || user.role === "User" ? (
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
  );

  return (
    <SessionContext.Provider value={user}>
      <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
        {memberNav ? (
          <MemberChrome
            user={user}
            pathname={pathname}
            onSignOut={signOut}
            signingOut={busy}
          />
        ) : (
          <AdminChrome
            user={user}
            pathname={pathname}
            onSignOut={signOut}
            signingOut={busy}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <main
            className={cn(
              "flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8",
              // Clear the fixed tab bar on mobile.
              memberNav ? "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-8" : "",
            )}
          >
            {logoutError ? (
              <p role="alert" className="mb-4 text-danger-600">
                {logoutError}
              </p>
            ) : null}
            {body}
          </main>
        </div>

        {memberNav ? <MemberTabBar pathname={pathname} /> : null}
      </div>
    </SessionContext.Provider>
  );
}
