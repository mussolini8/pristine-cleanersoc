import { z } from "zod";

const optionalString = z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional());
const optionalEmail = z.preprocess((value) => value === "" ? undefined : value, z.email().optional());
const optionalUrl = z.preprocess((value) => value === "" ? undefined : value, z.url().optional());

const publicEnvSchema = z.object({
  APP_BASE_URL: optionalUrl,
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverEnvSchema = publicEnvSchema.extend({
  GMAIL_USER: optionalString,
  GMAIL_APP_PASSWORD: optionalString,
  RESEND_API_KEY: optionalString,
  SENDGRID_API_KEY: optionalString,
  EMAIL_FROM: optionalString,
  ALLOW_GMAIL_SMTP_FALLBACK: optionalString,
  OPERATIONS_MANAGER_EMAIL: optionalEmail,
  OWNER_EMAIL: optionalEmail,
  SEO_USER_EMAIL: optionalEmail,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
});

export function getPublicEnv() {
  return publicEnvSchema.parse({
    APP_BASE_URL: process.env.APP_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function getServerEnv() {
  return serverEnvSchema.parse({
    APP_BASE_URL: process.env.APP_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    ALLOW_GMAIL_SMTP_FALLBACK: process.env.ALLOW_GMAIL_SMTP_FALLBACK,
    OPERATIONS_MANAGER_EMAIL: process.env.OPERATIONS_MANAGER_EMAIL,
    OWNER_EMAIL: process.env.OWNER_EMAIL,
    SEO_USER_EMAIL: process.env.SEO_USER_EMAIL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
