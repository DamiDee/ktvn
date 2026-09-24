import { z } from "zod";

/** Validation schemas shared by the auth forms. */

/**
 * Every code the product sends is seven digits.
 *
 * Kept in one place so the schema, the input and the copy can never drift
 * apart.
 */
export const CODE_LENGTH = 7;
const CODE_PATTERN = new RegExp(`^\\d{${CODE_LENGTH}}$`);
const CODE_MESSAGE = `The code is ${CODE_LENGTH} digits`;

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Enter your email or phone number")
    .refine(
      (value) => value.includes("@") || /^\+?[\d\s-]{7,}$/.test(value),
      "That doesn't look like an email or phone number",
    ),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean().optional(),
});

export type LoginValues = z.infer<typeof loginSchema>;
export const liveLoginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or username"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean().optional(),
});

export const signUpSchema = z
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
export const liveSignUpSchema = signUpSchema.safeExtend({
  username: z.string().trim().min(3, "Use at least 3 characters for your username"),
  address: z.string().trim().min(3, "Enter your address"),
  country: z.string().trim().min(2, "Enter your country"),
});
export type LiveSignUpValues = z.infer<typeof liveSignUpSchema>;

export const resetIdentifierSchema = z.object({
  identifier: z
    .string()
    .min(1, "Enter your email or phone number")
    .refine(
      (value) => value.includes("@") || /^\+?[\d\s-]{7,}$/.test(value),
      "That doesn't look like an email or phone number",
    ),
});

export type ResetIdentifierValues = z.infer<typeof resetIdentifierSchema>;

export const resetCodeSchema = z.object({
  code: z
    .string()
    .min(1, "Enter the code we sent you")
    .regex(CODE_PATTERN, CODE_MESSAGE),
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

/** Membership is confirmed by a code sent to the member's email address. */
export const emailRequestSchema = z.object({
  email: z.string().min(1, "Enter your email").email("Enter a valid email"),
});

export type EmailRequestValues = z.infer<typeof emailRequestSchema>;

export const emailCodeSchema = z.object({
  code: z
    .string()
    .min(1, "Enter the code we emailed you")
    .regex(CODE_PATTERN, CODE_MESSAGE),
});

export type EmailCodeValues = z.infer<typeof emailCodeSchema>;

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
