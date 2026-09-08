"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  FileText,
  FolderClosed,
  LayoutGrid,
  ListTodo,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { stages, type Workspace, type View } from "@/lib/types";
import type { Editor } from "./item-form";
import { TaskRow, ProjectCard, prettyDate, initials } from "./workspace-items";
import { navigation } from "./workspace-navigation";

function EmptyState({
  icon: Icon = FileText,
  title,
  body,
  action,
  label,
}: {
  icon?: typeof FileText;
  title: string;
  body: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={23} strokeWidth={1.5} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && (
        <button className="button secondary" onClick={action}>
          <Plus size={15} />
          {label}
        </button>
      )}
    </div>
  );
}

export function WorkspaceCollectionView({
  data,
  view,
  today,
  openEditor,
  openClient,
}: {
  data: Workspace;
  view: Exclude<View, "today">;
  today: string;
  openEditor: (editor: Editor) => void;
  openClient: (id: string) => void;
}) {
  const [taskFilter, setTaskFilter] = useState("Open");
  const [projectFilter, setProjectFilter] = useState("Active");
  const [customerMode, setCustomerMode] = useState<"board" | "list">("board");
  const [relationshipFilter, setRelationshipFilter] = useState<
    "Lead" | "Client" | "Archived" | "All"
  >("All");
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => setSearchQuery(""), [view]);

  const singular =
    view === "customers"
      ? "customer"
      : view === "projects"
        ? "project"
        : view === "notes"
          ? "note"
          : "task";
  const singularLabel = singular === "customer" ? "client" : singular;
  const matchesSearch = (value: string) =>
    value.toLowerCase().includes(searchQuery.toLowerCase());
  const filteredNotes = data.notes.filter((note) =>
    matchesSearch(note.title + " " + note.body),
  );
  const filteredProjects = data.projects.filter(
    (project) =>
      (projectFilter === "All" || project.status === projectFilter) &&
      matchesSearch(
        project.name +
          " " +
          (data.customers.find(
            (customer) => customer.id === project.customer_id,
          )?.name || ""),
      ),
  );
  const filteredCustomers = data.customers.filter(
    (customer) =>
      (relationshipFilter === "All" ||
        customer.relationship_status === relationshipFilter) &&
      matchesSearch(
        `${customer.name} ${customer.contact} ${customer.email} ${customer.details}`,
      ),
  );
  const filteredTasks = data.tasks.filter(
    (task) =>
      matchesSearch(task.title) &&
      (taskFilter === "Completed"
        ? !!task.done
        : !task.done &&
          (taskFilter === "Today"
            ? !!task.due && task.due <= today
            : taskFilter === "Upcoming"
              ? task.due > today
              : true)),
  );

  return (
    <>
      <div className="page-heading list-heading">
        <h1>{navigation.find((item) => item.id === view)?.label}</h1>
      </div>
      <div className="view-toolbar">
        {view === "tasks" ? (
          <div className="tabs">
            {["Open", "Today", "Upcoming", "Completed"].map((t) => (
              <button
                className={taskFilter === t ? "active" : ""}
                aria-pressed={taskFilter === t}
                key={t}
                onClick={() => setTaskFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
        ) : view === "projects" ? (
          <div className="tabs">
            {["Active", "Paused", "Completed", "All"].map((t) => (
              <button
                key={t}
                className={projectFilter === t ? "active" : ""}
                aria-pressed={projectFilter === t}
                onClick={() => setProjectFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
        ) : view === "customers" ? (
          <div className="tabs" aria-label="Filter relationships">
            {(["Lead", "Client", "Archived", "All"] as const).map((status) => (
              <button
                key={status}
                className={relationshipFilter === status ? "active" : ""}
                aria-pressed={relationshipFilter === status}
                onClick={() => setRelationshipFilter(status)}
              >
                {status === "Client"
                  ? "Clients"
                  : status === "Lead"
                    ? "Leads"
                    : status}
              </button>
            ))}
          </div>
        ) : (
          <span className="result-count">
            {filteredNotes.length}{" "}
            {filteredNotes.length === 1 ? "note" : "notes"}
          </span>
        )}
        <div className="toolbar-right">
          <label className="filter-search">
            <Search size={15} />
            <input
              aria-label={`Filter ${view === "customers" ? "clients" : view}`}
              placeholder={`Find a ${singularLabel}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          {view === "customers" && (
            <div className="segmented">
              <button
                className={customerMode === "board" ? "active" : ""}
                aria-label="Board view"
                aria-pressed={customerMode === "board"}
                onClick={() => setCustomerMode("board")}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                className={customerMode === "list" ? "active" : ""}
                aria-label="List view"
                aria-pressed={customerMode === "list"}
                onClick={() => setCustomerMode("list")}
              >
                <ListTodo size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
      {view === "tasks" && (
        <section className="panel all-tasks">
          <div className="list-label">
            <span>
              {taskFilter}{" "}
              <span className="count-badge">{filteredTasks.length}</span>
            </span>
            <span>PROJECT / DUE DATE</span>
          </div>
          {filteredTasks.length ? (
            filteredTasks.map((t) => <TaskRow key={t.id} task={t} />)
          ) : (
            <EmptyState
              icon={CheckCheck}
              title={
                searchQuery ? "No matching tasks" : "No tasks in this view"
              }
              body={
                searchQuery
                  ? "Try a different search."
                  : "Add a task or choose another view."
              }
              action={
                searchQuery ? undefined : () => openEditor({ kind: "task" })
              }
              label="Add a task"
            />
          )}
          <button
            className="inline-add"
            onClick={() => openEditor({ kind: "task" })}
          >
            <Plus size={16} />
            Add a task<span>N</span>
          </button>
        </section>
      )}
      {view === "projects" && (
        <div className="project-grid full-projects">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {!filteredProjects.length && (
            <EmptyState
              icon={FolderClosed}
              title={
                searchQuery
                  ? "No matching projects"
                  : "No projects in this view"
              }
              body={
                searchQuery
                  ? "Try a different search."
                  : "Create a project or choose another view."
              }
            />
          )}
          <button
            className="new-project-card"
            onClick={() => openEditor({ kind: "project" })}
          >
            <Plus size={23} />
            <h3>New project</h3>
          </button>
        </div>
      )}
      {view === "customers" &&
        (customerMode === "board" ? (
          <div className="pipeline-board">
            {stages.map((stage, index) => {
              const customers = filteredCustomers.filter(
                (customer) => customer.stage === stage,
              );
              return (
                <section className="pipeline-column" key={stage}>
                  <div className="pipeline-column-head">
                    <span className={`stage-dot stage-${index}`} />
                    <h2>{stage}</h2>
                    <span className="column-count">{customers.length}</span>
                    <button
                      className="icon-button"
                      aria-label={`Add client to ${stage}`}
                      onClick={() => openEditor({ kind: "customer", stage })}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="pipeline-cards">
                    {customers.map((c) => {
                      const projectCount = data.projects.filter(
                        (project) => project.customer_id === c.id,
                      ).length;
                      return (
                        <button
                          key={c.id}
                          className="customer-card"
                          onClick={() => openClient(c.id)}
                        >
                          <span
                            className={`avatar ${index % 2 ? "lavender" : "sand"}`}
                          >
                            {initials(c.name)}
                          </span>
                          <h3>{c.name}</h3>
                          <p>{c.contact || "Add a contact"}</p>
                          <div className="customer-card-footer">
                            <span>
                              {projectCount}{" "}
                              {projectCount === 1 ? "project" : "projects"}
                            </span>
                            {c.follow_up && (
                              <span
                                className={c.follow_up < today ? "overdue" : ""}
                              >
                                <CalendarDays size={12} />
                                {prettyDate(c.follow_up, today)}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {!customers.length && (
                      <div className="column-empty">
                        {searchQuery ? "No matches" : "No clients"}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="panel customer-list">
            {filteredCustomers.map((c) => (
              <button key={c.id} onClick={() => openClient(c.id)}>
                <span className="avatar sand">{initials(c.name)}</span>
                <span className="customer-list-name">
                  <strong>{c.name}</strong>
                  <small>{c.contact || "No contact yet"}</small>
                </span>
                <span
                  className={`relationship-pill ${c.relationship_status.toLowerCase()}`}
                >
                  {c.relationship_status}
                </span>
                <span className="muted">
                  {c.follow_up
                    ? prettyDate(c.follow_up, today)
                    : "No follow-up"}
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
            {!filteredCustomers.length && (
              <EmptyState
                icon={Users}
                title={searchQuery ? "No matching clients" : "No clients yet"}
                body={
                  searchQuery
                    ? "No clients match this search."
                    : "Add a client to track their projects and follow-ups."
                }
                action={() => openEditor({ kind: "customer" })}
                label="Add a client"
              />
            )}
          </div>
        ))}
      {view === "notes" && (
        <div className="notes-grid">
          {filteredNotes.map((note, index) => (
            <button
              className={`note-card paper-${index % 3}`}
              key={note.id}
              onClick={() => openEditor({ kind: "note", id: note.id })}
            >
              <div className="note-card-top">
                <FileText size={18} strokeWidth={1.4} />
                <ArrowUpRight size={16} />
              </div>
              <h2>{note.title}</h2>
              <p>{note.body || "Empty note"}</p>
              <div className="note-card-bottom">
                <span>
                  {data.projects.find((p) => p.id === note.project_id)?.name ||
                    data.customers.find((c) => c.id === note.customer_id)
                      ?.name ||
                    "Personal note"}
                </span>
                <time>
                  {new Date(note.updated_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </time>
              </div>
            </button>
          ))}
          {!filteredNotes.length && (
            <EmptyState
              title={searchQuery ? "No matching notes" : "No notes yet"}
              body={
                searchQuery
                  ? "Try a different search."
                  : "Create a note to keep your ideas and reference material."
              }
            />
          )}
          <button
            className="new-project-card new-note"
            onClick={() => openEditor({ kind: "note" })}
          >
            <Plus size={24} />
            <h3>New note</h3>
          </button>
        </div>
      )}
    </>
  );
}
