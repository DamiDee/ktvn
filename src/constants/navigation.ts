import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  BarChart3,
  Car,
  ClipboardCheck,
  FileText,
  Gauge,
  Heart,
  Home,
  Inbox,
  LifeBuoy,
  MapPinned,
  Route,
  ShieldAlert,
  Sparkles,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { DriverTrack } from "@/types/enums";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown on mobile bottom nav; desktop uses `label`. */
  shortLabel?: string;
  /** Matches nested routes, e.g. /passenger/rides/[id]. */
  matchPrefix?: boolean;
}

export const PASSENGER_NAV: NavItem[] = [
  { href: "/passenger", label: "Home", icon: Home },
  { href: "/passenger/rides", label: "Rides", icon: Route, matchPrefix: true },
  { href: "/passenger/safety", label: "Safety", icon: LifeBuoy },
  { href: "/passenger/profile", label: "Profile", icon: User },
];

export const VOLUNTEER_DRIVER_NAV: NavItem[] = [
  { href: "/driver", label: "Home", icon: Home },
  { href: "/driver/requests", label: "Requests", icon: Inbox },
  { href: "/driver/volunteer", label: "Service", icon: Heart, matchPrefix: true },
  { href: "/driver/trips", label: "Trips", icon: Route, matchPrefix: true },
  { href: "/driver/profile", label: "Profile", icon: User },
];

export const PROFESSIONAL_DRIVER_NAV: NavItem[] = [
  { href: "/driver", label: "Home", icon: Home },
  { href: "/driver/requests", label: "Requests", icon: Inbox },
  { href: "/driver/trips", label: "Trips", icon: Route, matchPrefix: true },
  {
    href: "/driver/professional/earnings",
    label: "Earnings",
    icon: Wallet,
    matchPrefix: true,
  },
  { href: "/driver/profile", label: "Profile", icon: User },
];

export function driverNavForTrack(track: DriverTrack): NavItem[] {
  return track === DriverTrack.VOLUNTEER
    ? VOLUNTEER_DRIVER_NAV
    : PROFESSIONAL_DRIVER_NAV;
}

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  {
    href: "/admin/live-rides",
    label: "Live Rides",
    icon: MapPinned,
    shortLabel: "Live",
    matchPrefix: true,
  },
  {
    href: "/admin/verifications",
    label: "Verification",
    icon: ClipboardCheck,
    shortLabel: "Verify",
    matchPrefix: true,
  },
  { href: "/admin/drivers", label: "Drivers", icon: Car, matchPrefix: true },
  {
    href: "/admin/passengers",
    label: "Passengers",
    icon: Users,
    matchPrefix: true,
  },
  {
    href: "/admin/incidents",
    label: "Incidents",
    icon: ShieldAlert,
    matchPrefix: true,
  },
  { href: "/admin/quality", label: "Quality", icon: BadgeCheck },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
];

export const MARKETING_NAV = [
  { href: "/#tracks", label: "How it works" },
  { href: "/#safety", label: "Safety" },
  { href: "/#drivers", label: "Drivers" },
  { href: "/#oversight", label: "Oversight" },
] as const;

export const FOOTER_LINKS: { heading: string; items: { href: string; label: string }[] }[] =
  [
    {
      heading: "Network",
      items: [
        { href: "/#tracks", label: "About" },
        { href: "/#safety", label: "Safety" },
        { href: "/driver/apply", label: "Driver Information" },
      ],
    },
    {
      heading: "Support",
      items: [
        { href: "/#faq", label: "Help" },
        { href: "/verify-member", label: "Membership" },
      ],
    },
    {
      heading: "Legal",
      items: [
        { href: "/#terms", label: "Terms" },
        { href: "/#privacy", label: "Privacy" },
      ],
    },
  ];

export const ONBOARDING_ICON = Sparkles;
export const RECEIPT_ICON = FileText;
