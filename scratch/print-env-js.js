const pkg = require('@next/env');
pkg.loadEnvConfig(process.cwd());
console.log("Service key exists:", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));
console.log("Service key starts with:", process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10));
