"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "motion/react";

/** Route-scoped theme; the existing public landing page keeps its own design. */
export function ProductTheme({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return children;
  return <MotionConfig reducedMotion="user"><div data-product-ui="premium" className="contents">{children}</div></MotionConfig>;
}
