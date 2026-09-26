// Deliberately not marked "use client": this module has no state, effects or
// browser APIs, so it renders in whichever environment imports it. That lets a
// Server Component pass a Lucide icon to `ButtonLink` without crossing the
// serialisation boundary, while `Button` still works inside client trees.

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Button. Hover lifts slightly, press compresses — motion handled in CSS so
 * it stays cheap and respects reduced-motion via the global media query.
 */
const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2",
    "font-medium tracking-[-0.01em] whitespace-nowrap",
    "transition-[transform,background-color,box-shadow,color,border-color] duration-[165ms] ease-[var(--kx-ease-standard)]",
    "active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-gold-500 text-forest-950 shadow-sm hover:-translate-y-px hover:bg-gold-400 hover:shadow-md",
        gold: "bg-gold-500 text-forest-950 shadow-gold hover:-translate-y-px hover:bg-gold-400 hover:shadow-md",
        secondary:
          "surface-card text-ink hover:-translate-y-px hover:border-line-strong hover:shadow-md",
        subtle:
          "bg-[color-mix(in_srgb,var(--kx-text)_6%,transparent)] text-ink hover:bg-[color-mix(in_srgb,var(--kx-text)_10%,transparent)]",
        ghost: "text-ink-secondary hover:bg-[color-mix(in_srgb,var(--kx-text)_7%,transparent)] hover:text-ink",
        outline:
          "border border-line-strong bg-transparent text-ink hover:border-forest-400 hover:bg-[color-mix(in_srgb,var(--kx-text)_4%,transparent)]",
        inverse:
          "bg-white/12 text-white ring-1 ring-inset ring-white/18 backdrop-blur-md hover:bg-white/18",
        danger:
          "bg-danger-500 text-white shadow-sm hover:-translate-y-px hover:bg-danger-600 hover:shadow-md",
        sos: "bg-sos-500 text-white shadow-sm hover:bg-sos-600",
        link: "text-gold-800 underline-offset-4 hover:underline dark:text-gold-300",
      },
      size: {
        xs: "h-8 rounded-[var(--kx-radius-xs)] px-3 text-[0.8125rem]",
        sm: "h-9 rounded-[var(--kx-radius-sm)] px-3.5 text-[0.875rem]",
        md: "h-11 rounded-[var(--kx-radius-sm)] px-5 text-[0.9375rem]",
        lg: "h-13 rounded-[var(--kx-radius-md)] px-6 text-[1rem]",
        xl: "h-15 rounded-[var(--kx-radius-lg)] px-8 text-[1.0625rem]",
      },
      block: { true: "w-full", false: "" },
      pill: { true: "!rounded-full", false: "" },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      block: false,
      pill: false,
    },
  },
);

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    VariantProps<typeof buttonVariants> {
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  /** Replaces the label while `loading` is true. */
  loadingLabel?: string;
  children?: ReactNode;
}

/** Three travelling dots — the product's loading treatment, never a spinner. */
function TravellingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-hidden>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 rounded-full bg-current opacity-40"
          style={{
            animation: "kx-breathe 1.15s ease-in-out infinite",
            animationDelay: `${index * 0.16}s`,
          }}
        />
      ))}
    </span>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant,
      size,
      block,
      pill,
      icon: Icon,
      iconRight: IconRight,
      loading = false,
      loadingLabel,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size, block, pill }), className)}
        {...props}
      >
        {loading ? (
          <>
            <TravellingDots />
            {loadingLabel ? <span>{loadingLabel}</span> : null}
          </>
        ) : (
          <>
            {Icon ? <Icon className="size-[1.05em] shrink-0" strokeWidth={1.8} aria-hidden /> : null}
            {children}
            {IconRight ? (
              <IconRight className="size-[1.05em] shrink-0" strokeWidth={1.8} aria-hidden />
            ) : null}
          </>
        )}
      </button>
    );
  },
);

export interface ButtonLinkProps
  extends VariantProps<typeof buttonVariants> {
  href: string;
  className?: string;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  children?: ReactNode;
  prefetch?: boolean;
  "aria-label"?: string;
}

export function ButtonLink({
  href,
  className,
  variant,
  size,
  block,
  pill,
  icon: Icon,
  iconRight: IconRight,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant, size, block, pill }), className)}
      {...props}
    >
      {Icon ? <Icon className="size-[1.05em] shrink-0" strokeWidth={1.8} aria-hidden /> : null}
      {children}
      {IconRight ? (
        <IconRight className="size-[1.05em] shrink-0" strokeWidth={1.8} aria-hidden />
      ) : null}
    </Link>
  );
}

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    Pick<VariantProps<typeof buttonVariants>, "variant"> {
  icon: LucideIcon;
  /** Required — icon-only controls must be announced. */
  label: string;
  size?: "sm" | "md" | "lg";
}

const ICON_SIZES = {
  sm: "kx-tap size-8 rounded-[var(--kx-radius-xs)]",
  md: "size-10 rounded-[var(--kx-radius-sm)]",
  lg: "size-12 rounded-[var(--kx-radius-md)]",
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { icon: Icon, label, size = "md", variant = "ghost", className, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={cn(
          buttonVariants({ variant }),
          "p-0",
          ICON_SIZES[size],
          className,
        )}
        {...props}
      >
        <Icon
          className={cn(size === "sm" ? "size-4" : size === "lg" ? "size-5.5" : "size-[1.15rem]")}
          strokeWidth={1.8}
          aria-hidden
        />
      </button>
    );
  },
);

export { buttonVariants };
