import { randomUUID } from "node:crypto";
import { db } from "./storage";
import { text, date, choice, email } from "./validation";
import {
  activityKinds,
  relationshipStatuses,
  relationshipStatusForStage,
  stages,
  taskStates,
  type TimelineEventType,
} from "./types";
import { recordSnapshot } from "./record-fields";

export const itemTables = {
  task: "tasks",
  project: "projects",
  customer: "customers",
  note: "notes",
} as const;
export type ItemKind = keyof typeof itemTables;

export function assertKind(kind: string): asserts kind is ItemKind {
  if (!Object.hasOwn(itemTables, kind)) throw new Error("Invalid item type.");
}
export function existing(table: string, id: string) {
  if (typeof id !== "string" || !id || id.length > 100)
    throw new Error("Invalid item ID.");
  // Table names are internal constants, never caller-supplied SQL.
  if (![...Object.values(itemTables), "activities"].includes(table))
    throw new Error("Invalid item type.");
  const row = db().prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
  if (!row)
    throw new Error("This item no longer exists. Check its ID and try again.");
  return { ...row };
}
function ref(data: FormData, field: string, table: "projects" | "customers") {
  const id = text(data, field, 100);
  if (id && !db().prepare(`SELECT id FROM ${table} WHERE id=?`).get(id))
    throw new Error(
      "That linked item no longer exists. Please choose another.",
    );
  return id || null;
}
function recordTimelineEvent(input: {
  customerId: string | null;
  projectId?: string | null;
  kind: "Relationship" | "Project" | "Follow-up";
  eventType: TimelineEventType;
  body: string;
}) {
  if (!input.customerId) return;
  db()
    .prepare(
      "INSERT INTO activities(id,customer_id,project_id,body,kind,event_type) VALUES (?,?,?,?,?,?)",
    )
    .run(
      randomUUID(),
      input.customerId,
      input.projectId || null,
      input.body,
      input.kind,
      input.eventType,
    );
}
function recordLeadConversionIfNeeded(
  customerId: string,
  previousStatus: string | undefined,
  nextStatus: string,
) {
  if (previousStatus !== "Lead" || nextStatus !== "Client") return;
  recordTimelineEvent({
    customerId,
    kind: "Relationship",
    eventType: "lead_converted",
    body: "Lead converted to client.",
  });
}
export function transaction<T>(operation: () => T): T {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    d.exec("COMMIT");
    return result;
  } catch (error) {
    d.exec("ROLLBACK");
    throw error;
  }
}

/** Reject stale full-form saves instead of overwriting newer UI/MCP changes. */
export function saveWebRecord(data: FormData): string {
  const kind = choice(data, "kind", [
    "task",
    "project",
    "customer",
    "note",
  ] as const);
  const id = text(data, "id", 100);
  if (!id) return transaction(() => saveRecord(data));
  const original = text(data, "original", 400000, true);
  return transaction(() => {
    const current = existing(itemTables[kind], id);
    if (recordSnapshot(kind, current) !== original) {
      throw new Error(
        "This item changed after you opened it. Your draft has not been saved. Copy any changes you want to keep, then reopen the item to load the latest version.",
      );
    }
    return saveRecord(data);
  });
}

type ExistingRecord = ReturnType<typeof existing> | undefined;

function saveTask(
  data: FormData,
  id: string,
  updating: boolean,
  previous: ExistingRecord,
) {
  const database = db();
  const projectId = ref(data, "project_id", "projects");
  const customerId = ref(data, "customer_id", "customers");
  if (projectId && customerId) {
    const linkedCustomer = database
      .prepare("SELECT customer_id FROM projects WHERE id=?")
      .get(projectId)?.customer_id;
    if (linkedCustomer !== customerId) {
      throw new Error(
        "The selected project belongs to a different client. Choose matching links or remove one.",
      );
    }
  }
  const state =
    data.get("state") === null
      ? updating
        ? (previous!.state as string)
        : "actionable"
      : choice(data, "state", taskStates);
  const values = [
    text(data, "title", 200, true),
    projectId,
    customerId,
    choice(data, "priority", ["Normal", "High"]),
    date(data, "due"),
    state,
  ];
  if (updating) {
    database
      .prepare(
        "UPDATE tasks SET title=?,project_id=?,customer_id=?,priority=?,due=?,state=?,is_demo=0 WHERE id=?",
      )
      .run(...values, id);
  } else {
    database
      .prepare(
        "INSERT INTO tasks(title,project_id,customer_id,priority,due,state,id) VALUES (?,?,?,?,?,?,?)",
      )
      .run(...values, id);
  }
}

