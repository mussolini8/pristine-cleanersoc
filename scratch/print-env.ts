import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
console.log("Service key exists:", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));
console.log("Service key value starts with:", process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10));
