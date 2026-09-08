# OpenCadence MCP

A **local stdio MCP server** for your tasks, projects, client relationships and lead pipeline, outreach history, and notes. It uses the same SQLite database and validated mutation functions as the Next.js app. No additional network listener, API token, cloud account, or database server is required.

## Connect an MCP client

1. Install the project dependencies with `pnpm install` and use Node.js **22.13+**.
2. Generate connection settings for this machine:

   ```bash
   pnpm --silent mcp:config
   ```

   `.mcp.example.json` shows the portable format. To save a machine-specific copy (ignored by Git), run the following on first setup and after moving the project or changing your Node installation:

   ```bash
   pnpm --silent mcp:config > mcp.config.json
   ```

3. Add the generated **`cadence`** server entry to your MCP client's configuration, merging it with any existing servers. The generated envelope is the common `mcpServers` format; clients with a different envelope still use the same `command`, `args`, and `env` values.
4. Restart/reload the client's MCP connections. It should discover **22 tools, 2 resources, and 2 prompts**. Resources and prompts depend on client support; ordinary tools work without them.

Example structure (use the generated absolute paths, not these placeholders):

```json
{
  "mcpServers": {
    "cadence": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/cadence/scripts/mcp.mjs"],
      "env": {
        "DATABASE_PATH": "/absolute/path/to/cadence/data/cadence.sqlite"
      }
    }
  }
}
```

**This repository provides the server and connection settings; it does not overwrite any existing AI-client configuration.** Your client starts and stops the process. Don't start a separate server first, and don't enter an HTTP URL: this is stdio, not an HTTP MCP endpoint.

For manual startup, `pnpm mcp` works, but an apparently idle process is expected: it waits for JSON-RPC on stdin. Client configurations should call **Node directly** using the generated settings so pnpm's status output cannot interfere with protocol frames on stdout. Diagnostics go to stderr.

### Pi

Install `pi-mcp-adapter` in Pi if it is not already available. The plugin automatically reads **`.mcp.json`** in this project. Generate settings as above and merge the `cadence` entry into `.mcp.json`, preserving existing entries. This file is ignored by Git and must be configured on each machine. Project-local configuration does not expose OpenCadence to Pi sessions in unrelated projects.

Then run in Pi:

```text
/reload
/mcp reconnect cadence
```

The reload picks up the new server definition; reconnect performs discovery and makes the tools and prompt commands available. Use `/mcp` to inspect connection status, then ask naturally, for example, “List my OpenCadence tasks, excluding examples.”

The adapter accesses tools on demand through its `mcp` gateway, rather than adding all 22 schemas to every prompt. The MCP prompts are available after discovery as:

```text
/mcp__cadence__plan_day
/mcp__cadence__prepare_follow_up customer_id=<returned-customer-id>
```

If you move the project or upgrade the pinned Node installation, regenerate the connection settings and update the `cadence` entry in `.mcp.json`, preserving any other entries.

### Database location and environment

The launcher resolves the project directory from its own filename, so it works even when your MCP client starts from `/`, `/tmp`, or another workspace. It reads `.env.local` using Next.js's environment loader. Relative `DATABASE_PATH` values resolve against the **OpenCadence root**, never the client directory. Explicit environment variables take precedence.

The generated config pins the resolved database path. If you change the app's database location, regenerate/update the MCP config too. For installations using mode-specific environment files, generate and launch with the matching `NODE_ENV` (the default loader mode is development).

The web app need not be running: MCP can read and write the database independently. If MCP is the first thing to open a fresh database, the same labelled examples are initialized once. Multiple local MCP connections and the web app may share the file; write transactions, foreign keys, WAL, and the busy timeout apply to all of them.

### Read-only access

Add this to the server entry's `env`, then restart its connection:

```json
"CADENCE_MCP_READ_ONLY": "1"
```

