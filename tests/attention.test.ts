import { test } from "node:test";
import assert from "node:assert/strict";
import { getAttention } from "../src/lib/attention";
import type { Customer, Task } from "../src/lib/types";

function task(
  id: string,
  due: string,
  state: Task["state"] = "actionable",
  done = 0,
): Task {
  return {
    id,
    title: id,
    project_id: null,
    customer_id: null,
    priority: "Normal",
    due,
    state,
    done,
    is_demo: 0,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function customer(
  id: string,
  relationship_status: Customer["relationship_status"],
  follow_up: string,
  stage: Customer["stage"] = "Prospect",
): Customer {
  return {
    id,
    name: id,
    contact: "",
    email: "",
    stage,
    relationship_status,
    follow_up,
    details: "",
    is_demo: 0,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

test("attention separates due work by owner and excludes completed or future work", () => {
  const attention = getAttention(
    {
      tasks: [
        task("overdue-action", "2026-05-09"),
        task("today-action", "2026-05-10"),
        task("client-reply", "2026-05-10", "waiting_on_client"),
        task("person-waits", "2026-05-10", "waiting_on_me"),
        task("completed", "2026-05-10", "actionable", 1),
        task("future", "2026-05-11"),
        task("undated", ""),
      ],
      customers: [],
    },
    "2026-05-10",
  );

  assert.deepEqual(
    attention.actions.map(({ id }) => id),
    ["overdue-action", "today-action"],
  );
  assert.deepEqual(
    attention.waitingOnClients.map(({ id }) => id),
    ["client-reply"],
  );
  assert.deepEqual(
    attention.waitingOnMe.map(({ id }) => id),
    ["person-waits"],
  );
  assert.equal(attention.dueTasks.length, 4);
});

test("follow-ups include leads and established clients but explicitly exclude archived/lost relationships", () => {
  const attention = getAttention(
    {
      tasks: [],
      customers: [
        customer("lead", "Lead", "2026-05-10", "Contacted"),
        customer("client", "Client", "2026-05-09", "Won"),
        customer("archived", "Archived", "2026-05-08"),
        customer("lost", "Archived", "2026-05-07", "Lost"),
        customer("future", "Client", "2026-05-11", "Won"),
      ],
    },
    "2026-05-10",
  );

  assert.deepEqual(
    attention.dueFollowUps.map(({ id }) => id),
    ["client", "lead"],
  );
});
