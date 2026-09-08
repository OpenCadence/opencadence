import { existsSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve(process.argv[2] || "");
if (!process.argv[2]) throw new Error("A demo database path is required.");
if (existsSync(path))
  throw new Error(`Refusing to replace an existing database at ${path}.`);

process.env.DATABASE_PATH = path;
const { db } = await import("../src/lib/storage.ts");
const database = db();
try {
  database
    .prepare("UPDATE meta SET value = '0' WHERE key = 'first_run_pending'")
    .run();
} finally {
  database.close();
}

console.log(`Prepared fictional demo data at ${path}`);
