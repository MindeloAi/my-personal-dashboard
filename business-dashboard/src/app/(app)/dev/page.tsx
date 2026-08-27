import { Suspense } from "react";
import { Section } from "@/components/dashboard/section";
import { DevHub } from "@/components/dashboard/dev-hub";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DevPage() {
  return (
    <Section title="Dev" description="Repos, live deploy links, and coding-task queue.">
      <Suspense
        fallback={
          <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6 text-sm text-zinc-500">
            Loading repos…
          </div>
        }
      >
        <DevHub />
      </Suspense>
    </Section>
  );
}
