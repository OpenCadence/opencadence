import { notFound } from "next/navigation";
import { cache } from "react";
import { Workspace } from "@/components/workspace";
import { ExternalChanges } from "@/components/external-changes";
import { getRevision, getWorkspace, isFirstRunPending } from "@/lib/db";
import { localDate } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const getSnapshot = cache(() => {
  // Read revision first so concurrent external writes trigger another refresh.
  const revision = getRevision();
  return { revision, data: getWorkspace() };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getSnapshot().data.projects.find((item) => item.id === id);
  return { title: `${project?.name || "Project not found"} · OpenCadence` };
}

export default async function ProjectRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { revision, data } = getSnapshot();
  const project = data.projects.find((item) => item.id === id);
  if (!project) notFound();
  return (
    <>
      <ExternalChanges revision={revision} />
      <Workspace
        data={data}
        view="projects"
        projectId={id}
        initialToday={localDate()}
        firstRunPending={isFirstRunPending()}
        hideExampleBanner={process.env.CADENCE_DEMO_MODE === "1"}
      />
    </>
  );
}
