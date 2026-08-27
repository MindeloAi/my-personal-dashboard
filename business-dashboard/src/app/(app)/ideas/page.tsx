import { Section } from "@/components/dashboard/section";
import { IdeasPanel } from "@/components/dashboard/ideas-panel";
import { getIdeas } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function IdeasPage() {
  const ideas = await getIdeas();
  return (
    <Section title="Ideas" description="Business ideas backlog.">
      <IdeasPanel ideas={ideas} />
    </Section>
  );
}
