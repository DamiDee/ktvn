import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const SIZES = {
  xs: { box: "size-7", text: "text-[0.625rem]", badge: "size-3" },
  sm: { box: "size-9", text: "text-[0.75rem]", badge: "size-3.5" },
  md: { box: "size-11", text: "text-[0.875rem]", badge: "size-4" },
  lg: { box: "size-14", text: "text-[1rem]", badge: "size-5" },
  xl: { box: "size-20", text: "text-[1.375rem]", badge: "size-6" },
} as const;

export type AvatarSize = keyof typeof SIZES;

export interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  /** Shows a small verification tick in the corner. */
  verified?: boolean;
  className?: string;
}

/**
 * Falls back to initials on a deterministic tint so a missing photo still
 * looks intentional rather than broken.
 */
export function Avatar({
  name,
  src,
  size = "md",
  verified = false,
  className,
}: AvatarProps) {
  const config = SIZES[size];
  const tintIndex = name.charCodeAt(0) % 3;
  const tints = [
    "bg-forest-100 text-forest-800 dark:bg-forest-500/25 dark:text-forest-100",
    "bg-gold-100 text-gold-800 dark:bg-gold-500/22 dark:text-gold-100",
    "bg-lilac-100 text-lilac-800 dark:bg-lilac-500/22 dark:text-lilac-100",
  ];

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-full font-semibold ring-1 ring-inset ring-line",
          config.box,
          config.text,
          !src && tints[tintIndex],
        )}
      >
        {src ? (
          <Image
            src={src}
            alt=""
            width={96}
            height={96}
            className="size-full object-cover"
            unoptimized
          />
        ) : (
          <span aria-hidden>{initials(name)}</span>
        )}
      </span>

      {verified ? (
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 inline-flex items-center justify-center rounded-full bg-surface p-px",
          )}
        >
          <BadgeCheck
            className={cn(config.badge, "text-forest-600 dark:text-gold-400")}
            strokeWidth={2.2}
            aria-hidden
          />
        </span>
      ) : null}
      <span className="sr-only">{name}</span>
    </span>
  );
}

/** Overlapping stack used for shared-ride passengers and recent drivers. */
export function AvatarStack({
  people,
  size = "sm",
  max = 4,
  className,
}: {
  people: { name: string; avatarUrl?: string }[];
  size?: AvatarSize;
  max?: number;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;

  return (
    <div className={cn("flex items-center", className)}>
      {shown.map((person, index) => (
        <span
          key={`${person.name}-${index}`}
          className="-ml-2 first:ml-0 rounded-full ring-2 ring-surface"
        >
          <Avatar name={person.name} src={person.avatarUrl} size={size} />
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            "-ml-2 inline-flex items-center justify-center rounded-full bg-surface-nested text-[0.6875rem] font-semibold text-ink-secondary ring-2 ring-surface",
            SIZES[size].box,
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