Read-only mode registers only the **12 read tools**, plus resources and prompts. Create/update/log tools are absent, and explicitly calling an omitted tool fails. It requires an existing database at the current schema version; start OpenCadence normally before enabling it and after upgrades. The setting applies only to the MCP process and does not make the web app read-only. It restricts the MCP API, not OS permissions, so other applications with filesystem access can still write to the file. For file-level isolation, connect to a separate backup with appropriate OS permissions.

## Tools

For upgrade compatibility, all tool names keep the `cadence_` prefix, resources keep the `cadence://` scheme, and generated client configuration keeps the `cadence` server key. Existing Cadence connections therefore continue working after the visible product rename to OpenCadence. These protocol identifiers are stable compatibility names, not the displayed product name.

| Area          | Tools                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- |
| Tasks         | `list_tasks`, `get_task`, `create_task`, `update_task`, `set_task_completed`              |
| Projects      | `list_projects`, `get_project`, `create_project`, `update_project`                        |
| Relationships | `list_customers`, `get_customer`, `create_customer`, `update_customer`, `list_follow_ups` |
| Outreach      | `list_activities`, `log_activity`                                                         |
| Notes         | `list_notes`, `get_note`, `create_note`, `update_note`                                    |
| Workspace     | `get_today`, `search_workspace`                                                           |

### Data conventions