function saveProject(
  data: FormData,
  id: string,
  updating: boolean,
  previous: ExistingRecord,
) {
  const database = db();
  const customerId = ref(data, "customer_id", "customers");
  const name = text(data, "name", 200, true);
  const status = choice(data, "status", ["Active", "Paused", "Completed"]);
  const values = [
    name,
    text(data, "description", 4000),
    customerId,
    status,
    date(data, "due"),
    choice(data, "color", ["green", "purple", "orange", "blue"]),
  ];
  if (updating) {
    database
      .prepare(
        "UPDATE projects SET name=?,description=?,customer_id=?,status=?,due=?,color=?,is_demo=0 WHERE id=?",
      )
      .run(...values, id);
    if (previous?.customer_id !== customerId) {
      database
        .prepare(
          "UPDATE tasks SET customer_id=? WHERE project_id=? AND customer_id IS NOT ?",
        )
        .run(customerId, id, customerId);
    }
  } else {
    database
      .prepare(
        "INSERT INTO projects(name,description,customer_id,status,due,color,id) VALUES (?,?,?,?,?,?,?)",
      )
      .run(...values, id);
  }
  const previousStatus = previous?.status as string | undefined;
  if (customerId && status === "Completed" && previousStatus !== "Completed") {
    recordTimelineEvent({
      customerId,
      projectId: id,
      kind: "Project",
      eventType: "project_completed",
      body: `Project completed: ${name}`,
    });
  } else if (customerId && status === "Active" && previousStatus !== "Active") {
    recordTimelineEvent({
      customerId,
      projectId: id,
      kind: "Project",
      eventType: "project_started",
      body: `Project started: ${name}`,
    });
  }
}

function saveCustomer(
  data: FormData,
  id: string,
  updating: boolean,
  previous: ExistingRecord,
) {
  const stage = choice(data, "stage", stages);
  const requestedRelationship = choice(
    data,
    "relationship_status",
    relationshipStatuses,
  );
  const enteredTerminalStage =
    (stage === "Won" || stage === "Lost") &&
    (!previous || previous.stage !== stage);
  const relationshipStatus = enteredTerminalStage
    ? relationshipStatusForStage(stage)
    : requestedRelationship;
  const followUp = date(data, "follow_up");
  const values = [
    text(data, "name", 200, true),
    text(data, "contact", 200),
    email(data),
    stage,
    relationshipStatus,
    followUp,
    text(data, "details", 6000),
  ];
  const database = db();
  if (updating) {
    database
      .prepare(
        "UPDATE customers SET name=?,contact=?,email=?,stage=?,relationship_status=?,follow_up=?,details=?,is_demo=0 WHERE id=?",
      )
      .run(...values, id);
  } else {
    database
      .prepare(
        "INSERT INTO customers(name,contact,email,stage,relationship_status,follow_up,details,id) VALUES (?,?,?,?,?,?,?,?)",
      )
      .run(...values, id);
  }
  const previousRelationship = previous?.relationship_status as
    string | undefined;
  const previousFollowUp = (previous?.follow_up as string | undefined) || "";
  recordLeadConversionIfNeeded(id, previousRelationship, relationshipStatus);
  if (previousFollowUp !== followUp && (previous || followUp)) {
    const body = followUp
      ? previousFollowUp
        ? `Follow-up moved from ${previousFollowUp} to ${followUp}.`
        : `Follow-up set for ${followUp}.`
      : `Follow-up cleared (was ${previousFollowUp}).`;
    recordTimelineEvent({
      customerId: id,
      kind: "Follow-up",
      eventType: "follow_up_changed",
      body,
    });
  }
}

