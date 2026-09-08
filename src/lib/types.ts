export const stages = [
  "Prospect",
  "Contacted",
  "In conversation",
  "Won",
  "Lost",
] as const;
export type Stage = (typeof stages)[number];
export const relationshipStatuses = ["Lead", "Client", "Archived"] as const;
export type RelationshipStatus = (typeof relationshipStatuses)[number];
export function relationshipStatusForStage(stage: Stage): RelationshipStatus {
  return stage === "Won" ? "Client" : stage === "Lost" ? "Archived" : "Lead";
}
export const activityKinds = ["Note", "Email", "Call", "Meeting"] as const;
export type ActivityKind = (typeof activityKinds)[number];
export const taskStates = [
  "actionable",
  "waiting_on_client",
  "waiting_on_me",
] as const;
export type TaskState = (typeof taskStates)[number];
export const taskStateLabels: Record<TaskState, string> = {
  actionable: "Actionable",
  waiting_on_client: "Waiting on client",
  waiting_on_me: "Waiting on me",
};
export type Customer = {
  id: string;
  name: string;
  contact: string;
  email: string;
  stage: Stage;
  relationship_status: RelationshipStatus;
  follow_up: string;
  details: string;
  is_demo: number;
  created_at: string;
};
export type Project = {
  id: string;
  name: string;
  description: string;
  customer_id: string | null;
  status: "Active" | "Paused" | "Completed";
  due: string;
  color: string;
  is_demo: number;
  created_at: string;
};
export type Task = {
  id: string;
  title: string;
  project_id: string | null;
  customer_id: string | null;
  priority: "Normal" | "High";
  due: string;
  state: TaskState;
  done: number;
  is_demo: number;
  created_at: string;
};
export type Note = {
  id: string;
  title: string;
  body: string;
  project_id: string | null;
  customer_id: string | null;
  is_demo: number;
  created_at: string;
  updated_at: string;
};
export type TimelineEventType =
  | "manual"
  | "lead_converted"
  | "project_started"
  | "project_completed"
  | "follow_up_changed";
export type Activity = {
  id: string;
  customer_id: string;
  project_id: string | null;
  body: string;
  kind: ActivityKind | "Relationship" | "Project" | "Follow-up";
  event_type: TimelineEventType;
  is_demo: number;
  created_at: string;
};
export type Workspace = {
  revision: number;
  customers: Customer[];
  projects: Project[];
  tasks: Task[];
  notes: Note[];
  activities: Activity[];
};
export type View = "today" | "tasks" | "projects" | "customers" | "notes";
export type ActionResult = { ok: boolean; error?: string };
