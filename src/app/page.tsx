import { Workspace } from "@/components/workspace";
import { getWorkspace, getRevision, isFirstRunPending } from "@/lib/db";
import { ExternalChanges } from "@/components/external-changes";
import { localDate } from "@/lib/validation";
import type { View } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const selected: View =
    view && ["today", "tasks", "projects", "customers", "notes"].includes(view)
      ? (view as View)
      : "today";
  // Read revision first: a concurrent MCP write will then trigger another refresh.
  const revision = getRevision();
  return (
    <>
      <ExternalChanges revision={revision} />
      <Workspace
        data={getWorkspace()}
        view={selected}
        initialToday={localDate()}
        firstRunPending={isFirstRunPending()}
        hideExampleBanner={process.env.CADENCE_DEMO_MODE === "1"}
      />
    </>
  );
}
