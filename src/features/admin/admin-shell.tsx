"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { ADMIN_NAV } from "@/constants/navigation";
import { queryKeys } from "@/constants/query-keys";
import { adminService, userService } from "@/services";
import { isSosLive } from "@/lib/state-machines";
import { shortName } from "@/lib/format";
import { ADMIN_USER } from "@/mocks/people";
import { SosBanner } from "@/components/safety/sos-banner";
import { LIVE_FREE_BUSES } from "@/lib/freebus-config";
import { LiveFreeBusShell } from "@/features/free-buses/live-shell";
import { AdminWorkspaceSwitch } from "@/components/layout/admin-workspace-switch";

export function AdminShell({ children }: { children: ReactNode }) {
  return LIVE_FREE_BUSES ? <LiveFreeBusShell admin>{children}</LiveFreeBusShell> : <DemoAdminShell>{children}</DemoAdminShell>;
}

function DemoAdminShell({ children }: { children: ReactNode }) {
  const { data: admin } = useQuery({
    queryKey: queryKeys.admin.root,
    queryFn: () => userService.getAdmin(),
    initialData: ADMIN_USER,
  });

  const { data: overview } = useQuery({
    queryKey: queryKeys.admin.overview(),
    queryFn: () => adminService.getOverview(),
  });

  const sos = overview?.activeSos;
  const sosLive = sos ? isSosLive(sos.status) : false;

  return (
    <AppShell
      nav={ADMIN_NAV.filter((item) => item.href !== "/admin/free-buses")}
      user={{
        name: shortName(admin.fullName),
        avatarUrl: admin.avatarUrl,
        roleLabel: "Oversight",
        profileHref: "/admin",
        verified: true,
      }}
      railStatus={
        sosLive
          ? { label: "SOS active", tone: "pending", live: true }
          : { label: "All clear", tone: "active" }
      }
    >
      <div className="mb-6 ml-auto max-w-sm"><AdminWorkspaceSwitch /></div>
      <p className="mb-6 text-xs text-ink-secondary">Preview workspace · Demo records and simulated actions</p>
      {sosLive && sos ? <SosBanner alert={sos} className="mb-6" /> : null}
      {children}
    </AppShell>
  );
}
