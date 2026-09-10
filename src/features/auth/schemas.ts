import { z } from "zod";

/** Validation schemas shared by the auth forms. */

const MEMBER_ID_PATTERN = /^KOI-\d{4}-\d{6}$/i;

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Enter your email, phone or member ID")
    .refine(
      (value) =>
        value.includes("@") ||
        /^\+?[\d\s-]{7,}$/.test(value) ||
        MEMBER_ID_PATTERN.test(value),
      "That doesn't look like an email, phone number or member ID",
    ),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean().optional(),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const signUpSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Enter your full name")
      .refine(
        (value) => value.trim().split(/\s+/).length >= 2,
        "Enter your first and last name",
      ),
    memberId: z
      .string()
      .min(1, "Enter your membership identifier")
      .regex(MEMBER_ID_PATTERN, "Member IDs look like KOI-2019-004821"),
    email: z.string().min(1, "Enter your email").email("Enter a valid email"),
    phone: z
      .string()
      .min(1, "Enter your phone number")
      .regex(/^\+?[\d\s-]{7,}$/, "Enter a valid phone number"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/\d/, "Include a number"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    acceptedTerms: z.literal(true, {
      message: "Accept the terms to continue",
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type SignUpValues = z.infer<typeof signUpSchema>;

export const resetIdentifierSchema = z.object({
  identifier: z.string().min(1, "Enter your email, phone or member ID"),
});

export type ResetIdentifierValues = z.infer<typeof resetIdentifierSchema>;

export const resetCodeSchema = z.object({
  code: z
    .string()
    .min(1, "Enter the code we sent you")
    .regex(/^\d{6}$/, "The code is six digits"),
});

export type ResetCodeValues = z.infer<typeof resetCodeSchema>;

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/\d/, "Include a number"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

export const memberVerificationSchema = z.object({
  memberId: z
    .string()
    .min(1, "Enter your membership identifier")
    .regex(MEMBER_ID_PATTERN, "Member IDs look like KOI-2019-004821"),
});

export type MemberVerificationValues = z.infer<typeof memberVerificationSchema>;

/** Rough password strength for the signup meter. */
export function passwordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  if (!password) return { score: 0, label: "Enter a password" };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^\w\s]/.test(password)) score += 1;

  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"] as const;
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  return { score: clamped, label: labels[clamped] };
}
