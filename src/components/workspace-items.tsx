"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  FolderClosed,
  Mail,
  MoreHorizontal,
} from "lucide-react";
import {
  taskStateLabels,
  type Workspace,
  type Task,
  type Project,
  type Customer,
  type View,
} from "@/lib/types";
import { mailtoHref } from "@/lib/mailto";
import { localDate } from "@/lib/validation";
import type { Editor } from "./item-form";

export type WorkspaceItemContext = {
  data: Workspace;
  today: string;
  view: View;
  pending: boolean;
  openEditor: (editor: Editor) => void;
  openDetail: (kind: "project" | "customer", id: string) => void;
  onTaskToggle: (task: Task) => void;
};
const Context = createContext<WorkspaceItemContext | null>(null);
export const WorkspaceItemsProvider = Context.Provider;
function useItems() {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace items require a provider.");
  return value;
}
export function prettyDate(value: string, today: string) {
  if (!value) return "No date";
  if (value === today) return "Today";
  const tomorrow = new Date(today + "T12:00:00");
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (value === localDate(tomorrow)) return "Tomorrow";
  return new Date(value + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: value.slice(0, 4) !== today.slice(0, 4) ? "numeric" : undefined,
  });
}
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((s) => s !== "&")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}
export function ProjectMark({
  color,
  size = "",
}: {
  color: string;
  size?: string;
}) {
  return (
    <span className={`project-mark ${color} ${size}`}>
      <FolderClosed size={size === "small" ? 15 : 21} strokeWidth={1.6} />
    </span>
  );
}

// Module-scoped component identities preserve DOM and keyboard focus on parent renders.
export function TaskRow({
  task,
  hideProject = false,
}: {
  task: Task;
  hideProject?: boolean;
}) {
  const { data, today, pending, openEditor, onTaskToggle } = useItems();
  const project = data.projects.find((p) => p.id === task.project_id);
  const client = data.customers.find((c) => c.id === task.customer_id);
  return (
    <div className={`task-row ${task.done ? "completed" : ""}`}>
      <button
        className={`task-check ${task.done ? "checked" : ""}`}
        disabled={pending}
        aria-label={`${task.done ? "Reopen" : "Complete"} ${task.title}`}
        onClick={() => onTaskToggle(task)}
      >
        {task.done ? <Check size={13} strokeWidth={2.5} /> : null}
      </button>
      <button
        className="task-title"
        onClick={() => openEditor({ kind: "task", id: task.id })}
      >
        {task.title}
      </button>
      <div className="task-meta">
        {task.priority === "High" && !task.done && (
          <span className="priority" title="High priority">
            <ArrowUpRight size={13} />
            High
          </span>
        )}
        {!task.done && task.state !== "actionable" && (
          <span className={`task-state ${task.state}`}>
            {taskStateLabels[task.state]}
          </span>
        )}
        {project && !hideProject && (
          <Link
            className="project-tag"
            title={project.name}
            href={`/projects/${encodeURIComponent(project.id)}`}
            prefetch={true}
          >
            <span className={`dot ${project.color}`} />
            {project.name}
          </Link>
        )}
        {!project && client && !hideProject && (
          <Link
            className="project-tag client-tag"
            title={client.name}
            href={`/clients/${encodeURIComponent(client.id)}`}
            prefetch={true}
          >
            <span className="dot blue" />
            {client.name}
          </Link>
        )}
        <span
          className={`task-date ${task.due && task.due < today && !task.done ? "overdue" : ""}`}
        >
          {prettyDate(task.due, today)}
        </span>
      </div>
      <button
        className="icon-button row-more"
        aria-label={`Edit ${task.title}`}
        onClick={() => openEditor({ kind: "task", id: task.id })}
      >
        <MoreHorizontal size={17} />
      </button>
    </div>
  );
}
export function ProjectCard({ project }: { project: Project }) {
  const { data, today } = useItems();
  const tasks = data.tasks.filter((t) => t.project_id === project.id);
  const done = tasks.filter((t) => t.done).length;
  const customer = data.customers.find((c) => c.id === project.customer_id);
  return (
    <Link
      className="project-card"
      href={`/projects/${encodeURIComponent(project.id)}`}
      prefetch={true}
    >
      <div className="project-card-top">
        <ProjectMark color={project.color} />
        <span className={`status-pill ${project.status.toLowerCase()}`}>
          <span />
          {project.status}
        </span>
      </div>
      <span className="project-customer">
        {customer?.name || "Personal project"}
      </span>
      <h3>{project.name}</h3>
      <p>{project.description || "No description"}</p>
      <div className="project-progress-label">
        <span>
          {done} of {tasks.length} tasks
        </span>
        <span>
          {tasks.length ? Math.round((done / tasks.length) * 100) : 0}%
        </span>
      </div>
      <div className="progress-track">
        <span
          className={project.color}
          style={{
            width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`,
          }}
        />
      </div>
      <div className="project-card-bottom">
        <span>
          <CalendarDays size={13} />
          {project.due ? prettyDate(project.due, today) : "No deadline"}
        </span>
        <ArrowUpRight size={16} />
      </div>
    </Link>
  );
}
export function FollowUp({ customer }: { customer: Customer }) {
  const { today, openDetail } = useItems();
  return (
    <div className="follow-up">
      <button
        className="follow-up-open"
        onClick={() => openDetail("customer", customer.id)}
      >
        <span
          className={`avatar ${customer.stage === "In conversation" ? "lavender" : "sand"}`}
        >
          {initials(customer.name)}
        </span>
        <span className="follow-up-copy">
          <strong>{customer.name}</strong>
          <small>
            {customer.contact || customer.stage} ·{" "}
            {customer.relationship_status}
          </small>
        </span>
        <span
          className={`follow-up-date ${customer.follow_up <= today ? "due" : ""}`}
        >
          {customer.follow_up < today
            ? "Overdue"
            : prettyDate(customer.follow_up, today)}
        </span>
        <ArrowUpRight size={14} className="muted" />
      </button>
      {customer.email && (
        <a
          className="icon-button follow-up-email"
          href={mailtoHref(customer.email)}
          aria-label={`Email ${customer.name}`}
          title={customer.email}
        >
          <Mail size={14} />
        </a>
      )}
    </div>
  );
}
