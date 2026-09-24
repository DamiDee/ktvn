"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BusFront, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { PageLoader } from "@/components/ui/route-loader";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { liveAuth, FreebusError } from "@/services/freebus-api";
import { isOversight } from "@/lib/freebus-contract";
import type { ApiUser } from "@/types/freebus-api";

const SessionContext = createContext<ApiUser | null>(null);
export function useLiveUser() {
  const user = useContext(SessionContext);
  if (!user) throw new Error("Free Buses requires an authenticated session.");
  return user;
}
export function LiveFreeBusShell({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const session = useQuery({ queryKey: ["freebus-live", "session"], queryFn: liveAuth.session, retry: false, staleTime: 0, refetchOnWindowFocus: true });
  if (session.isPending) return <PageLoader message="Checking your session" />;
  if (session.error || !session.data) {
    const signedOut = session.error instanceof FreebusError && session.error.status === 401;
    return <main className="mx-auto max-w-xl px-5 py-16">{signedOut
      ? <EmptyState icon={BusFront} title="Sign in to Free Buses" description="Use your member or oversight account to continue." action={<ButtonLink href="/login">Sign in</ButtonLink>} />
      : <><ErrorState title="We couldn't verify your session" description={session.error?.message ?? "Please try again."} onRetry={() => void session.refetch()} /><ButtonLink href="/login">Back to sign in</ButtonLink></>}
    </main>;
  }
  const user = session.data;
  const allowed = admin ? isOversight(user.role) : user.role === "User";
  const home = isOversight(user.role) ? "/admin/free-buses" : "/passenger/free-buses";
  const memberNavigation = user.role === "User" && !admin;
  const connectedPage = pathname === home || (memberNavigation && pathname === "/passenger/profile");
  return <SessionContext.Provider value={user}>
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href={home} className="flex items-center gap-2 font-semibold text-ink"><BusFront className="size-6 text-forest-700 dark:text-gold-300" />K-Rides <span className="type-meta font-normal text-ink-muted">Free Buses</span></Link>
        <div className="flex items-center gap-2"><span className="type-meta hidden text-ink-secondary sm:block">{user.first_name} · {isOversight(user.role) ? "Oversight" : user.role === "User" ? "Member" : user.role}</span><ThemeToggle /><Button size="sm" variant="ghost" loading={busy} onClick={async () => {
          setBusy(true); setLogoutError("");
          try { await liveAuth.logout(); client.clear(); router.replace("/login"); }
          catch (error) { setLogoutError(error instanceof Error ? error.message : "Couldn't sign out."); }
          finally { setBusy(false); }
        }}>Sign out</Button></div>
      </div>
      {memberNavigation ? <nav aria-label="Member navigation" className="mx-auto flex max-w-6xl gap-2 px-4 pb-3 sm:px-6">
        {[{ href: "/passenger/free-buses", label: "Free Buses", icon: BusFront }, { href: "/passenger/profile", label: "Profile", icon: UserRound }].map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500",
          pathname === href ? "bg-forest-800 text-white dark:bg-gold-400 dark:text-forest-950" : "text-ink-secondary hover:bg-surface-nested",
        )}><Icon className="size-4" aria-hidden />{label}</Link>)}
      </nav> : null}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {logoutError ? <p role="alert" className="mb-4 text-danger-600">{logoutError}</p> : null}
        {!allowed ? <EmptyState icon={BusFront} title="This page isn't available for your role" description={user.role === "Driver" ? "Free Buses booking is reserved for members, excluding drivers." : "Use the Free Buses page for your account."} action={isOversight(user.role) || user.role === "User" ? <ButtonLink href={home}>Open Free Buses</ButtonLink> : undefined} />
          : !connectedPage ? <EmptyState icon={BusFront} title="We're focused on Free Buses" description="Other modules remain part of the demo and are not connected to this live account." action={<ButtonLink href={home}>Open Free Buses</ButtonLink>} /> : children}
      </main>
    </div>
  </SessionContext.Provider>;
}
