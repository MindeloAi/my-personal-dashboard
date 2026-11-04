import { requireAdminPage } from "@/lib/auth";
import { liveConnections } from "@/lib/oauth-db";
import { PageHeader } from "@/components/dashboard/explain";
import { DisconnectButton } from "./disconnect-button";

export const dynamic = "force-dynamic";

export default async function ClaudePage() {
  const admin = await requireAdminPage();
  const n = await liveConnections(admin.id);
  return (
    <div className="space-y-3">
      <PageHeader
        title="Claude"
        purpose="Claude reaches the dashboard through the Mindelo connector. Connect it in the Claude app under Settings, Connectors, with https://mindelo.site/api/mcp, or in Claude Code with claude mcp add. Lost a phone? Disconnect here, then connect again."
      />
      <section className="max-w-xl border border-[#DCE1E8] bg-white p-4 sm:p-5 space-y-3">
        <p className="text-sm text-[#1B2533]">
          {n === 0 ? "Claude is not connected for you." : `Claude is connected for you in ${n} ${n === 1 ? "app" : "apps"}.`}
        </p>
        <p className="text-xs text-[#5A6678]">Disconnecting only affects your own sign-in ({admin.email}). The other founders stay connected.</p>
        <DisconnectButton />
      </section>
    </div>
  );
}
