import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  db,
  getWorkspace,
  getRevision,
  readSnapshot,
} from "../src/lib/storage";
import {
  existing,
  saveRecord,
  saveWebRecord,
  setTaskCompleted,
  logActivity,
  removeWebRecord,
  completeFirstRun,
} from "../src/lib/mutations";
import { recordSnapshot } from "../src/lib/record-fields";
import { listItems } from "../src/mcp/repository";

const directory = mkdtempSync(join(tmpdir(), "cadence-mutations-"));
process.env.DATABASE_PATH = join(directory, "test.sqlite");
const d = db();
after(() => {
  d.close();
  rmSync(directory, { recursive: true, force: true });
});
function form(values: Record<string, unknown>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values))
    result.set(key, value == null ? "" : String(value));
  return result;
}

test("automatic client timeline events cover relationship and project milestones", () => {
  const customerId = saveRecord(
    form({
      kind: "customer",
      name: "Timeline lead",
      stage: "Prospect",
      relationship_status: "Lead",
    }),
  );
  const projectId = saveRecord(
    form({
      kind: "project",
      name: "Timeline project",
      customer_id: customerId,
      status: "Active",
      color: "green",
    }),
  );
  saveRecord(
    form({
      kind: "customer",
      id: customerId,
      name: "Timeline lead",
      stage: "Won",
      relationship_status: "Lead",
      follow_up: "2026-06-01",
    }),
  );
  saveRecord(
    form({
      kind: "project",
      id: projectId,
      name: "Timeline project",
      customer_id: customerId,
      status: "Completed",
      color: "green",
    }),
  );

  const events = getWorkspace().activities.filter(
    (activity) => activity.customer_id === customerId,
  );
  assert.deepEqual(events.map((event) => event.event_type).sort(), [
    "follow_up_changed",
    "lead_converted",
    "project_completed",
    "project_started",
  ]);
  assert.equal(
    events.find((event) => event.event_type === "project_started")?.project_id,
    projectId,
  );
  assert.equal(
    events.find((event) => event.event_type === "project_completed")
      ?.project_id,
    projectId,
  );
});

test("project relinks do not invent milestone events", () => {
  const firstCustomerId = saveRecord(
    form({
      kind: "customer",
      name: "First client",
      stage: "Won",
      relationship_status: "Client",
    }),
  );
  const secondCustomerId = saveRecord(
    form({
      kind: "customer",
      name: "Second client",
      stage: "Won",
      relationship_status: "Client",
    }),
  );
  const projectId = saveRecord(
    form({
      kind: "project",
      name: "Relinked project",
      customer_id: firstCustomerId,
      status: "Active",
      color: "green",
    }),
  );
  const before = getWorkspace().activities.length;
  saveRecord(
    form({
      kind: "project",
      id: projectId,
      name: "Relinked project",
      customer_id: secondCustomerId,
      status: "Active",
      color: "green",
    }),
  );
  assert.equal(getWorkspace().activities.length, before);
});

test("editing project details does not rewrite linked tasks", () => {
  const projectId = saveRecord(
    form({
      kind: "project",
      name: "Stable project",
      status: "Active",
      color: "green",
    }),
  );
  saveRecord(
    form({
      kind: "task",
      title: "Stable task",
      project_id: projectId,
      priority: "Normal",
      state: "actionable",
    }),
  );
  const before = getRevision();

  saveRecord(
    form({
      kind: "project",
      id: projectId,
      name: "Renamed project",
      status: "Active",
      color: "green",
    }),
  );

  assert.equal(getRevision(), before + 1);
});

test("initial follow-up scheduling is timeline-worthy", () => {
  const customerId = saveRecord(
    form({
      kind: "customer",
      name: "Follow-up lead",
      stage: "Prospect",
      relationship_status: "Lead",
      follow_up: "2026-05-01",
    }),
  );
  const event = getWorkspace().activities.find(
    (activity) => activity.customer_id === customerId,
  );
  assert.equal(event?.event_type, "follow_up_changed");
  assert.match(event?.body || "", /Follow-up set/);
});

test("unchanged and non-lead relationship saves do not create noisy timeline events", () => {
  const customerId = saveRecord(
    form({
      kind: "customer",
      name: "Quiet client",
      stage: "Lost",
      relationship_status: "Archived",
      follow_up: "2026-05-01",
    }),
  );
  const afterCreate = getWorkspace().activities.length;
  saveRecord(
    form({
      kind: "customer",
      id: customerId,
      name: "Quiet client renamed",
      stage: "Lost",
      relationship_status: "Archived",
      follow_up: "2026-05-01",
    }),
  );
  assert.equal(getWorkspace().activities.length, afterCreate);
  saveRecord(
    form({
      kind: "customer",
      id: customerId,
      name: "Quiet client renamed",
      stage: "Won",
      relationship_status: "Archived",
      follow_up: "2026-05-01",
    }),
  );
  assert.equal(getWorkspace().activities.length, afterCreate);
});

