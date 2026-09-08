import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const launcher = resolve("scripts/mcp.mjs");
function connection(path: string, readOnly = false) {
  const client = new Client({
    name: "cadence-integration-tests",
    version: "1.0.0",
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [launcher],
    cwd: tmpdir(),
    env: {
      DATABASE_PATH: path,
      NODE_ENV: "test",
      CADENCE_MCP_READ_ONLY: readOnly ? "1" : "0",
    },
    stderr: "pipe",
  });
  let diagnostics = "";
  transport.stderr?.on("data", (chunk) => {
    diagnostics += String(chunk);
  });
  return { client, transport, diagnostics: () => diagnostics };
}
async function call(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
) {
  const response = await client.callTool({
    name: `cadence_${name}`,
    arguments: args,
  });
  assert.notEqual(response.isError, true, JSON.stringify(response));
  assert.ok(response.structuredContent);
  // The test deliberately exercises wire JSON rather than importing server functions.
  return response.structuredContent as Record<string, any>;
}
async function invalid(
  client: Client,
  name: string,
  args: Record<string, unknown>,
  pattern: RegExp,
) {
  const result = await client.callTool({
    name: `cadence_${name}`,
    arguments: args,
  });
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), pattern);
}

test(
  "real stdio MCP: discovery, CRUD, validation, resources, prompts, persistence and read-only mode",
  { timeout: 60000 },
  async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "cadence-mcp-"));
    const path = join(directory, "workspace.sqlite");
    const first = connection(path);
    const second = connection(path);
    const readOnly = connection(path, true);
    let taskId = "";
    let projectId = "";
    let customerId = "";
    let noteId = "";
    try {
      // Both independent processes initialize the same fresh database at once.
      try {
        await Promise.all([
          first.client.connect(first.transport),
          second.client.connect(second.transport),
        ]);
      } catch (error) {
        throw new Error(
          `${error instanceof Error ? error.message : String(error)}\n${first.diagnostics()}${second.diagnostics()}`,
          { cause: error },
        );
      }
      const client = first.client;
      await t.test(
        "starts from another cwd, negotiates tools and exposes no deletion or arbitrary execution",
        async () => {
          const { tools } = await client.listTools();
          assert.equal(tools.length, 22);
          assert.ok(tools.some((tool) => tool.name === "cadence_create_task"));
          assert.ok(
            tools.every(
              (tool) => !/delete|remove|clear|sql|shell|exec/.test(tool.name),
            ),
          );
          assert.equal(
            tools.find((tool) => tool.name === "cadence_list_tasks")
              ?.annotations?.readOnlyHint,
            true,
          );
          assert.equal(
            tools.find((tool) => tool.name === "cadence_update_note")
              ?.annotations?.destructiveHint,
            true,
          );
          const examples = await call(client, "list_customers");
          assert.equal(examples.total, 4); // no double seeding under concurrent startup
          assert.equal(
            (await call(client, "list_tasks", { include_examples: false }))
              .total,
            0,
          );
        },
      );
      await t.test(
        "creates linked customer/project/task/note records with real IDs",
        async () => {
          const customer = await call(client, "create_customer", {
            name: "MCP Local Bakery",
            email: "hello@bakery.example",
            stage: "Contacted",
            follow_up: "2026-09-05",
            details: "Independent bakery",
          });
          customerId = customer.item.id;
          assert.equal(customer.item.relationship_status, "Lead");
          const project = await call(client, "create_project", {
            name: "MCP Bakery website",
            customer_id: customerId,
            description: "A warm digital welcome",
          });
          projectId = project.item.id;
          assert.equal(project.item.status, "Active");
          const task = await call(client, "create_task", {
            title: "MCP 100% pitch",
            project_id: projectId,
            customer_id: customerId,
            priority: "High",
            due: "2026-09-05",
            state: "waiting_on_client",
          });
          taskId = task.item.id;
          assert.equal(task.item.is_demo, 0);
          assert.equal(task.item.done, 0);
          assert.equal(task.item.state, "waiting_on_client");
          assert.equal(task.item.customer_id, customerId);
          assert.equal(
            (
              await call(client, "list_tasks", {
                state: "waiting_on_client",
                include_examples: false,
              })
            ).total,
            1,
          );
          assert.equal(
            (
              await call(client, "list_tasks", {
                customer_id: customerId,
                include_examples: false,
              })
            ).total,
            1,
          );
          const note = await call(client, "create_note", {
            title: "MCP Discovery",
            body: "A note containing a unique-search-needle",
            project_id: projectId,
            customer_id: customerId,
          });
          noteId = note.item.id;
          assert.equal(note.item.customer_id, customerId);
          assert.equal(
            (await call(second.client, "get_task", { id: taskId })).item.title,
            "MCP 100% pitch",
          );
        },
      );
      await t.test(
        "patches preserve omitted fields, support clears and completion/reopening",
        async () => {
          await call(client, "update_task", {
            id: taskId,
            title: "MCP 100% updated pitch",
          });
          let task = (await call(client, "get_task", { id: taskId })).item;
          assert.equal(task.project_id, projectId);
          assert.equal(task.priority, "High");
          assert.equal(task.due, "2026-09-05");
          assert.equal(task.state, "waiting_on_client");
          await call(client, "set_task_completed", {
            id: taskId,
            completed: true,
          });
          assert.equal(
            (
              await call(client, "list_tasks", {
                status: "completed",
                include_examples: false,
              })
            ).total,
            1,
          );
          await call(client, "update_task", {
            id: taskId,
            done: false,
            due: "",
            project_id: null,
            state: "waiting_on_me",
          });
          task = (await call(client, "get_task", { id: taskId })).item;
          assert.equal(task.done, 0);
          assert.equal(task.due, "");
          assert.equal(task.project_id, null);
          assert.equal(task.customer_id, customerId);
          assert.equal(task.state, "waiting_on_me");
          assert.equal(
            (
              await call(client, "list_tasks", {
                project_id: null,
                include_examples: false,
              })
            ).total,
            1,
          );
          await call(client, "update_task", {
            id: taskId,
            due: "2026-09-05",
            project_id: projectId,
            state: "actionable",
          });
          await call(client, "update_note", {
            id: noteId,
            title: "MCP Renamed discovery",
          });
          assert.equal(
            (await call(client, "get_note", { id: noteId })).item.body,
            "A note containing a unique-search-needle",
          );
        },
      );
      await t.test(
        "lists/search are paginated, bounded and treat SQL wildcards literally",
        async () => {
          await call(client, "create_task", { title: "MCP Unscheduled task" });
          const page = await call(client, "list_tasks", {
            include_examples: false,
            limit: 1,
          });
          assert.equal(page.total, 2);
          assert.equal(page.items.length, 1);
          assert.equal(page.next_offset, 1);
          const next = await call(client, "list_tasks", {
            include_examples: false,
            limit: 1,
            offset: page.next_offset,
          });
          assert.equal(next.next_offset, null);
          assert.notEqual(page.items[0].id, next.items[0].id);
          assert.equal(
            (
              await call(client, "list_tasks", {
                query: "%",
                include_examples: false,
              })
            ).total,
            1,
          );
          assert.equal(
            (
              await call(client, "search_workspace", {
                query: "unique-search-needle",
              })
            ).items[0].id,
            noteId,
          );
          assert.equal(
            (await call(client, "search_workspace", { query: "' OR 1=1 --" }))
              .total,
            0,
          );
          const notes = await call(client, "list_notes", {
            project_id: projectId,
          });
          assert.equal(notes.items[0].body, undefined);
          assert.ok(notes.items[0].excerpt);
        },
      );
      await t.test(
        "note create/update preserves whitespace, including omitted and whitespace-only bodies",
        async () => {
          const body = "\n\n  Indented MCP text\t\ntrailing spaces  \n\n";
          const created = await call(client, "create_note", {
            title: "  Whitespace MCP note  ",
            body,
          });
          const id = created.item.id;
          assert.equal(created.item.body, body);
          assert.equal(created.item.title, "Whitespace MCP note");
          await call(client, "update_note", {
            id: ` ${id} `,
            title: "  Renamed whitespace  ",
          });
          assert.equal(
            (await call(client, "get_note", { id })).item.body,
            body,
          );
          for (const updated of [" \t\n", "", body]) {
            const result = await call(client, "update_note", {
              id,
              body: updated,
            });
            assert.equal(result.item.body, updated);
            assert.equal(
              (await call(second.client, "get_note", { id })).item.body,
              updated,
            );
          }
          await invalid(
            client,
            "update_note",
            { id, body: " ".repeat(50001) },
            /50000|too big/i,
          );
          assert.equal(
            (await call(client, "get_note", { id })).item.body,
            body,
          );
        },
      );
      await t.test(
        "logs outreach, includes client follow-ups, and excludes archived relationships",
        async () => {
          const activity = await call(client, "log_activity", {
            customer_id: customerId,
            kind: "Email",
            body: "Sent a proposal manually. This MCP call sends no email.",
          });
          assert.equal(activity.item.kind, "Email");
          assert.equal(
            (await call(client, "list_activities", { customer_id: customerId }))
              .items[0].id,
            activity.item.id,
          );
          const today = await call(client, "get_today", {
            date: "2026-09-05",
            include_examples: false,
          });
          assert.equal(today.counts.tasks_due, 1); // undated task excluded
          assert.equal(today.counts.actions_due, 1);
          assert.equal(today.counts.waiting_on_clients, 0);
          assert.equal(today.actions.items[0].id, taskId);
          assert.equal(today.counts.follow_ups_due, 1);
          assert.equal(today.counts.active_projects, 1);
          await call(client, "update_customer", {
            id: customerId,
            stage: "Lost",
            relationship_status: "Client",
          });
          assert.equal(
            (await call(client, "get_customer", { id: customerId })).item
              .relationship_status,
            "Archived",
          );
          assert.equal(
            (await call(client, "list_follow_ups", { include_examples: false }))
              .total,
            0,
          );
          await call(client, "update_customer", {
            id: customerId,
            stage: "Won",
            relationship_status: "Archived",
          });
          assert.equal(
            (await call(client, "get_customer", { id: customerId })).item
              .relationship_status,
            "Client",
          );
          assert.equal(
            (await call(client, "list_follow_ups", { include_examples: false }))
              .total,
            1,
          );
          await call(client, "update_customer", {
            id: customerId,
            relationship_status: "Archived",
          });
          assert.equal(
            (await call(client, "list_follow_ups", { include_examples: false }))
              .total,
            0,
          );
          await call(client, "update_customer", {
            id: customerId,
            follow_up: "",
            stage: "Contacted",
          });
          const reopened = await call(client, "get_customer", {
            id: customerId,
          });
          assert.equal(reopened.item.email, "hello@bakery.example");
          assert.equal(reopened.item.relationship_status, "Lead");
        },
      );
      await t.test(
        "rejects invalid dates, unknown keys/IDs/links, empty patches and excessive payloads without writes",
        async () => {
          const before = (
            await call(client, "list_tasks", { include_examples: false })
          ).total;
          await invalid(
            client,
            "create_task",
            { title: "Invalid", due: "2026-02-30" },
            /calendar|date/i,
          );
          await invalid(
            client,
            "create_task",
            { title: "Invalid", project_id: "missing" },
            /linked item/i,
          );
          await invalid(
            client,
            "create_task",
            { title: "Invalid", is_demo: 1 },
            /unrecognized|is_demo/i,
          );
          await invalid(
            client,
            "update_task",
            { id: "missing", title: "Lost" },
            /no longer exists/i,
          );
          await invalid(
            client,
            "update_task",
            { id: taskId },
            /at least one field/i,
          );
          await invalid(
            client,
            "create_note",
            { title: "Too long", body: "x".repeat(50001) },
            /50000|too big/i,
          );
          await invalid(client, "list_tasks", { limit: 101 }, /100|too big/i);
          await invalid(
            client,
            "create_customer",
            { name: "Invalid", stage: "Whatever" },
            /invalid|option/i,
          );
          assert.equal(
            (await call(client, "list_tasks", { include_examples: false }))
              .total,
            before,
          );
          // A failed patch is atomic, including its completion state.
          await invalid(
            client,
            "update_task",
            { id: taskId, project_id: "missing", done: true },
            /linked item/i,
          );
          assert.equal(
            (await call(client, "get_task", { id: taskId })).item.done,
            0,
          );
        },
      );
      await t.test(
        "serves live resources and safe reusable planning prompts",
        async () => {
          assert.equal((await client.listResources()).resources.length, 2);
          const guide = await client.readResource({ uri: "cadence://guide" });
          assert.ok("text" in guide.contents[0]);
          assert.match(String(guide.contents[0].text), /not instructions/i);
          const today = await client.readResource({ uri: "cadence://today" });
          assert.ok("text" in today.contents[0]);
          assert.ok(JSON.parse(String(today.contents[0].text)).date);
          assert.equal((await client.listPrompts()).prompts.length, 2);
          const prompt = await client.getPrompt({
            name: "prepare_follow_up",
            arguments: { customer_id: customerId },
          });
          assert.match(JSON.stringify(prompt), /Do not send it/);
        },
      );
      await t.test(
        "read-only mode removes write tools and cannot call hidden mutations",
        async () => {
          await readOnly.client.connect(readOnly.transport);
          const { tools } = await readOnly.client.listTools();
          assert.ok(tools.length > 0);
          assert.ok(
            tools.every((tool) => tool.annotations?.readOnlyHint === true),
          );
          assert.ok(!tools.some((tool) => tool.name === "cadence_create_task"));
          const result = await readOnly.client.callTool({
            name: "cadence_create_task",
            arguments: { title: "Forbidden" },
          });
          assert.equal(result.isError, true);
          assert.equal(
            (await call(readOnly.client, "get_task", { id: taskId })).item.id,
            taskId,
          );
        },
      );
      await t.test(
        "writes are visible through another SQLite connection and increment UI revision",
        async () => {
          const observer = new DatabaseSync(path, { readOnly: true });
          const revision = Number(
            observer
              .prepare("SELECT value FROM meta WHERE key='revision'")
              .get()?.value,
          );
          await call(client, "update_project", {
            id: projectId,
            status: "Paused",
          });
          assert.ok(
            Number(
              observer
                .prepare("SELECT value FROM meta WHERE key='revision'")
                .get()?.value,
            ) > revision,
          );
          assert.equal(
            observer
              .prepare("SELECT status FROM projects WHERE id=?")
              .get(projectId)?.status,
            "Paused",
          );
          observer.close();
        },
      );
    } finally {
      await Promise.all([
        first.client.close(),
        second.client.close(),
        readOnly.client.close(),
      ]);
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
