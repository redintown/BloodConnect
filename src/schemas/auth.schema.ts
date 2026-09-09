import { z } from "zod";
import { SELF_ASSIGNABLE_ROLES } from "@/lib/constants/roles";

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .transform((value) => value.toLowerCase()),
    phone: z
      .string()
      .trim()
      .min(7, "Enter a valid phone number.")
      .max(20)
      .regex(/^[0-9+\-\s()]+$/, "Enter a valid phone number."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
    initialRole: z.enum(SELF_ASSIGNABLE_ROLES, {
      errorMap: () => ({ message: "Select a role." }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Enter your password."),
});

export type LoginInput = z.infer<typeof loginSchema>;
