import { format } from "date-fns";
import { Section } from "@/components/dashboard/section";
import { VaultProjects } from "@/components/dashboard/vault-projects";
import { VaultActivity } from "@/components/dashboard/vault-activity";
import { getVaultProjects, getVaultActivity, getVaultSyncedAt } from "@/lib/vault";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function VaultPage() {
  const projects = getVaultProjects();
  const activity = getVaultActivity();
  const syncedAt = getVaultSyncedAt();

  return (
    <Section
      title="Vault"
      description="Visual index of the Obsidian vault — every project note, filterable."
      action={
        syncedAt ? (
          <span className="text-[10px] text-zinc-600">
            Synced {format(new Date(syncedAt), "MMM d, h:mm a")}
          </span>
        ) : null
      }
    >
      <div className="space-y-3">
        <VaultProjects projects={projects} />
        {activity.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Recent activity
            </p>
            <VaultActivity activity={activity} />
          </div>
        )}
      </div>
    </Section>
  );
}
