import { SimpleOperationsClient } from "@/components/operations/simple-operations-client";
import { getServerEnv } from "@/lib/env";
import { requireAreaAccess } from "@/lib/server-access";

export default async function SettingsPage() {
  await requireAreaAccess("operations");
  const env = getServerEnv();

  return (
    <SimpleOperationsClient
      view="settings"
      envStatus={{
        appBaseUrl: Boolean(env.APP_BASE_URL),
        gmailUser: Boolean(env.GMAIL_USER),
        gmailPassword: Boolean(env.GMAIL_APP_PASSWORD),
        ownerEmail: Boolean(env.OWNER_EMAIL),
        operationsManagerEmail: Boolean(env.OPERATIONS_MANAGER_EMAIL),
        ownerGmailUser: Boolean(env.OWNER_GMAIL_USER),
        ownerGmailPassword: Boolean(env.OWNER_GMAIL_APP_PASSWORD),
        seoUserEmail: Boolean(env.SEO_USER_EMAIL),
      }}
    />
  );
}
