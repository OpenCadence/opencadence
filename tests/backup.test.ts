import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const directory = mkdtempSync(join(tmpdir(), "opencadence-backup-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));

test("the documented backup produces a restorable snapshot including WAL writes", () => {
  const source = join(directory, "source.sqlite");
  const backup = join(directory, "backup.sqlite");
  const restored = join(directory, "restored.sqlite");
  const live = new DatabaseSync(source);
  try {
    live.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE records (id TEXT PRIMARY KEY, body TEXT NOT NULL);
      INSERT INTO records VALUES ('before', 'committed before backup');
      PRAGMA user_version=4;
    `);
    // Keep the WAL-mode source connection open while the real CLI snapshots it.
    live
      .prepare("INSERT INTO records VALUES (?, ?)")
      .run("wal", "committed in WAL");

    const result = spawnSync(
      process.execPath,
      [resolve("scripts/backup.mjs"), backup],
      {
        cwd: resolve("."),
        env: { ...process.env, DATABASE_PATH: source },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Backed up OpenCadence/);
    assert.match(result.stdout, /integrity check: ok/);
    if (process.platform !== "win32")
      assert.equal(statSync(backup).mode & 0o077, 0);
  } finally {
    live.close();
  }

  // The restore procedure copies the standalone backup only while the app is stopped.
  copyFileSync(backup, restored);
  const database = new DatabaseSync(restored, { readOnly: true });
  try {
    assert.equal(
      database.prepare("PRAGMA quick_check").get()?.quick_check,
      "ok",
    );
    assert.equal(
      database.prepare("PRAGMA user_version").get()?.user_version,
      4,
    );
    assert.deepEqual(
      database
        .prepare("SELECT id, body FROM records ORDER BY id")
        .all()
        .map((row) => ({ ...row })),
      [
        { id: "before", body: "committed before backup" },
        { id: "wal", body: "committed in WAL" },
      ],
    );
  } finally {
    database.close();
  }
});

test("backup loads DATABASE_PATH from .env.local and creates private output", () => {
  const project = join(directory, "env-project");
  const source = join(project, "configured.sqlite");
  const destination = join(project, "private-backups", "configured.sqlite");
  mkdirSync(project);
  const database = new DatabaseSync(source);
  database.exec(
    "CREATE TABLE records (body TEXT); INSERT INTO records VALUES ('configured source')",
  );
  database.close();
  writeFileSync(
    join(project, ".env.local"),
    "DATABASE_PATH=configured.sqlite\n",
  );

  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" };
  delete env.DATABASE_PATH;
  const result = spawnSync(
    process.execPath,
    [resolve("scripts/backup.mjs"), destination],
    { cwd: project, env, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const backup = new DatabaseSync(destination, { readOnly: true });
  try {
    assert.equal(
      backup.prepare("SELECT body FROM records").get()?.body,
      "configured source",
    );
  } finally {
    backup.close();
  }
  if (process.platform !== "win32") {
    assert.equal(statSync(join(project, "private-backups")).mode & 0o077, 0);
    assert.equal(statSync(destination).mode & 0o077, 0);
  }
});
