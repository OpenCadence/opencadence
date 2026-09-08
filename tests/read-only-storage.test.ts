import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

function openStorage(
  databasePath: string,
  environment: Record<string, string>,
) {
  return spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      resolve("tests/fixtures/open-storage.mjs"),
    ],
    {
      cwd: resolve("."),
      env: { ...process.env, DATABASE_PATH: databasePath, ...environment },
      encoding: "utf8",
    },
  );
}

test("explicit read-only storage refuses an outdated schema without migrating it", () => {
  const directory = mkdtempSync(join(tmpdir(), "opencadence-read-only-"));
  const databasePath = join(directory, "workspace.sqlite");
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA user_version = 3");
  database.close();

  const result = openStorage(databasePath, { STORAGE_READ_ONLY: "1" });

  const unchanged = new DatabaseSync(databasePath, { readOnly: true });
  const version = unchanged.prepare("PRAGMA user_version").get()?.user_version;
  unchanged.close();
  rmSync(directory, { recursive: true, force: true });

  assert.deepEqual(
    { exitCode: result.status, version },
    { exitCode: 1, version: 3 },
  );
});

test("the MCP read-only setting does not make ordinary web storage read-only", () => {
  const directory = mkdtempSync(join(tmpdir(), "opencadence-web-storage-"));
  const databasePath = join(directory, "workspace.sqlite");

  const result = openStorage(databasePath, { CADENCE_MCP_READ_ONLY: "1" });
  const database = new DatabaseSync(databasePath, { readOnly: true });
  const version = database.prepare("PRAGMA user_version").get()?.user_version;
  database.close();
  rmSync(directory, { recursive: true, force: true });

  assert.deepEqual(
    { exitCode: result.status, version },
    { exitCode: 0, version: 4 },
  );
});