function saveNote(data: FormData, id: string, updating: boolean) {
  const values = [
    text(data, "title", 200, true),
    text(data, "body", 50000, false, "preserve"),
    ref(data, "project_id", "projects"),
    ref(data, "customer_id", "customers"),
  ];
  const database = db();
  if (updating) {
    database
      .prepare(
        "UPDATE notes SET title=?,body=?,project_id=?,customer_id=?,is_demo=0,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
      )
      .run(...values, id);
  } else {
    database
      .prepare(
        "INSERT INTO notes(title,body,project_id,customer_id,id) VALUES (?,?,?,?,?)",
      )
      .run(...values, id);
  }
}

/** Shared validated writes. Callers own the transaction, including timeline events. */
export function saveRecord(data: FormData): string {
  const kind = choice(data, "kind", [
    "task",
    "project",
    "customer",
    "note",
  ] as const);
  const inputId = text(data, "id", 100);
  const id = inputId || randomUUID();
  const previous = inputId ? existing(itemTables[kind], id) : undefined;
  const save = {
    task: saveTask,
    project: saveProject,
    customer: saveCustomer,
    note: saveNote,
  }[kind];
  save(data, id, !!inputId, previous);
  return id;
}
export function setTaskCompleted(id: string, done: boolean) {
  if (typeof done !== "boolean") throw new Error("Invalid task update.");
  existing("tasks", id);
  db()
    .prepare("UPDATE tasks SET done=?,is_demo=0 WHERE id=?")
    .run(done ? 1 : 0, id);
}
export function setCustomerStage(id: string, stage: string) {
  if (!(stages as readonly string[]).includes(stage))
    throw new Error("Invalid pipeline stage.");
  transaction(() => {
    const previous = existing("customers", id);
    const lifecycle = relationshipStatusForStage(
      stage as (typeof stages)[number],
    );
    db()
      .prepare(
        "UPDATE customers SET stage=?,relationship_status=?,is_demo=0 WHERE id=?",
      )
      .run(stage, lifecycle, id);
    recordLeadConversionIfNeeded(
      id,
      previous.relationship_status as string,
      lifecycle,
    );
  });
}
export function logActivity(data: FormData): string {
  const customer = ref(data, "customer_id", "customers");
  if (!customer) throw new Error("Please choose a client.");
  const body = text(data, "body", 10000, true);
  const kind = choice(data, "activity_kind", activityKinds);
  return transaction(() => {
    const id = randomUUID();
    db()
      .prepare(
        "INSERT INTO activities(id,customer_id,body,kind) VALUES (?,?,?,?)",
      )
      .run(id, customer, body, kind);
    db().prepare("UPDATE customers SET is_demo=0 WHERE id=?").run(customer);
    return id;
  });
}
export function removeRecord(kind: string, id: string) {
  assertKind(kind);
  existing(itemTables[kind], id);
  db().prepare(`DELETE FROM ${itemTables[kind]} WHERE id=?`).run(id);
}

/** Reject destructive changes unless the caller saw the current workspace revision. */
export function removeWebRecord(kind: string, id: string, revision: number) {
  assertKind(kind);
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error("Invalid workspace revision.");
  transaction(() => {
    existing(itemTables[kind], id);
    const currentRevision = Number(
      db().prepare("SELECT value FROM meta WHERE key='revision'").get()
        ?.value || 0,
    );
    if (currentRevision !== revision) {
      throw new Error(
        "The workspace changed after you opened this item. It has not been deleted. Reopen it to review the latest version.",
      );
    }
    removeRecord(kind, id);
  });
}
function deleteExampleRows() {
  for (const table of ["activities", "notes", "tasks", "projects", "customers"])
    db().prepare(`DELETE FROM ${table} WHERE is_demo=1`).run();
}

export function removeExamples() {
  transaction(deleteExampleRows);
}

export function completeFirstRun(choice: string) {
  if (choice !== "examples" && choice !== "empty")
    throw new Error("Choose an example workspace or an empty workspace.");
  transaction(() => {
    if (choice === "empty") deleteExampleRows();
    db().prepare("DELETE FROM meta WHERE key='first_run_pending'").run();
    // Metadata changes must wake other open browser tabs too.
    db()
      .prepare(
        "UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key='revision'",
      )
      .run();
  });
}
