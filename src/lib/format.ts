/** Formatting helpers. Currency is Naira; volunteer rides never call these. */

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Format kobo-free Naira amounts. Never call this for a volunteer ride. */
export function formatNaira(amount: number): string {
  return nairaFormatter.format(amount);
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatMinutes(minutes: number): string {
  if (minutes < 1) return "Less than a minute";
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function formatEta(minutes: number): string {
  if (minutes <= 0) return "Arriving";
  if (minutes < 1) return "< 1 min";
  return `${Math.ceil(minutes)} min`;
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (Math.abs(diffMin) < 1) return "Just now";
  if (diffMin > 0 && diffMin < 60) return `${diffMin} min ago`;
  if (diffMin < 0 && diffMin > -60) return `In ${Math.abs(diffMin)} min`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr > 0 && diffHr < 24) return `${diffHr} hr ago`;
  if (diffHr < 0 && diffHr > -24) return `In ${Math.abs(diffHr)} hr`;

  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay === -1) return "Tomorrow";
  if (diffDay > 0) return `${diffDay} days ago`;
  return `In ${Math.abs(diffDay)} days`;
}

/** "Good morning" / "Good afternoon" / "Good evening". */
export function greetingForHour(hour: number = new Date().getHours()): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Initials for avatar fallbacks. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** "Chinedu Okafor" → "Chinedu O." — the display form used before boarding. */
export function shortName(fullName: string): string {
  const [first, ...rest] = fullName.split(/\s+/).filter(Boolean);
  if (!first) return fullName;
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

export function formatPlate(plate: string): string {
  return plate.toUpperCase();
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}
