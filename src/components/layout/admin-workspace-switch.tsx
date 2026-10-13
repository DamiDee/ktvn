"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BusFront, CarFront } from "lucide-react";

export function AdminWorkspaceSwitch({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const buses = pathname.startsWith("/admin/free-buses");
  return <nav aria-label="Admin workspace" className="premium-workspace-switch">
    <Link href="/admin" onClick={onNavigate} aria-current={!buses ? "page" : undefined}><CarFront className="size-4 shrink-0" aria-hidden />Paid rides</Link>
    <Link href="/admin/free-buses" onClick={onNavigate} aria-current={buses ? "page" : undefined}><BusFront className="size-4 shrink-0" aria-hidden />Free buses</Link>
  </nav>;
}
