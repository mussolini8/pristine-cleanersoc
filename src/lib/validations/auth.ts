import { z } from "zod";

export const emailSchema = z.email("Enter a valid email address").trim().toLowerCase();
export const loginIdentifierSchema = z
  .string()
  .min(2, "Enter your username or email")
  .trim()
  .toLowerCase();

export const signInSchema = z.object({
  email: loginIdentifierSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signUpSchema = signInSchema.extend({
  fullName: z.string().min(2, "Name must be at least 2 characters").trim(),
});

export type AuthFormState = {
  message?: string;
  errors?: Record<string, string[]>;
};
