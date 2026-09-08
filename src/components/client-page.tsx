"use client";

import Link from "next/link";
import { flushSync } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCheck,
  FileText,
  FolderClosed,
  Mail,
  Plus,
  Settings2,
  Users,
} from "lucide-react";
import { mailtoHref } from "@/lib/mailto";
import type { Customer, Workspace } from "@/lib/types";
import type { Editor } from "./item-form";
import {
  ActivityForm,
  emptyActivity,
  type ActivityDraft,
} from "./activity-drafts";
import { Timeline } from "./timeline";
import { ProjectMark, TaskRow } from "./workspace-items";

export function ClientPage({
  client,
  data,
  openEditor,
  draft,
  onDraftChange,
  onActivityPending,
  notify,
}: {
  client: Customer;
  data: Workspace;
  openEditor: (editor: Editor) => void;
  draft?: ActivityDraft;
  onDraftChange: (draft: ActivityDraft) => void;
  onActivityPending: (pending: boolean) => void;
  notify: (message: string) => void;
}) {
  const activityButton = useRef<HTMLButtonElement>(null);
  const [focusActivity, setFocusActivity] = useState(false);
  function closeActivity() {
    flushSync(() => {
      setActivityOpen(false);
      setFocusActivity(false);
    });
    activityButton.current?.focus();
  }
  const [activityOpen, setActivityOpen] = useState(!!draft?.body);
  useEffect(() => {
    if (draft?.body) setActivityOpen(true);
  }, [draft?.body]);
  const projects = data.projects.filter(
    (project) => project.customer_id === client.id,
  );
  const projectIds = new Set(projects.map((project) => project.id));
  const tasks = data.tasks.filter(
    (task) =>
      task.customer_id === client.id ||
      (!!task.project_id && projectIds.has(task.project_id)),
  );
  const notes = data.notes.filter(
    (note) =>
      note.customer_id === client.id ||
      (!!note.project_id && projectIds.has(note.project_id)),
  );
  const activities = data.activities.filter(
    (activity) => activity.customer_id === client.id,
  );
  const activeProjects = projects.filter(
    (project) => project.status !== "Completed",
  );
  const completedProjects = projects.filter(
    (project) => project.status === "Completed",
  );

  const newProject = () =>
    openEditor({ kind: "project", customerId: client.id });
  const newTask = () => openEditor({ kind: "task", customerId: client.id });

  return (
    <article className="project-page client-page">
      <Link href="/?view=customers" className="project-back">
        <ArrowLeft size={14} />
        All relationships
      </Link>
      <div className="project-hero">
        <span className="client-mark">
          <Users size={23} strokeWidth={1.6} />
        </span>
        <div className="project-hero-copy">
          <div className="project-title-line">
            <h1>{client.name}</h1>
            <span
              className={`relationship-pill ${client.relationship_status.toLowerCase()}`}
            >
              {client.relationship_status}
            </span>
          </div>
          <p className="detail-description">
            {client.details || "No relationship details yet."}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => openEditor({ kind: "customer", id: client.id })}
        >
          <Settings2 size={15} />
          Edit relationship
        </button>
      </div>

      <div className="project-overview client-overview">
        <div className="project-fact">
          <span className="project-fact-label">Contact</span>
          <strong>{client.contact || "No contact person"}</strong>
          {client.email && (
            <a className="customer-email" href={mailtoHref(client.email)}>
              <Mail size={14} />
              {client.email}
            </a>
          )}
        </div>
        <div className="project-fact">
          <span className="project-fact-label">Pipeline stage</span>
          <strong>{client.stage}</strong>
        </div>
        <div className="project-fact">
          <span className="project-fact-label">Related work</span>
          <strong>
            {projects.length} {projects.length === 1 ? "project" : "projects"} ·{" "}
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </strong>
        </div>
      </div>

      <div className="client-actions">
        <button className="button primary" onClick={newProject}>
          <Plus size={15} />
          Start a project
        </button>
        <button className="button secondary" onClick={newTask}>
          <Plus size={15} />
          Add standalone task
        </button>
        <button
          className="button secondary"
          onClick={() => openEditor({ kind: "note", customerId: client.id })}
        >
          <Plus size={15} />
          Add note
        </button>
      </div>

      <div className="client-content-grid">
        <section
          className="panel client-work"
          aria-labelledby="client-work-title"
        >
          <div className="section-heading">
            <h2 id="client-work-title">
              Projects <span className="count-badge">{projects.length}</span>
            </h2>
            <button className="text-link" onClick={newProject}>
              <Plus size={15} />
              New project
            </button>
          </div>
          {[...activeProjects, ...completedProjects].map((project) => (
            <Link
              key={project.id}
              className="detail-note client-project-row"
              href={`/projects/${encodeURIComponent(project.id)}`}
              prefetch={true}
            >
              <ProjectMark color={project.color} size="small" />
              <span>
                <strong>{project.name}</strong>
                <small>{project.status}</small>
              </span>
              <ArrowUpRight size={14} />
            </Link>
          ))}
          {!projects.length && (
            <div className="empty-state compact-empty">
              <FolderClosed size={22} />
              <h3>No projects yet</h3>
              <p>Start the first piece of work from this relationship.</p>
            </div>
          )}
          {!!completedProjects.length && (
            <button className="inline-add" onClick={newProject}>
              <Plus size={16} />
              Start repeat work
            </button>
          )}

          <div className="section-heading client-section-gap">
            <h2>
              Tasks <span className="count-badge">{tasks.length}</span>
            </h2>
            <button className="text-link" onClick={newTask}>
              <Plus size={15} />
              Add task
            </button>
          </div>
          <div className="project-task-rows">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
            {!tasks.length && (
              <div className="empty-state compact-empty">
                <CheckCheck size={22} />
                <h3>No related tasks</h3>
                <p>Add a task without creating a project first.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="client-context">
          <section className="panel project-notes">
            <div className="section-heading">
              <h2>
                Notes <span className="count-badge">{notes.length}</span>
              </h2>
              <button
                className="text-link"
                onClick={() =>
                  openEditor({ kind: "note", customerId: client.id })
                }
              >
                <Plus size={15} />
                Add note
              </button>
            </div>
            <div className="project-note-list">
              {notes.map((note) => (
                <button
                  key={note.id}
                  className="project-note"
                  onClick={() => openEditor({ kind: "note", id: note.id })}
                >
                  <div>
                    <FileText size={16} />
                    <h3>{note.title}</h3>
                    <ArrowUpRight size={14} />
                  </div>
                  <p>{note.body || "Empty note"}</p>
                </button>
              ))}
              {!notes.length && (
                <p className="detail-empty">No linked notes yet.</p>
              )}
            </div>
          </section>

          <section className="panel client-activity">
            <div className="section-heading">
              <h2>Timeline</h2>
              {!activityOpen && (
                <button
                  className="text-link"
                  ref={activityButton}
                  onClick={() => {
                    setFocusActivity(true);
                    setActivityOpen(true);
                  }}
                >
                  <Plus size={15} />
                  {draft?.body ? "Continue activity" : "New activity"}
                </button>
              )}
            </div>
            {activityOpen && (
              <div className="activity-composer">
                <ActivityForm
                  autoFocus={focusActivity}
                  customerId={client.id}
                  notify={(message) => {
                    notify(message);
                    closeActivity();
                  }}
                  draft={draft || emptyActivity}
                  onDraftChange={onDraftChange}
                  onPendingChange={onActivityPending}
                  appearance="plain"
                  onCancel={() => {
                    if (
                      draft?.body &&
                      !window.confirm("Discard this activity draft?")
                    )
                      return;
                    onDraftChange(emptyActivity);
                    closeActivity();
                  }}
                />
              </div>
            )}
            <div className="timeline">
              <Timeline activities={activities} projects={data.projects} />
            </div>
          </section>
        </aside>
      </div>
    </article>
  );
}
