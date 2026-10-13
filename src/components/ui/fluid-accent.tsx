import { cn } from "@/lib/cn";

/** Only the decorative layer is clipped. Text, focus rings and controls never morph. */
export function FluidAccent({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  return (
    <div className={cn("premium-fluid", inverse && "premium-fluid-inverse", className)} aria-hidden="true">
      <span className="premium-fluid-drop" />
      <span className="premium-fluid-orbit" />
    </div>
  );
}
