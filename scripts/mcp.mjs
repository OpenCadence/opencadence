#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import nextEnv from "@next/env";
import { tsImport } from "tsx/esm/api";

// MCP clients often launch from / or their own directory. Always resolve relative
// database paths, .env.local, and the tsconfig from the OpenCadence project itself.
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const stderrLogger = {
  info: (...args) => console.error(...args),
  error: (...args) => console.error(...args),
};
nextEnv.loadEnvConfig(
  root,
  process.env.NODE_ENV !== "production",
  stderrLogger,
);

if (process.argv.includes("--print-config")) {
  console.log(
    JSON.stringify(
      {
        mcpServers: {
          cadence: {
            command: process.execPath,
            args: [fileURLToPath(import.meta.url)],
            env: {
              DATABASE_PATH: resolve(
                process.env.DATABASE_PATH || "data/cadence.sqlite",
              ),
            },
          },
        },
      },
      null,
      2,
    ),
  );
} else {
  // Protocol frames only on stdout. Diagnostics always go to stderr.
  try {
    const { startServer } = await tsImport(
      "../src/mcp/server.ts",
      import.meta.url,
    );
    await startServer();
  } catch (error) {
    console.error("OpenCadence MCP failed to start:", error);
    process.exitCode = 1;
  }
}