- Discover IDs with list/search tools before linking records. Names may not be unique.
- `list_tasks` defaults to **open** tasks. Use `status: "completed"` or `"all"` when needed. Tasks have an independent attention `state`: `actionable`, `waiting_on_client`, or `waiting_on_me`; setting `actionable` clears a waiting state. They may have an optional `project_id`, a direct `customer_id` for standalone client work, both matching links, or neither. `list_projects` defaults to all project statuses.
- Lists default to 25 results (activity: 20). `next_offset: null` means the end; otherwise pass that offset for the next page. Maximum page size is 100 (activity: 50). Fetch all pages before claiming to list everything.
- Relationships retain a pipeline `stage` and separately use `relationship_status: "Lead" | "Client" | "Archived"`. Won-stage updates promote to Client and Lost-stage updates archive the relationship. `list_follow_ups` returns scheduled Leads and established Clients; Archived relationships are explicitly excluded.
- Project, client (`customer`), and note lists return 300-character excerpts. Their `get_*` tools return full contents. Activity lists return full activity bodies.
- `include_examples: false` excludes examples from lists, search, and briefings. Saved rows contain `is_demo: 0/1`; tasks contain `done: 0/1`.
- Dates are real `YYYY-MM-DD` calendar dates. Invalid dates such as February 30 are rejected. A created task is **undated** unless you provide a date.
- `due_before` and `due_after` are inclusive. Dated filters exclude undated tasks. `get_today` separates due/overdue tasks into `actions`, `waiting_on_me`, and `waiting_on_clients`, and includes due Lead/Client follow-ups plus active projects. Its counts and records use the same attention rules as the Today UI. It reports the machine timezone and accepts an explicit `date` override.
- Updates are **partial**: omitted fields remain unchanged. Use `null` to remove a project or client (`customer`) link; use `""` to clear a date or optional text. Empty patches and unknown fields are rejected.
- A supplied note `body` replaces its full contents. Read it first before appending; don't overwrite a note without the user's intent.
- `set_task_completed` takes an explicit `completed` boolean, not a toggle. Repeating the same completion request does not reopen the task, and completion/reopening does not change its attention state.
- Query strings are literal case-insensitive substrings (SQLite's standard ASCII case folding), not SQL expressions or wildcard patterns.
- `log_activity` with kind `Email` records an email that happened elsewhere. **It does not send email.** Follow-up dates are in-app reminders, not push notifications or scheduled messages.
- Create/log tools do not deduplicate retries. After a lost response, search/list for the result before retrying an uncertain write. Tools advertise their read-only, destructive-update, and idempotency hints to clients.

### Example calls

Create a standalone client priority for a specific day (replace the client ID with one returned by `list_customers`):

```json
{
  "name": "cadence_create_task",
  "arguments": {
    "title": "Send the bakery website proposal",
    "customer_id": "<returned-client-id>",
    "due": "2026-09-10",
    "priority": "High"
  }
}
```

List real open tasks:

```json
{
  "name": "cadence_list_tasks",
  "arguments": { "status": "open", "include_examples": false, "limit": 25 }
}
```

Complete a task (replace the example ID with a returned ID):

```json
{
  "name": "cadence_set_task_completed",
  "arguments": { "id": "<returned-task-id>", "completed": true }
}
```

Natural-language requests for a connected assistant:

- “What should I focus on today? Ignore the example data.”
- “Create a high-priority task to send Oak & Ember their proposal tomorrow.”
- “Show open tasks for the bakery website project.”
- “Who needs a follow-up this week?”
- “Log that I called Alex, then set a follow-up for next Thursday.”
- “Find my discovery notes for Form Studio.”
- “Draft a client follow-up based on our last conversation. Don't send or log it yet.”

## Resources and prompts

**Read-only resources**:

- `cadence://guide`: workspace conventions and safe-use guidance.
- `cadence://today`: a fresh JSON briefing each time it is read, including labelled examples. Use `get_today` for date overrides or excluding examples. Resources are pull-based; subscriptions are not implemented.

**Reusable prompts**:

- `plan_day`: review real work and propose up to three priorities, without silently changing tasks.
- `prepare_follow_up`: takes `customer_id`, reads context, and drafts an email without sending it or falsely logging it as sent.

Stored notes and client text are treated as **data, not instructions**. Prompts explicitly reinforce this boundary.

## UI synchronization

SQLite triggers maintain a revision counter for changes from either process. The visible web app polls only that counter every three seconds and refreshes its server-rendered data when it changes. Polling pauses while the tab is hidden or a dialog is open, so external updates don't interrupt a draft. Close the dialog to receive pending updates; manual refresh also works.

This is not a collaborative editor: stale web forms are rejected rather than overwriting newer web or MCP changes, and the unsaved draft stays open. Reopen the editor to load the latest record after copying any changes you want to keep. MCP patches merge omitted fields under a database write lock, but explicit replacements can overwrite the current value of their target field. Coordinate edits to the same note rather than editing it in both places at once.

## Privacy and boundaries

- No additional listening port or public endpoint. The parent MCP client owns the local subprocess.
- No delete/clear tools, arbitrary SQL, filesystem browsing, shell execution, outbound requests, sampling, or automatic email sending.
- Local SQLite storage does **not** mean your AI model is local. Tool results are passed to the connected client, which may send them to its configured cloud model. Use a trusted AI client or local model if client information must stay entirely on this machine.
- No authentication/multi-user isolation was added. The web app remains loopback-only by default; do not expose it publicly as-is.
- Back up the database before large changes: `pnpm backup`.

## Checks and troubleshooting

```bash
pnpm test:mcp   # Real SDK client -> spawned stdio server, temporary database
pnpm test        # MCP integration plus existing validation/database tests
pnpm typecheck
pnpm build
```

The integration suite covers simultaneous startup, schema/tool discovery, all four entity types, partial updates and clearing, completion, pagination, literal search, validation, atomic failed writes, linked outreach, resources/prompts, read-only enforcement, cross-process persistence, and revision changes. Tests never use the live workspace database.

If a connection fails:

1. Check the Node executable path and version. Regenerate the config after a Node upgrade.
2. Confirm the client's arguments point to the absolute `scripts/mcp.mjs` path.
3. Check stderr in the client's MCP logs; stdout is reserved for the protocol.
4. Confirm the database path matches the app and is writable.
5. If MCP writes are unavailable, check `CADENCE_MCP_READ_ONLY` in the client's environment and `.env.local`.
6. Restart the MCP connection after code, dependency, or environment changes; it is not hot-reloaded.
