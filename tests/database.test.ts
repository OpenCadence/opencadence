import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const directory = mkdtempSync(join(tmpdir(), "cadence-test-"));
process.env.DATABASE_PATH = join(directory, "test.sqlite");
import { db, getWorkspace, isFirstRunPending } from "../src/lib/db";
const d = db();
after(() => {
  d.close();
  rmSync(directory, { recursive: true, force: true });
});

test("initializes a clearly marked example workspace only once", () => {
  const data = getWorkspace();
  assert.equal(data.customers.length, 4);
  assert.equal(data.projects.length, 3);
  assert.equal(data.tasks.length, 7);
  assert.equal(data.notes.length, 3);
  assert.equal(isFirstRunPending(), true);
  assert.ok(data.tasks.every((t) => t.is_demo === 1));
  assert.equal(db(), d);
  assert.equal(getWorkspace().tasks.length, 7);
});
test("RSC data consists of plain serializable objects", () => {
  const data = getWorkspace();
  assert.equal(Number.isSafeInteger(data.revision), true);
  for (const items of [
    data.customers,
    data.projects,
    data.tasks,
    data.notes,
    data.activities,
  ])
    for (const item of items)
      assert.equal(Object.getPrototypeOf(item), Object.prototype);
  assert.deepEqual(JSON.parse(JSON.stringify(data)), data);
});
test("enforces foreign keys and pipeline/status constraints", () => {
  assert.throws(
    () =>
      d
        .prepare(
          "INSERT INTO tasks(id,title,project_id) VALUES ('invalid','Task','missing')",
        )
        .run(),
    /FOREIGN KEY/,
  );
  assert.throws(
    () =>
      d
        .prepare(
          "INSERT INTO customers(id,name,stage) VALUES ('invalid','Name','Invalid')",
        )
        .run(),
    /CHECK/,
  );
  assert.throws(
    () =>
      d
        .prepare(
          "INSERT INTO customers(id,name,relationship_status) VALUES ('invalid-lifecycle','Name','Former')",
        )
        .run(),
    /CHECK/,
  );
  assert.throws(
    () =>
      d
        .prepare(
          "INSERT INTO tasks(id,title,customer_id) VALUES ('invalid-client-task','Task','missing')",
        )
        .run(),
    /FOREIGN KEY/,
  );
  assert.throws(
    () =>
      d
        .prepare("INSERT INTO tasks(id,title,done) VALUES ('invalid','Task',3)")
        .run(),
    /CHECK/,
  );
  assert.throws(
    () =>
      d
        .prepare(
          "INSERT INTO tasks(id,title,state) VALUES ('invalid-state','Task','blocked')",
        )
        .run(),
    /CHECK/,
  );
  assert.throws(
    () =>
      d
        .prepare(
          "INSERT INTO projects(id,name,status) VALUES ('invalid','Project','Invalid')",
        )
        .run(),
    /CHECK/,
  );
  assert.throws(
    () =>
      d
        .prepare(
          "INSERT INTO activities(id,customer_id,body,event_type) VALUES ('bad-event','demo-c1','Nope','noise')",
        )
        .run(),
    /CHECK/,
  );
});
test("project deletion keeps tasks and notes and clears their links", () => {
  d.prepare(
    "INSERT INTO projects(id,name) VALUES ('test-project','Test project')",
  ).run();
  d.prepare(
    "INSERT INTO tasks(id,title,project_id) VALUES ('test-task','Keep me','test-project')",
  ).run();
  d.prepare(
    "INSERT INTO notes(id,title,project_id) VALUES ('test-note','Keep me too','test-project')",
  ).run();
  d.prepare("DELETE FROM projects WHERE id='test-project'").run();
  assert.equal(
    d.prepare("SELECT project_id FROM tasks WHERE id='test-task'").get()
      ?.project_id,
    null,
  );
  assert.equal(
    d.prepare("SELECT project_id FROM notes WHERE id='test-note'").get()
      ?.project_id,
    null,
  );
});
test("customer deletion keeps work but deletes its activity history", () => {
  d.prepare(
    "INSERT INTO customers(id,name) VALUES ('test-customer','Test customer')",
  ).run();
  d.prepare(
    "INSERT INTO projects(id,name,customer_id) VALUES ('test-project-2','Keep project','test-customer')",
  ).run();
  d.prepare(
    "INSERT INTO notes(id,title,customer_id) VALUES ('customer-note','Keep customer note','test-customer')",
  ).run();
  d.prepare(
    "INSERT INTO activities(id,customer_id,body) VALUES ('test-activity','test-customer','An email')",
  ).run();
  d.prepare(
    "INSERT INTO tasks(id,title,customer_id) VALUES ('client-task','Keep task','test-customer')",
  ).run();
  d.prepare("DELETE FROM customers WHERE id='test-customer'").run();
  assert.equal(
    d
      .prepare("SELECT customer_id FROM projects WHERE id='test-project-2'")
      .get()?.customer_id,
    null,
  );
  assert.equal(
    d.prepare("SELECT customer_id FROM notes WHERE id='customer-note'").get()
      ?.customer_id,
    null,
  );
  assert.equal(
    d.prepare("SELECT id FROM activities WHERE id='test-activity'").get(),
    undefined,
  );
  assert.equal(
    d.prepare("SELECT customer_id FROM tasks WHERE id='client-task'").get()
      ?.customer_id,
    null,
  );
});
test("writes persist across separate database connections", () => {
  d.prepare(
    "INSERT INTO tasks(id,title,done) VALUES ('persisted-task','Persisted title',1)",
  ).run();
  const another = new DatabaseSync(process.env.DATABASE_PATH!, {
    readOnly: true,
  });
  const row = another
    .prepare("SELECT title,done FROM tasks WHERE id='persisted-task'")
    .get();
  assert.equal(row?.title, "Persisted title");
  assert.equal(row?.done, 1);
  another.close();
});
