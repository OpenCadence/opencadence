import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const directory = mkdtempSync(join(tmpdir(), "opencadence-migration-test-"));
const storageLauncher = resolve("tests/fixtures/open-storage.mjs");
after(() => rmSync(directory, { recursive: true, force: true }));

function createReleasedFixture(path: string, version: 0 | 1 | 2 | 3) {
  const database = new DatabaseSync(path);
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO meta(key,value) VALUES ('revision','7'), ('initialized','1');
    CREATE TABLE customers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'Prospect' CHECK(stage IN ('Prospect','Contacted','In conversation','Won','Lost')),
      follow_up TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '', is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Paused','Completed')),
      due TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT 'green', is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      priority TEXT NOT NULL DEFAULT 'Normal' CHECK(priority IN ('Normal','High')), due TEXT NOT NULL DEFAULT '',
      done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1)), is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE notes (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL, customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE activities (
      id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      body TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'Note', is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    INSERT INTO customers(id,name,email,stage) VALUES
      ('customer-1','Preserved client','owner@example.test','Prospect'),
      ('customer-won','Won client','won@example.test','Won'),
      ('customer-lost','Lost relationship','lost@example.test','Lost');
    INSERT INTO projects(id,name,customer_id) VALUES ('project-1','Preserved project','customer-1');
    INSERT INTO tasks(id,title,project_id) VALUES ('task-1','Preserved task','project-1');
    INSERT INTO notes(id,title,body,project_id,customer_id) VALUES ('note-1','Preserved note','Important','project-1','customer-1');
    INSERT INTO activities(id,customer_id,body) VALUES ('activity-1','customer-1','Preserved activity');
  `);
  if (version >= 1) {
    database.exec(`
      CREATE INDEX tasks_project ON tasks(project_id);
      CREATE INDEX projects_customer ON projects(customer_id);
      CREATE INDEX activities_customer ON activities(customer_id);
    `);
    for (const table of [
      "customers",
      "projects",
      "tasks",
      "notes",
      "activities",
    ])
      for (const event of ["INSERT", "UPDATE", "DELETE"])
        database.exec(`CREATE TRIGGER revision_${table}_${event}
          AFTER ${event} ON ${table} BEGIN
            UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key='revision';
          END`);
  }
  if (version >= 2) {
    database.exec(`
      ALTER TABLE customers ADD COLUMN relationship_status TEXT NOT NULL DEFAULT 'Lead'
        CHECK(relationship_status IN ('Lead','Client','Archived'));
      UPDATE customers SET relationship_status = CASE stage WHEN 'Won' THEN 'Client' WHEN 'Lost' THEN 'Archived' ELSE 'Lead' END;
      ALTER TABLE tasks ADD COLUMN customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL;
      UPDATE tasks SET customer_id = (SELECT customer_id FROM projects WHERE projects.id = tasks.project_id);
      CREATE INDEX tasks_customer ON tasks(customer_id);
    `);
  }
  if (version >= 3) {
    database.exec(`
      ALTER TABLE tasks ADD COLUMN state TEXT NOT NULL DEFAULT 'actionable'
        CHECK(state IN ('actionable','waiting_on_client','waiting_on_me'));
      CREATE INDEX tasks_state ON tasks(state);
    `);
  }
  database.exec(`PRAGMA user_version = ${version}`);
  database.close();
}

function runMigration(path: string) {
  return spawnSync(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", storageLauncher],
    {
      cwd: resolve("."),
      env: { ...process.env, DATABASE_PATH: path },
      encoding: "utf8",
    },
  );
}

for (const version of [0, 1, 2, 3] as const) {
  test(`upgrades schema version ${version} without losing records`, () => {
    const path = join(directory, `version-${version}.sqlite`);
    createReleasedFixture(path, version);
    const result = runMigration(path);
    assert.equal(result.status, 0, result.stderr);

    const database = new DatabaseSync(path);
    try {
      assert.equal(
        database.prepare("PRAGMA user_version").get()?.user_version,
        4,
      );
      assert.equal(
        database.prepare("PRAGMA integrity_check").get()?.integrity_check,
        "ok",
      );
      assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
      assert.equal(
        database
          .prepare("SELECT name FROM customers WHERE id='customer-1'")
          .get()?.name,
        "Preserved client",
      );
      assert.equal(
        database
          .prepare("SELECT customer_id, state FROM tasks WHERE id='task-1'")
          .get()?.customer_id,
        "customer-1",
      );
      assert.equal(
        database
          .prepare("SELECT customer_id, state FROM tasks WHERE id='task-1'")
          .get()?.state,
        "actionable",
      );
      assert.equal(
        database
          .prepare("SELECT event_type FROM activities WHERE id='activity-1'")
          .get()?.event_type,
        "manual",
      );
      assert.equal(
        database
          .prepare("SELECT project_id FROM activities WHERE id='activity-1'")
          .get()?.project_id,
        null,
      );
      assert.equal(
        database
          .prepare("SELECT value FROM meta WHERE key='first_run_pending'")
          .get(),
        undefined,
      );

      const revision = Number(
        database.prepare("SELECT value FROM meta WHERE key='revision'").get()
          ?.value,
      );
      database
        .prepare("UPDATE tasks SET title='Migrated task' WHERE id='task-1'")
        .run();
      assert.equal(
        Number(
          database.prepare("SELECT value FROM meta WHERE key='revision'").get()
            ?.value,
        ),
        revision + 1,
      );
    } finally {
      database.close();
    }
    const secondStart = runMigration(path);
    assert.equal(secondStart.status, 0, secondStart.stderr);
  });
}

test("refuses databases created by a newer OpenCadence schema", () => {
  const path = join(directory, "future.sqlite");
  const database = new DatabaseSync(path);
  database.exec("PRAGMA user_version=99");
  database.close();
  const result = runMigration(path);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /supports up to version 4/);
  const unchanged = new DatabaseSync(path, { readOnly: true });
  try {
    assert.equal(
      unchanged.prepare("PRAGMA user_version").get()?.user_version,
      99,
    );
  } finally {
    unchanged.close();
  }
});
