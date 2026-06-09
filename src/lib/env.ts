import { z } from "zod";

function preprocessEnv(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "undefined" || trimmed === "null") {
    return undefined;
  }
  return trimmed;
}

const optionalString = z.preprocess(preprocessEnv, z.string().min(1).optional());
const optionalEmail = z.preprocess(preprocessEnv, z.email().optional());
const optionalUrl = z.preprocess(preprocessEnv, z.url().optional());

const publicEnvSchema = z.object({
  APP_BASE_URL: optionalUrl,
  NEXT_PUBLIC_APP_URL: z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : val),
    z.url().default("http://localhost:3000")
  ),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : val),
    z.url()
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : val),
    z.string().min(1)
  ),
});

const serverEnvSchema = publicEnvSchema.extend({
  GMAIL_USER: optionalString,
  GMAIL_APP_PASSWORD: optionalString,
  OWNER_GMAIL_USER: optionalString,
  OWNER_GMAIL_APP_PASSWORD: optionalString,
  OPERATIONS_MANAGER_EMAIL: optionalEmail,
  OWNER_EMAIL: optionalEmail,
  SEO_USER_EMAIL: optionalEmail,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
});

function handleValidationError(error: z.ZodError, envData: Record<string, unknown>) {
  console.error("❌ Environment validation failed:");
  error.issues.forEach((issue) => {
    const path = issue.path.join(".");
    const value = envData[path];
    const isSensitive =
      path.toLowerCase().includes("password") ||
      path.toLowerCase().includes("key") ||
      path.toLowerCase().includes("secret");
    const safeValue = isSensitive ? "[REDACTED]" : JSON.stringify(value);
    console.error(`  - Field "${path}" has invalid value ${safeValue}. Reason: ${issue.message}`);
  });
}

export function getPublicEnv() {
  const envData = {
    APP_BASE_URL: process.env.APP_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  const result = publicEnvSchema.safeParse(envData);
  if (!result.success) {
    handleValidationError(result.error, envData);
    throw new Error("Invalid public environment variables configuration");
  }
  return result.data;
}

export function getServerEnv() {
  const envData = {
    APP_BASE_URL: process.env.APP_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    OWNER_GMAIL_USER: process.env.OWNER_GMAIL_USER,
    OWNER_GMAIL_APP_PASSWORD: process.env.OWNER_GMAIL_APP_PASSWORD,
    OPERATIONS_MANAGER_EMAIL: process.env.OPERATIONS_MANAGER_EMAIL,
    OWNER_EMAIL: process.env.OWNER_EMAIL,
    SEO_USER_EMAIL: process.env.SEO_USER_EMAIL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const result = serverEnvSchema.safeParse(envData);
  if (!result.success) {
    handleValidationError(result.error, envData);
    throw new Error("Invalid server environment variables configuration");
  }
  return result.data;
}
