import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Never accept DATABASE_PATH from the caller: UI tests must not open live data.
const directory = mkdtempSync(join(tmpdir(), "cadence-ui-tests-"));
const child = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3103",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_PATH: join(directory, "workspace.sqlite"),
    },
  },
);
function stop() {
  child.kill("SIGTERM");
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
child.once("error", (error) => {
  console.error(error);
  rmSync(directory, { recursive: true, force: true });
  process.exitCode = 1;
});
child.once("exit", (code) => {
  rmSync(directory, { recursive: true, force: true });
  process.exitCode = code ?? 0;
});
