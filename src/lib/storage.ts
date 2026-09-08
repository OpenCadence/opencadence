// Node-only storage shared by Next.js and the local stdio MCP process.
import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { localDate } from "./validation";
import type { Workspace } from "./types";

const globalDb = globalThis as unknown as {
  cadenceDb?: DatabaseSync;
  cadenceSchemaVersion?: number;
  cadenceReadOnly?: boolean;
};
const schemaVersion = 4;

const migrations: ReadonlyArray<(database: DatabaseSync) => void> = [
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT OR IGNORE INTO meta(key,value) VALUES ('revision','0');
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
        stage TEXT NOT NULL DEFAULT 'Prospect' CHECK(stage IN ('Prospect','Contacted','In conversation','Won','Lost')),
        follow_up TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '', is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Paused','Completed')),
        due TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT 'green', is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        priority TEXT NOT NULL DEFAULT 'Normal' CHECK(priority IN ('Normal','High')), due TEXT NOT NULL DEFAULT '',
        done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1)), is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL, customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        body TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'Note', is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX IF NOT EXISTS tasks_project ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS projects_customer ON projects(customer_id);
      CREATE INDEX IF NOT EXISTS activities_customer ON activities(customer_id);
    `);
    for (const table of [
      "customers",
      "projects",
      "tasks",
      "notes",
      "activities",
    ]) {
      for (const event of ["INSERT", "UPDATE", "DELETE"]) {
        database.exec(`CREATE TRIGGER IF NOT EXISTS revision_${table}_${event}
          AFTER ${event} ON ${table} BEGIN
            UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key='revision';
          END`);
      }
    }
  },
  (database) => {
    database.exec(`
      ALTER TABLE customers ADD COLUMN relationship_status TEXT NOT NULL DEFAULT 'Lead'
        CHECK(relationship_status IN ('Lead','Client','Archived'));
      UPDATE customers SET relationship_status = CASE stage
        WHEN 'Won' THEN 'Client'
        WHEN 'Lost' THEN 'Archived'
        ELSE 'Lead'
      END;
      ALTER TABLE tasks ADD COLUMN customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL;
      UPDATE tasks SET customer_id = (
        SELECT customer_id FROM projects WHERE projects.id = tasks.project_id
      ) WHERE project_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS tasks_customer ON tasks(customer_id);
    `);
  },
  (database) => {
    database.exec(`
      ALTER TABLE tasks ADD COLUMN state TEXT NOT NULL DEFAULT 'actionable'
        CHECK(state IN ('actionable','waiting_on_client','waiting_on_me'));
      CREATE INDEX IF NOT EXISTS tasks_state ON tasks(state);
    `);
  },
  (database) => {
    database.exec(`
      ALTER TABLE activities ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
      ALTER TABLE activities ADD COLUMN event_type TEXT NOT NULL DEFAULT 'manual'
        CHECK(event_type IN ('manual','lead_converted','project_started','project_completed','follow_up_changed'));
      CREATE INDEX IF NOT EXISTS activities_project ON activities(project_id);
    `);
  },
];

function migrateAndInitialize(database: DatabaseSync) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const currentVersion = database.prepare("PRAGMA user_version").get()
      ?.user_version as number;
    if (currentVersion > schemaVersion) {
      throw new Error(
        `This OpenCadence database uses schema version ${currentVersion}, but this installation only supports up to version ${schemaVersion}. Upgrade OpenCadence before opening it.`,
      );
    }
    for (
      let version = currentVersion + 1;
      version <= schemaVersion;
      version++
    ) {
      migrations[version - 1](database);
      database.exec(`PRAGMA user_version = ${version}`);
    }
    if (
      !database
        .prepare("SELECT value FROM meta WHERE key = 'initialized'")
        .get()
    ) {
      seedExamples(database);
      database
        .prepare("INSERT INTO meta(key,value) VALUES ('initialized','1')")
        .run();
      database
        .prepare("INSERT INTO meta(key,value) VALUES ('first_run_pending','1')")
        .run();
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function databasePath() {
  return resolve(
    /* turbopackIgnore: true */ process.env.DATABASE_PATH ||
      "data/cadence.sqlite",
  );
}

function openReadOnlyDatabase(path: string) {
  if (!existsSync(path)) {
    throw new Error(
      `No OpenCadence database exists at ${path}. Start OpenCadence before using read-only MCP mode.`,
    );
  }
  const database = new DatabaseSync(path, { readOnly: true });
  database.exec("PRAGMA busy_timeout = 5000; PRAGMA query_only = ON;");
  const version = database.prepare("PRAGMA user_version").get()
    ?.user_version as number;
  if (version !== schemaVersion) {
    database.close();
    throw new Error(
      `Read-only MCP mode requires schema version ${schemaVersion}, but the database uses version ${version}. Start OpenCadence normally to upgrade it first.`,
    );
  }
  return database;
}

export function db(options?: { readOnly?: boolean }) {
  const requestedReadOnly = options?.readOnly;
  if (globalDb.cadenceDb) {
    if (
      requestedReadOnly !== undefined &&
      globalDb.cadenceReadOnly !== requestedReadOnly
    ) {
      throw new Error(
        "The database is already open in a different access mode.",
      );
    }
    if (
      !globalDb.cadenceReadOnly &&
      globalDb.cadenceSchemaVersion !== schemaVersion
    ) {
      migrateAndInitialize(globalDb.cadenceDb);
      globalDb.cadenceSchemaVersion = schemaVersion;
    }
    return globalDb.cadenceDb;
  }

  const path = databasePath();
  const readOnly = requestedReadOnly ?? false;
  if (readOnly) {
    const database = openReadOnlyDatabase(path);
    globalDb.cadenceDb = database;
    globalDb.cadenceReadOnly = true;
    globalDb.cadenceSchemaVersion = schemaVersion;
    return database;
  }

  const dataDirectory = dirname(path);
  const createsDataDirectory = !existsSync(dataDirectory);
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const previousUmask =
    process.platform === "win32" ? undefined : process.umask(0o077);
  let database: DatabaseSync;
  try {
    database = new DatabaseSync(path);
    // Install the busy handler before journal-mode negotiation. Keeping this in
    // a separate call avoids a Node 22 startup race when two processes open a
    // fresh workspace at the same time.
    database.exec("PRAGMA busy_timeout = 5000;");
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA foreign_keys = ON;");
  } finally {
    if (previousUmask !== undefined) process.umask(previousUmask);
  }
  if (process.platform !== "win32") {
    // Protect user data even when the process inherits a permissive umask.
    if (createsDataDirectory) chmodSync(dataDirectory, 0o700);
    for (const file of [path, `${path}-wal`, `${path}-shm`])
      if (existsSync(/* turbopackIgnore: true */ file)) chmodSync(file, 0o600);
  }
  try {
    // One write lock prevents concurrent web and MCP startup from seeding twice.
    migrateAndInitialize(database);
    globalDb.cadenceSchemaVersion = schemaVersion;
  } catch (error) {
    database.close();
    throw error;
  }
  globalDb.cadenceDb = database;
  globalDb.cadenceReadOnly = false;
  return database;
}
function seedExamples(d: DatabaseSync) {
  const day = (n: number) => {
    const value = new Date();
    value.setDate(value.getDate() + n);
    return localDate(value);
  };
  const customer = d.prepare(
    "INSERT INTO customers(id,name,contact,email,stage,relationship_status,follow_up,details,is_demo) VALUES (?,?,?,?,?,?,?,?,1)",
  );
  customer.run(
    "demo-c1",
    "Oak & Ember",
    "Jamie Carter",
    "hello@oakandember.example",
    "Won",
    "Client",
    "",
    "Independent coffee shop. A warm, welcoming website to match their space.",
  );
  customer.run(
    "demo-c2",
    "Form Studio",
    "Alex Morgan",
    "alex@formstudio.example",
    "In conversation",
    "Lead",
    day(0),
    "Local architecture practice. Interested in a portfolio website refresh.",
  );
  customer.run(
    "demo-c3",
    "The Greenhouse",
    "Sam Ellis",
    "sam@greenhouse.example",
    "Contacted",
    "Lead",
    day(1),
    "Sent an introduction and a few ideas for their online shop.",
  );
  customer.run(
    "demo-c4",
    "Northside Dental",
    "Taylor Reed",
    "info@northside.example",
    "Prospect",
    "Lead",
    day(3),
    "Potential website redesign. Reach out with a short introduction.",
  );
  const project = d.prepare(
    "INSERT INTO projects(id,name,description,customer_id,due,color,is_demo) VALUES (?,?,?,?,?,?,1)",
  );
  project.run(
    "demo-p1",
    "A fresh start for Oak & Ember",
    "Brand-led website for the neighbourhood’s favourite coffee spot.",
    "demo-c1",
    day(12),
    "green",
  );
  project.run(
    "demo-p2",
    "Form, function & a new website",
    "A considered digital home for an independent architecture studio.",
    "demo-c2",
    day(21),
    "purple",
  );
  project.run(
    "demo-p3",
    "My freelance home base",
    "Make space for better work. Refresh the portfolio and refine the process.",
    null,
    day(30),
    "orange",
  );
  const task = d.prepare(
    "INSERT INTO tasks(id,title,project_id,priority,due,done,is_demo) VALUES (?,?,?,?,?,?,1)",
  );
  task.run(
    "demo-t1",
    "Explore homepage directions",
    "demo-p1",
    "High",
    day(0),
    0,
  );
  task.run("demo-t2", "Send proposal to Alex", "demo-p2", "High", day(0), 0);
  task.run(
    "demo-t3",
    "Collect inspiration for the portfolio",
    "demo-p3",
    "Normal",
    day(0),
    0,
  );
  task.run(
    "demo-t4",
    "Map out the website structure",
    "demo-p1",
    "Normal",
    day(0),
    1,
  );
  task.run("demo-t5", "Design the menu page", "demo-p1", "Normal", day(2), 0);
  task.run(
    "demo-t6",
    "Write a first draft of my about page",
    "demo-p3",
    "Normal",
    "",
    0,
  );
  task.run("demo-t7", "Review project brief", "demo-p2", "Normal", day(-1), 1);
  const note = d.prepare(
    "INSERT INTO notes(id,title,body,project_id,customer_id,is_demo) VALUES (?,?,?,?,?,1)",
  );
  note.run(
    "demo-n1",
    "A few thoughts on the new direction",
    "Less noise. More personality.\n\nOak & Ember should feel like walking into the café on a slow Sunday morning. Warm tones, honest photography, and plenty of breathing room.\n\nIdeas to explore\n• An editorial-style homepage\n• The story behind the coffee\n• A simple, seasonal menu",
    "demo-p1",
    "demo-c1",
  );
  note.run(
    "demo-n2",
    "Discovery call · Form Studio",
    "A small team doing thoughtful work. Their existing site doesn’t quite tell that story.\n\nPriorities\n• Put the projects front and centre\n• Make enquiries feel easy\n• Keep it simple to update\n\nNext step: send a proposal with two scope options.",
    "demo-p2",
    "demo-c2",
  );
  note.run(
    "demo-n3",
    "Things worth making time for",
    "Keep Fridays a little lighter.\n\nMake something for the fun of it.\nFollow up with people, not just leads.\nWrite down ideas before they disappear.\n\nGood work starts with a little space.",
    null,
    null,
  );
  d.prepare(
    "INSERT INTO activities(id,customer_id,body,kind,is_demo) VALUES (?,?,?,?,1)",
  ).run(
    "demo-a1",
    "demo-c2",
    "Had a great discovery call. Sending a proposal with two scope options this week.",
    "Call",
  );
  d.prepare(
    "INSERT INTO activities(id,customer_id,body,kind,is_demo) VALUES (?,?,?,?,1)",
  ).run(
    "demo-a2",
    "demo-c3",
    "Sent an introduction email with a few ideas for the online shop.",
    "Email",
  );
}
/** Keep multi-query responses on one snapshot; savepoints also support nested reads. */
export function readSnapshot<T>(operation: () => T): T {
  const d = db();
  d.exec("SAVEPOINT cadence_read");
  try {
    const result = operation();
    d.exec("RELEASE cadence_read");
    return result;
  } catch (error) {
    d.exec("ROLLBACK TO cadence_read; RELEASE cadence_read");
    throw error;
  }
}

export function getRevision(): number {
  return Number(
    db().prepare("SELECT value FROM meta WHERE key='revision'").get()?.value ||
      0,
  );
}

export function isFirstRunPending(): boolean {
  return (
    db().prepare("SELECT value FROM meta WHERE key='first_run_pending'").get()
      ?.value === "1"
  );
}

export function getWorkspace(): Workspace {
  return readSnapshot(() => {
    const d = db();
    // node:sqlite returns null-prototype rows; React Server Components need plain objects.
    const rows = (sql: string) =>
      d
        .prepare(sql)
        .all()
        .map((row) => ({ ...row }));
    return {
      revision: Number(
        d.prepare("SELECT value FROM meta WHERE key='revision'").get()?.value ||
          0,
      ),
      customers: rows("SELECT * FROM customers ORDER BY created_at DESC, name"),
      projects: rows("SELECT * FROM projects ORDER BY created_at DESC, name"),
      tasks: rows(
        "SELECT * FROM tasks ORDER BY done, CASE WHEN due='' THEN 1 ELSE 0 END, due, CASE WHEN priority='High' THEN 0 ELSE 1 END, created_at DESC",
      ),
      notes: rows("SELECT * FROM notes ORDER BY updated_at DESC"),
      activities: rows("SELECT * FROM activities ORDER BY created_at DESC"),
    } as Workspace;
  });
}
