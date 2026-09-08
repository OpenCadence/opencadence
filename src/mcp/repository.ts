import type { SQLInputValue } from "node:sqlite";
import { db, getRevision, getWorkspace, readSnapshot } from "../lib/storage";
import {
  existing,
  itemTables,
  saveRecord,
  transaction,
  setTaskCompleted,
  logActivity,
  type ItemKind,
} from "../lib/mutations";
import {
  relationshipStatusForStage,
  type ActivityKind,
  type Stage,
} from "../lib/types";
import { localDate } from "../lib/validation";
import { attentionRelationshipStatuses, getAttention } from "../lib/attention";

type Fields = Record<string, unknown>;
const defaults: Record<ItemKind, Fields> = {
  task: {
    priority: "Normal",
    due: "",
    state: "actionable",
    project_id: null,
    customer_id: null,
  },
  project: {
    description: "",
    status: "Active",
    due: "",
    color: "green",
    customer_id: null,
  },
  customer: {
    contact: "",
    email: "",
    stage: "Prospect",
    relationship_status: "Lead",
    follow_up: "",
    details: "",
  },
  note: { body: "", project_id: null, customer_id: null },
};
function formData(fields: Fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields))
    if (value !== undefined) form.set(key, value === null ? "" : String(value));
  return form;
}
export function getItem(kind: ItemKind, id: string) {
  return existing(itemTables[kind], id);
}
export function createItem(kind: ItemKind, fields: Fields) {
  return transaction(() => {
    const normalized = { ...fields };
    if (
      kind === "customer" &&
      normalized.relationship_status === undefined &&
      typeof normalized.stage === "string"
    )
      normalized.relationship_status = relationshipStatusForStage(
        normalized.stage as Stage,
      );
    const id = saveRecord(formData({ ...defaults[kind], ...normalized, kind }));
    return { item: getItem(kind, id) };
  });
}
export function updateItem(kind: ItemKind, fields: Fields) {
  const { id, ...patch } = fields;
  if (!Object.values(patch).some((value) => value !== undefined))
    throw new Error("Provide at least one field to update.");
  return transaction(() => {
    // Read and merge under the write lock to preserve omitted fields across clients.
    const previous = getItem(kind, String(id));
    const changes = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
    if (
      kind === "customer" &&
      patch.relationship_status === undefined &&
      typeof patch.stage === "string"
    )
      changes.relationship_status = relationshipStatusForStage(
        patch.stage as Stage,
      );
    saveRecord(formData({ ...previous, ...changes, kind, id }));
    if (kind === "task" && typeof patch.done === "boolean")
      setTaskCompleted(String(id), patch.done);
    return { item: getItem(kind, String(id)) };
  });
}
export function completeTask(id: string, completed: boolean) {
  return transaction(() => {
    setTaskCompleted(id, completed);
    return { item: getItem("task", id) };
  });
}
export function createActivity(fields: {
  customer_id: string;
  body: string;
  kind: ActivityKind;
}) {
  const id = logActivity(formData({ ...fields, activity_kind: fields.kind }));
  return { item: existing("activities", id) };
}

