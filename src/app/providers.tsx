"use client";

import { Fragment, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { accountSession, watchAccountSession } from "@/lib/account-session";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AccountBoundary client={queryClient}><ToastProvider>{children}</ToastProvider></AccountBoundary>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function AccountBoundary({ client, children }: { client: QueryClient; children: ReactNode }) {
  const revision = useSyncExternalStore(accountSession.subscribe, accountSession.getSnapshot, () => -1);
  const pathname = usePathname();
  const protectedPage = /^\/(rides|passenger|admin|driver)(\/|$)/.test(pathname) && pathname !== "/driver/apply";
  useEffect(() => {
    const stopWatching = watchAccountSession();
    const stopClearing = accountSession.subscribe(() => { void client.cancelQueries(); client.clear(); });
    return () => { stopWatching(); stopClearing(); };
  }, [client]);
  if (revision >= 0 && protectedPage && accountSession.isBlocked()) return <main className="mx-auto max-w-lg px-6 py-20"><h1 className="text-2xl font-semibold">Your session has changed</h1><p className="mt-3">Sign in to continue with your account.</p><Link className="mt-5 inline-block underline" href="/login">Go to sign in</Link></main>;
  return <Fragment key={protectedPage ? revision : "public"}>{children}</Fragment>;
}
