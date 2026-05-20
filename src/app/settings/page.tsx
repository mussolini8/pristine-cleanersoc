import { UnifiedOperationsClient } from "@/components/operations/unified-operations-client";
import { getServerEnv } from "@/lib/env";
import { requireAreaAccess } from "@/lib/server-access";

export default async function SettingsPage() {
  await requireAreaAccess("operations");
  const env = getServerEnv();

  return (
    <UnifiedOperationsClient
      view="settings"
      envStatus={{
        gmailUser: Boolean(env.GMAIL_USER),
        ownerEmail: Boolean(env.OWNER_EMAIL),
        operationsManagerEmail: Boolean(env.OPERATIONS_MANAGER_EMAIL),
        seoUserEmail: Boolean(env.SEO_USER_EMAIL),
      }}
    />
  );
}
