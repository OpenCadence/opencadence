import type { Customer, Task, Workspace } from "./types";

export type Attention = {
  actions: Task[];
  waitingOnMe: Task[];
  waitingOnClients: Task[];
  dueTasks: Task[];
  dueFollowUps: Customer[];
};

export const attentionRelationshipStatuses = ["Lead", "Client"] as const;

/** Archived (including Lost) relationships are intentionally quiet. */
export function receivesFollowUps(customer: Customer): boolean {
  return (attentionRelationshipStatuses as readonly string[]).includes(
    customer.relationship_status,
  );
}

/**
 * Canonical attention rules shared by Today and MCP briefings.
 * Completed and undated tasks do not require dated attention. A waiting state
 * describes who owns the next move without changing the task's due date.
 */
export function getAttention(
  workspace: Pick<Workspace, "tasks" | "customers">,
  day: string,
): Attention {
  const dueTasks = workspace.tasks.filter(
    (task) => !task.done && !!task.due && task.due <= day,
  );
  const scheduledFollowUps = workspace.customers
    .filter((customer) => !!customer.follow_up && receivesFollowUps(customer))
    .sort(
      (a, b) =>
        a.follow_up.localeCompare(b.follow_up) || a.name.localeCompare(b.name),
    );

  return {
    actions: dueTasks.filter((task) => task.state === "actionable"),
    waitingOnMe: dueTasks.filter((task) => task.state === "waiting_on_me"),
    waitingOnClients: dueTasks.filter(
      (task) => task.state === "waiting_on_client",
    ),
    dueTasks,
    dueFollowUps: scheduledFollowUps.filter(
      (customer) => customer.follow_up <= day,
    ),
  };
}