test("standalone client tasks can be created, filtered, and link consistently", () => {
  const customerId = saveRecord(
    form({
      kind: "customer",
      name: "Client",
      stage: "Won",
      relationship_status: "Client",
    }),
  );
  const taskId = saveRecord(
    form({
      kind: "task",
      title: "Standalone follow-up",
      customer_id: customerId,
      priority: "Normal",
    }),
  );
  assert.equal(existing("tasks", taskId).project_id, null);
  assert.equal(existing("tasks", taskId).customer_id, customerId);
  assert.equal(
    listItems("task", {
      status: "all",
      customer_id: customerId,
    }).items.some((item) => item.id === taskId),
    true,
  );

  const projectId = saveRecord(
    form({
      kind: "project",
      name: "Client project",
      customer_id: customerId,
      status: "Active",
      color: "green",
    }),
  );
  assert.doesNotThrow(() =>
    saveRecord(
      form({
        kind: "task",
        title: "Matched links",
        project_id: projectId,
        customer_id: customerId,
        priority: "Normal",
      }),
    ),
  );
  const otherId = saveRecord(
    form({
      kind: "customer",
      name: "Other client",
      stage: "Won",
      relationship_status: "Client",
    }),
  );
  assert.throws(
    () =>
      saveRecord(
        form({
          kind: "task",
          title: "Mismatched links",
          project_id: projectId,
          customer_id: otherId,
          priority: "Normal",
        }),
      ),
    /different client/,
  );
});

test("terminal customer stages enforce their lifecycle across full-form saves", () => {
  const id = saveRecord(
    form({
      kind: "customer",
      name: "Terminal relationship",
      stage: "Lost",
      relationship_status: "Lead",
      follow_up: "2026-06-01",
    }),
  );
  assert.equal(existing("customers", id).relationship_status, "Archived");

  saveRecord(
    form({
      kind: "customer",
      id,
      name: "Terminal relationship",
      stage: "Won",
      relationship_status: "Archived",
      follow_up: "2026-06-01",
    }),
  );
  assert.equal(existing("customers", id).relationship_status, "Client");
});

test("stale web note saves reject without overwriting newer MCP content", () => {
  const id = saveRecord(
    form({ kind: "note", title: "Original title", body: "Body A" }),
  );
  const original = recordSnapshot("note", existing("notes", id));
  saveRecord(
    form({
      kind: "note",
      id,
      title: "Original title",
      body: "Body B from MCP",
    }),
  );
  assert.throws(
    () =>
      saveWebRecord(
        form({
          kind: "note",
          id,
          title: "My new title",
          body: "Body A",
          original,
        }),
      ),
    /changed after you opened/,
  );
  const saved = existing("notes", id);
  assert.equal(saved.body, "Body B from MCP");
  assert.equal(saved.title, "Original title");
});
test("stale web deletes reject after concurrent task completion", () => {
  const id = saveRecord(
    form({ kind: "task", title: "Keep completed task", priority: "Normal" }),
  );
  const revision = getRevision();
  setTaskCompleted(id, true);

  assert.throws(
    () => removeWebRecord("task", id, revision),
    /workspace changed after you opened/,
  );
  assert.equal(existing("tasks", id).done, 1);
});

test("stale client deletes reject after concurrent activity", () => {
  const id = saveRecord(
    form({
      kind: "customer",
      name: "Activity client",
      stage: "Won",
      relationship_status: "Client",
    }),
  );
  const revision = getRevision();
  logActivity(
    form({ customer_id: id, body: "New client call", activity_kind: "Call" }),
  );

  assert.throws(
    () => removeWebRecord("customer", id, revision),
    /workspace changed after you opened/,
  );
  assert.equal(existing("customers", id).name, "Activity client");
  assert.equal(
    getWorkspace().activities.some((activity) => activity.customer_id === id),
    true,
  );
});

test("unchanged workspace revisions allow deletes and invalid revisions fail closed", () => {
  const id = saveRecord(
    form({ kind: "note", title: "Delete unchanged", body: "Remove me" }),
  );
  const revision = getRevision();
  for (const invalid of [-1, 1.5, Number.NaN])
    assert.throws(
      () => removeWebRecord("note", id, invalid),
      /Invalid workspace revision/,
    );
  assert.equal(existing("notes", id).body, "Remove me");

  removeWebRecord("note", id, revision);
  assert.throws(() => existing("notes", id), /no longer exists/);
});

