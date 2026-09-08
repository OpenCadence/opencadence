import { getRevision } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return Response.json(
    { revision: getRevision() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
