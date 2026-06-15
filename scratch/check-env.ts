import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

console.log("SUPABASE_SERVICE_ROLE_KEY present:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("SUPABASE_SERVICE_ROLE_KEY prefix:", process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10));
