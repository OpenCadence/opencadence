// Shared by web editors and their server-side optimistic concurrency check.
export const recordFields = {
  task: ["title", "project_id", "customer_id", "priority", "due", "state"],
  project: ["name", "description", "customer_id", "status", "due", "color"],
  customer: [
    "name",
    "contact",
    "email",
    "stage",
    "relationship_status",
    "follow_up",
    "details",
  ],
  note: ["title", "body", "project_id", "customer_id"],
} as const;

export type RecordKind = keyof typeof recordFields;
export function recordSnapshot(kind: RecordKind, record: object): string {
  return JSON.stringify(
    Object.fromEntries(
      recordFields[kind].map((field) => [
        field,
        (record as Record<string, unknown>)[field],
      ]),
    ),
  );
}
