import { notFound } from "next/navigation";
import { cache } from "react";
import { Workspace } from "@/components/workspace";
import { ExternalChanges } from "@/components/external-changes";
import { getRevision, getWorkspace, isFirstRunPending } from "@/lib/db";
import { localDate } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const getSnapshot = cache(() => {
  const revision = getRevision();
  return { revision, data: getWorkspace() };
});

export async function generateMetadata({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const client = getSnapshot().data.customers.find((item) => item.id === id);
  return { title: `${client?.name || "Relationship not found"} · OpenCadence` };
}

export default async function ClientRoute({
  params,
}: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const { revision, data } = getSnapshot();
  const client = data.customers.find((item) => item.id === id);
  if (!client) notFound();
  return (
    <>
      <ExternalChanges revision={revision} />
      <Workspace
        data={data}
        view="customers"
        clientId={id}
        initialToday={localDate()}
        firstRunPending={isFirstRunPending()}
        hideExampleBanner={process.env.CADENCE_DEMO_MODE === "1"}
      />
    </>
  );
}
