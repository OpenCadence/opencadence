import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const directory = mkdtempSync(join(tmpdir(), "opencadence-demo-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));

test("demo preparation creates fictional data with onboarding complete", () => {
  const databasePath = join(directory, "demo.sqlite");
  const result = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      resolve("scripts/prepare-demo.mjs"),
      databasePath,
    ],
    { cwd: resolve("."), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);

  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    assert.equal(
      database
        .prepare("SELECT value FROM meta WHERE key = 'first_run_pending'")
        .get()?.value,
      "0",
    );
    assert.equal(
      database.prepare("SELECT count(*) AS count FROM customers").get()?.count,
      4,
    );
    assert.equal(
      database
        .prepare("SELECT count(*) AS count FROM customers WHERE is_demo = 1")
        .get()?.count,
      4,
    );
    assert.equal(
      database.prepare("PRAGMA integrity_check").get()?.integrity_check,
      "ok",
    );
  } finally {
    database.close();
  }
});

test("demo preparation refuses to overwrite an existing database", () => {
  const databasePath = join(directory, "existing.sqlite");
  const database = new DatabaseSync(databasePath);
  database.close();

  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", resolve("scripts/prepare-demo.mjs"), databasePath],
    { cwd: resolve("."), encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to replace an existing database/);
});