function literal(value: string) {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}
function conditions() {
  const where: string[] = [];
  const values: SQLInputValue[] = [];
  return {
    where,
    values,
    add(sql: string, value?: SQLInputValue) {
      where.push(sql);
      if (value !== undefined) values.push(value);
    },
  };
}
type Conditions = ReturnType<typeof conditions>;
function filteredLink(c: Conditions, column: string, value: unknown) {
  if (value === null) c.add(`${column} IS NULL`);
  else if (typeof value === "string") c.add(`${column}=?`, value);
}
function search(c: Conditions, columns: string[], query: unknown) {
  if (typeof query !== "string" || !query) return;
  c.where.push(
    `(${columns.map((column) => `${column} LIKE ? ESCAPE '\\'`).join(" OR ")})`,
  );
  c.values.push(...columns.map(() => literal(query)));
}
function pageResult<T>(
  items: T[],
  total: number,
  limit: number,
  offset: number,
) {
  return {
    items,
    total,
    limit,
    offset,
    next_offset: offset + items.length < total ? offset + items.length : null,
  };
}
function paginate(
  table: string,
  c: Conditions,
  order: string,
  input: Fields,
  columns = "*",
) {
  return readSnapshot(() => {
    const clause = c.where.length ? ` WHERE ${c.where.join(" AND ")}` : "";
    const limit = Number(input.limit ?? 25);
    const offset = Number(input.offset ?? 0);
    const total = Number(
      db()
        .prepare(`SELECT count(*) AS count FROM ${table}${clause}`)
        .get(...c.values)?.count || 0,
    );
    const items = db()
      .prepare(
        `SELECT ${columns} FROM ${table}${clause} ORDER BY ${order} LIMIT ? OFFSET ?`,
      )
      .all(...c.values, limit, offset)
      .map((row) => ({ ...row }));
    return pageResult(items, total, limit, offset);
  });
}
export function listItems(kind: ItemKind, input: Fields) {
  const c = conditions();
  if (input.include_examples === false) c.add("is_demo=0");
  let order = "created_at DESC, id";
  let columns = "*";
  if (kind === "task") {
    if ((input.status ?? "open") !== "all")
      c.add("done=?", input.status === "completed" ? 1 : 0);
    filteredLink(c, "project_id", input.project_id);
    filteredLink(c, "customer_id", input.customer_id);
    if (typeof input.priority === "string") c.add("priority=?", input.priority);
    if (typeof input.state === "string") c.add("state=?", input.state);
    if (typeof input.due_on === "string") c.add("due=?", input.due_on);
    if (typeof input.due_before === "string")
      c.add("(due<>'' AND due<=?)", input.due_before);
    if (typeof input.due_after === "string")
      c.add("(due<>'' AND due>=?)", input.due_after);
    search(c, ["title"], input.query);
    order =
      "done, CASE WHEN due='' THEN 1 ELSE 0 END, due, CASE WHEN priority='High' THEN 0 ELSE 1 END, created_at DESC, id";
  } else if (kind === "project") {
    filteredLink(c, "customer_id", input.customer_id);
    if (typeof input.status === "string" && input.status !== "all")
      c.add("status=?", input.status);
    search(c, ["name", "description"], input.query);
    columns =
      "id,name,customer_id,status,due,color,is_demo,created_at,substr(description,1,300) AS description_excerpt";
  } else if (kind === "customer") {
    if (typeof input.stage === "string") c.add("stage=?", input.stage);
    if (typeof input.relationship_status === "string")
      c.add("relationship_status=?", input.relationship_status);
    search(c, ["name", "contact", "email", "details"], input.query);
    columns =
      "id,name,contact,email,stage,relationship_status,follow_up,is_demo,created_at,substr(details,1,300) AS details_excerpt";
  } else {
    filteredLink(c, "project_id", input.project_id);
    filteredLink(c, "customer_id", input.customer_id);
    search(c, ["title", "body"], input.query);
    order = "updated_at DESC, id";
    columns =
      "id,title,project_id,customer_id,is_demo,created_at,updated_at,substr(body,1,300) AS excerpt";
  }
  return paginate(itemTables[kind], c, order, input, columns);
}
export function listActivities(input: Fields) {
  existing("customers", String(input.customer_id));
  const c = conditions();
  c.add("customer_id=?", String(input.customer_id));
  if (input.include_examples === false) c.add("is_demo=0");
  return paginate("activities", c, "created_at DESC, id", input);
}
export function listFollowUps(input: Fields) {
  const c = conditions();
  c.add("follow_up<>''");
  c.add(
    `relationship_status IN (${attentionRelationshipStatuses.map(() => "?").join(",")})`,
  );
  c.values.push(...attentionRelationshipStatuses);
  if (typeof input.due_before === "string")
    c.add("follow_up<=?", input.due_before);
  if (input.include_examples === false) c.add("is_demo=0");
  return paginate(
    "customers",
    c,
    "follow_up, name, id",
    input,
    "id,name,contact,email,stage,relationship_status,follow_up,is_demo",
  );
}
export function todaySummary(day = localDate(), includeExamples = true) {
  return readSnapshot(() => {
    const workspace = getWorkspace();
    const visible = includeExamples
      ? workspace
      : {
          ...workspace,
          tasks: workspace.tasks.filter((item) => !item.is_demo),
          customers: workspace.customers.filter((item) => !item.is_demo),
        };
    const attention = getAttention(visible, day);
    const attentionPage = <T>(items: T[]) =>
      pageResult(items.slice(0, 100), items.length, 100, 0);
    const projects = listItems("project", {
      include_examples: includeExamples,
      limit: 100,
      offset: 0,
      status: "Active",
    });
    return {
      date: day,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      revision: getRevision(),
      counts: {
        tasks_due: attention.dueTasks.length,
        actions_due: attention.actions.length,
        waiting_on_me: attention.waitingOnMe.length,
        waiting_on_clients: attention.waitingOnClients.length,
        follow_ups_due: attention.dueFollowUps.length,
        active_projects: projects.total,
      },
      tasks: attentionPage(attention.dueTasks),
      actions: attentionPage(attention.actions),
      waiting_on_me: attentionPage(attention.waitingOnMe),
      waiting_on_clients: attentionPage(attention.waitingOnClients),
      follow_ups: attentionPage(attention.dueFollowUps),
      active_projects: projects,
    };
  });
}
export function searchWorkspace(input: {
  query: string;
  kind?: ItemKind;
  limit: number;
  offset: number;
  include_examples: boolean;
}) {
  return readSnapshot(() => {
    const parts: string[] = [];
    const values: SQLInputValue[] = [];
    const sources = [
      { kind: "task", table: "tasks", title: "title", body: "title" },
      {
        kind: "project",
        table: "projects",
        title: "name",
        body: "description",
      },
      {
        kind: "customer",
        table: "customers",
        title: "name",
        body: "contact || ' ' || email || ' ' || details",
      },
      { kind: "note", table: "notes", title: "title", body: "body" },
    ];
    for (const source of sources) {
      if (input.kind && input.kind !== source.kind) continue;
      parts.push(
        `SELECT '${source.kind}' AS kind,id,${source.title} AS title,substr(${source.body},1,300) AS excerpt,is_demo,created_at FROM ${source.table} WHERE (${source.title} LIKE ? ESCAPE '\\' OR (${source.body}) LIKE ? ESCAPE '\\') ${input.include_examples ? "" : "AND is_demo=0"}`,
      );
      values.push(literal(input.query), literal(input.query));
    }
    const union = `(${parts.join(" UNION ALL ")})`;
    const total = Number(
      db()
        .prepare(`SELECT count(*) AS count FROM ${union}`)
        .get(...values)?.count || 0,
    );
    const items = db()
      .prepare(
        `SELECT * FROM ${union} ORDER BY created_at DESC,kind,id LIMIT ? OFFSET ?`,
      )
      .all(...values, input.limit, input.offset)
      .map((row) => ({ ...row }));
    return pageResult(items, total, input.limit, input.offset);
  });
}