test("unchanged baselines allow a full form save", () => {
  const id = saveRecord(form({ kind: "note", title: "Before", body: "Body" }));
  const original = recordSnapshot("note", existing("notes", id));
  assert.equal(
    saveWebRecord(
      form({
        kind: "note",
        id,
        title: "After",
        body: "Updated body",
        original,
      }),
    ),
    id,
  );
  assert.equal(existing("notes", id).body, "Updated body");
});
test("a task completion outside the form is retained when its title is edited", () => {
  const id = saveRecord(
    form({ kind: "task", title: "Before", priority: "Normal" }),
  );
  const original = recordSnapshot("task", existing("tasks", id));
  setTaskCompleted(id, true);
  saveWebRecord(
    form({ kind: "task", id, title: "After", priority: "Normal", original }),
  );
  assert.equal(existing("tasks", id).done, 1);
  assert.equal(existing("tasks", id).title, "After");
});
test("missing or invalid update baselines fail closed, but creates need none", () => {
  const id = saveWebRecord(
    form({ kind: "note", title: "New note", body: "Keep me" }),
  );
  assert.throws(
    () =>
      saveWebRecord(form({ kind: "note", id, title: "Lost", body: "Lost" })),
    /original/,
  );
  assert.throws(
    () =>
      saveWebRecord(
        form({ kind: "note", id, title: "Lost", body: "Lost", original: "{}" }),
      ),
    /changed/,
  );
  assert.equal(existing("notes", id).body, "Keep me");
});
test("read snapshots remain consistent when another process commits during a response", () => {
  const other = new DatabaseSync(process.env.DATABASE_PATH!);
  try {
    readSnapshot(() => {
      const before = getRevision(); // establish this connection's snapshot
      const initial = listItems("task", {
        query: "snapshot insert",
        status: "all",
      });
      assert.equal(initial.total, 0);
      other
        .prepare("INSERT INTO tasks(id,title) VALUES (?,?)")
        .run("snapshot-task", "snapshot insert");
      assert.equal(getRevision(), before);
      assert.equal(
        listItems("task", { query: "snapshot insert", status: "all" }).total,
        0,
      );
      assert.equal(
        getWorkspace().tasks.some((task) => task.id === "snapshot-task"),
        false,
      );
    });
    assert.equal(
      listItems("task", { query: "snapshot insert", status: "all" }).total,
      1,
    );
  } finally {
    other.close();
  }
});
test("failed nested snapshots release their transaction", () => {
  assert.throws(
    () =>
      readSnapshot(() =>
        readSnapshot(() => {
          throw new Error("Read failed");
        }),
      ),
    /Read failed/,
  );
  assert.doesNotThrow(() =>
    saveWebRecord(form({ kind: "note", title: "Still writable" })),
  );
});

test("first-run choices validate input and empty setup removes only examples", () => {
  assert.throws(() => completeFirstRun("invalid"), /Choose an example/);
  const retainedId = saveRecord(
    form({ kind: "note", title: "Keep after setup", body: "Local record" }),
  );
  completeFirstRun("empty");
  assert.equal(
    d.prepare("SELECT value FROM meta WHERE key='first_run_pending'").get(),
    undefined,
  );
  assert.equal(
    Number(
      d
        .prepare(
          "SELECT COUNT(*) AS count FROM (SELECT is_demo FROM tasks UNION ALL SELECT is_demo FROM projects UNION ALL SELECT is_demo FROM customers UNION ALL SELECT is_demo FROM notes UNION ALL SELECT is_demo FROM activities) WHERE is_demo=1",
        )
        .get()?.count,
    ),
    0,
  );
  assert.equal(existing("notes", retainedId).body, "Local record");
});

test("web note create/update preserves exact whitespace while titles and IDs normalize", () => {
  const body = "\n\n  indented first line\t\nlast line  \n\n";
  const id = saveWebRecord(
    form({ kind: "note", title: "  Whitespace  ", body }),
  );
  assert.equal(existing("notes", id).body, body);
  assert.equal(existing("notes", id).title, "Whitespace");
  for (const updated of [" \t\n", "", body]) {
    const original = recordSnapshot("note", existing("notes", id));
    saveWebRecord(
      form({
        kind: "note",
        id: ` ${id} `,
        title: "  Updated  ",
        body: updated,
        original,
      }),
    );
    assert.equal(existing("notes", id).body, updated);
    assert.equal(existing("notes", id).title, "Updated");
  }
  const original = recordSnapshot("note", existing("notes", id));
  assert.throws(
    () =>
      saveWebRecord(
        form({
          kind: "note",
          id,
          title: "Too long",
          body: " ".repeat(50001),
          original,
        }),
      ),
    /50000/,
  );
  assert.equal(existing("notes", id).body, body);
});

for (const kind of ["customer", "project"] as const) {
  test(`web ${kind} creation rolls back the record and revision when timeline insertion fails`, () => {
    const customerId = saveWebRecord(
      form({
        kind: "customer",
        name: "Atomic parent",
        stage: "Prospect",
        relationship_status: "Lead",
      }),
    );
    const before = getWorkspace();
    const revision = getRevision();
    d.exec(
      "CREATE TEMP TRIGGER reject_activity BEFORE INSERT ON activities BEGIN SELECT RAISE(ABORT, 'Rejected timeline'); END",
    );
    try {
      assert.throws(
        () =>
          saveWebRecord(
            form(
              kind === "project"
                ? {
                    kind,
                    name: "Atomic project",
                    customer_id: customerId,
                    status: "Active",
                    color: "green",
                  }
                : {
                    kind,
                    name: "Atomic customer",
                    stage: "Prospect",
                    relationship_status: "Lead",
                    follow_up: "2026-07-01",
                  },
            ),
          ),
        /Rejected timeline/,
      );
      assert.deepEqual(getWorkspace(), before);
      assert.equal(getRevision(), revision);
    } finally {
      d.exec("DROP TRIGGER reject_activity");
    }
  });
}
