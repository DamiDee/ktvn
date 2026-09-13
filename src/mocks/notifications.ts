import { NotificationCategory } from "@/types/enums";
import type { Notification } from "@/types/models";

export const NOTIFICATIONS: Notification[] = [
  {
    id: "ntf-1",
    category: NotificationCategory.SERVICE,
    title: "Confirm your availability",
    body: "Are you available to drive this evening?",
    createdAt: "2026-09-09T16:05:00.000Z",
    read: false,
    priority: "HIGH",
    href: "/driver/volunteer/confirm",
  },
  {
    id: "ntf-2",
    category: NotificationCategory.VERIFICATION,
    title: "Inspection required",
    body: "Your documents were accepted. A vehicle inspection is the next step.",
    createdAt: "2026-09-08T14:31:00.000Z",
    read: false,
    href: "/driver/verification",
  },
  {
    id: "ntf-3",
    category: NotificationCategory.PAYMENT,
    title: "Payment pending",
    body: "Your share for ride #2290 is waiting to be settled.",
    createdAt: "2026-09-08T20:27:00.000Z",
    read: false,
    href: "/passenger/rides/ride-2290",
  },
  {
    id: "ntf-4",
    category: NotificationCategory.RIDE,
    title: "Your driver has arrived",
    body: "Chinedu O. is at the pickup point in a blue Toyota Camry.",
    createdAt: "2026-09-06T19:10:00.000Z",
    read: true,
    href: "/passenger/rides/ride-2287",
  },
  {
    id: "ntf-5",
    category: NotificationCategory.SAFETY,
    title: "Trip sharing ended",
    body: "Live trip sharing for ride #2287 has ended.",
    createdAt: "2026-09-06T19:45:00.000Z",
    read: true,
  },
];
