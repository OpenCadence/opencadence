import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "opencadence-permissions-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));

test(
  "database initialization creates private application data on POSIX",
  { skip: process.platform === "win32" },
  () => {
    const dataDirectory = join(directory, "new-data");
    const databasePath = join(dataDirectory, "workspace.sqlite");
    const result = spawnSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        resolve("tests/fixtures/open-storage.mjs"),
      ],
      {
        cwd: resolve("."),
        env: {
          ...process.env,
          DATABASE_PATH: databasePath,
          STORAGE_TEST_UMASK: String(0o022),
        },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(statSync(dataDirectory).mode & 0o077, 0);
    assert.equal(statSync(databasePath).mode & 0o077, 0);
  },
);
