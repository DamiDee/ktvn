import { z } from "zod";
import { DriverTrack } from "@/types/enums";

/** Per-step schemas for the driver application. Each step validates alone. */

export const KOINONIA_DEPARTMENTS = [
  "Ushering department",
  "Prayer",
  "Transportation and Logistics",
  "Finance",
  "Welfare and Hospitality",
  "Medical",
  "Protocol",
  "Public Relations",
  "Counselling department",
  "Aesthetics department",
] as const;

export const identitySchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Enter your full name")
      .refine(
        (value) => value.trim().split(/\s+/).length >= 2,
        "Enter your first and last name",
      ),
    email: z.string().min(1, "Enter your email").email("Enter a valid email"),
    phone: z
      .string()
      .min(1, "Enter your phone number")
      .regex(/^\+?[\d\s-]{7,}$/, "Enter a valid phone number"),
    nin: z
      .string()
      .regex(/^\d{11}$/, "Enter the 11-digit NIN exactly as issued"),
    address: z.string().min(6, "Enter the address on your NIN record"),
    workerStatus: z.enum(["YES", "NO"], {
      message: "Tell us whether you are a Koinonia worker",
    }),
    department: z.string().optional(),
    guarantorName: z.string().optional(),
    guarantorPhone: z.string().optional(),
    guarantorRelationship: z.string().optional(),
  })
  .superRefine((values, context) => {
    if (values.workerStatus === "YES" && !values.department) {
      context.addIssue({
        code: "custom",
        path: ["department"],
        message: "Select your Koinonia department",
      });
    }

    if (values.workerStatus === "NO") {
      const required = [
        ["guarantorName", values.guarantorName, "Enter your guarantor's name"],
        ["guarantorPhone", values.guarantorPhone, "Enter your guarantor's phone"],
        [
          "guarantorRelationship",
          values.guarantorRelationship,
          "Describe how you know your guarantor",
        ],
      ] as const;
      required.forEach(([path, value, message]) => {
        if (!value?.trim()) {
          context.addIssue({ code: "custom", path: [path], message });
        }
      });
    }
  });

export type IdentityValues = z.infer<typeof identitySchema>;

export const licenceSchema = z.object({
  licenceNumber: z
    .string()
    .min(5, "Enter the number printed on your licence"),
  licenceClass: z.string().min(1, "Select your licence class"),
  licenceExpiry: z
    .string()
    .min(1, "Enter the expiry date")
    .refine((value) => {
      const expiry = new Date(value);
      if (Number.isNaN(expiry.getTime())) return false;
      // Must stay valid for at least three more months.
      const threshold = new Date();
      threshold.setMonth(threshold.getMonth() + 3);
      return expiry > threshold;
    }, "Your licence must be valid for at least three more months"),
});

export type LicenceValues = z.infer<typeof licenceSchema>;

export const vehicleSchema = z.object({
  make: z.string().min(2, "Enter the make, e.g. Toyota"),
  model: z.string().min(1, "Enter the model, e.g. Corolla"),
  colour: z.string().min(3, "Enter the colour"),
  plateNumber: z
    .string()
    .min(1, "Enter the plate number")
    .regex(
      /^[A-Za-z]{3}-?\d{3}-?[A-Za-z]{2}$/,
      "Plates look like ABC-123-XY",
    ),
  year: z
    .string()
    .min(4, "Enter the year")
    .refine((value) => {
      const year = Number(value);
      const current = new Date().getFullYear();
      return year >= 1990 && year <= current + 1;
    }, "Enter a year between 1990 and now"),
  seats: z.string().min(1, "Select the number of passenger seats"),
});

export type VehicleValues = z.infer<typeof vehicleSchema>;

export const trackSchema = z.object({
  tracks: z
    .array(z.enum([DriverTrack.VOLUNTEER, DriverTrack.PROFESSIONAL]))
    .min(1, "Choose at least one track"),
});

export type TrackValues = z.infer<typeof trackSchema>;

export const LICENCE_CLASSES = [
  { value: "B", label: "Class B — private cars" },
  { value: "C", label: "Class C — light commercial" },
  { value: "D", label: "Class D — passenger vehicles" },
  { value: "E", label: "Class E — heavy passenger vehicles" },
];

export const SEAT_OPTIONS = [
  { value: "3", label: "3 passenger seats" },
  { value: "4", label: "4 passenger seats" },
  { value: "5", label: "5 passenger seats" },
  { value: "6", label: "6 or more" },
];
