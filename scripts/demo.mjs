import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const next = require.resolve("next/dist/bin/next");
const directory = mkdtempSync(join(tmpdir(), "opencadence-demo-"));
const databasePath = join(directory, "cadence.sqlite");
const env = {
  ...process.env,
  NODE_ENV: "production",
  DATABASE_PATH: databasePath,
  CADENCE_DEMO_MODE: "1",
};

function cleanup() {
  rmSync(directory, { recursive: true, force: true });
}

const build = spawnSync(process.execPath, [next, "build"], {
  cwd: resolve("."),
  env,
  stdio: "inherit",
});
if (build.error || build.status !== 0) {
  cleanup();
  if (build.error) console.error(build.error);
  process.exit(build.status ?? 1);
}

const prepare = spawnSync(
  process.execPath,
  ["--import", "tsx", resolve("scripts/prepare-demo.mjs"), databasePath],
  { cwd: resolve("."), env, stdio: "inherit" },
);
if (prepare.error || prepare.status !== 0) {
  cleanup();
  if (prepare.error) console.error(prepare.error);
  process.exit(prepare.status ?? 1);
}

console.log("Starting OpenCadence in production demo mode.");
console.log("Your regular SQLite database will not be used or changed.");
const server = spawn(
  process.execPath,
  [next, "start", "--hostname", "127.0.0.1", ...process.argv.slice(2)],
  { cwd: resolve("."), env, stdio: "inherit" },
);

function stop() {
  server.kill("SIGTERM");
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
server.once("error", (error) => {
  console.error(error);
  cleanup();
  process.exitCode = 1;
});
server.once("exit", (code) => {
  cleanup();
  process.exitCode = code ?? 0;
});
