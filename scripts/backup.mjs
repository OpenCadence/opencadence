import nextEnv from "@next/env";
import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Match Next.js environment loading when this script runs outside Next.js.
const { loadEnvConfig } = nextEnv;
const projectRoot = resolve(process.cwd());
loadEnvConfig(projectRoot, process.env.NODE_ENV === "development");

const source = resolve(process.env.DATABASE_PATH || "data/cadence.sqlite");
const destination = resolve(
  process.argv[2] ||
    `data/backups/cadence-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.sqlite`,
);
if (!existsSync(source))
  throw new Error(`No database found at ${source}. Start OpenCadence first.`);
if (existsSync(destination))
  throw new Error(
    `Refusing to overwrite ${destination}. Choose a new backup path.`,
  );

const previousUmask =
  process.platform === "win32" ? undefined : process.umask(0o077);
let database;
try {
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
  database = new DatabaseSync(source, { readOnly: true });
  database.exec("PRAGMA busy_timeout=5000");
  // VACUUM INTO creates a consistent standalone snapshot, including WAL writes.
  database.prepare("VACUUM INTO ?").run(destination);
  const backup = new DatabaseSync(destination, { readOnly: true });
  try {
    const integrity = backup
      .prepare("PRAGMA integrity_check")
      .get()?.integrity_check;
    if (integrity !== "ok")
      throw new Error(`Backup integrity check failed: ${integrity}`);
  } finally {
    backup.close();
  }
  if (process.platform !== "win32") chmodSync(destination, 0o600);
  console.log(`Backed up OpenCadence to ${destination} (integrity check: ok)`);
} catch (error) {
  rmSync(destination, { force: true });
  throw error;
} finally {
  database?.close();
  if (previousUmask !== undefined) process.umask(previousUmask);
}
