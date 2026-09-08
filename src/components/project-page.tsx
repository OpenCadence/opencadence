"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  FileText,
  Plus,
  Settings2,
  Users,
} from "lucide-react";
import type { Project, Workspace } from "@/lib/types";
import type { Editor } from "./item-form";
import { prettyDate, ProjectMark, TaskRow } from "./workspace-items";

export function ProjectPage({
  project,
  data,
  today,
  openEditor,
  openCustomer,
}: {
  project: Project;
  data: Workspace;
  today: string;
  openEditor: (editor: Editor) => void;
  openCustomer: (id: string) => void;
}) {
  const [filter, setFilter] = useState("Open");
  const tasks = data.tasks.filter((task) => task.project_id === project.id);
  const notes = data.notes.filter((note) => note.project_id === project.id);
  const customer = data.customers.find(
    (item) => item.id === project.customer_id,
  );
  const completed = tasks.filter((task) => task.done).length;
  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;
  const visibleTasks = tasks.filter(
    (task) =>
      filter === "All" || (filter === "Completed" ? task.done : !task.done),
  );
  const addTask = () =>
    openEditor({
      kind: "task",
      projectId: project.id,
      customerId: project.customer_id || undefined,
    });
  const addNote = () =>
    openEditor({
      kind: "note",
      projectId: project.id,
      customerId: project.customer_id || undefined,
    });

  return (
    <article className="project-page">
      <Link href="/?view=projects" className="project-back">
        <ArrowLeft size={14} />
        All projects
      </Link>
      <div className="project-hero">
        <ProjectMark color={project.color} />
        <div className="project-hero-copy">
          <div className="project-title-line">
            <h1>{project.name}</h1>
            <span className={`status-pill ${project.status.toLowerCase()}`}>
              <span />
              {project.status}
            </span>
          </div>
          <p className="detail-description">
            {project.description ||
              "No description yet. Add a little context in project details."}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => openEditor({ kind: "project", id: project.id })}
        >
          <Settings2 size={15} />
          Edit project
        </button>
      </div>
      <div className="project-overview">
        <div className="project-fact">
          <span className="project-fact-label">
            <Users size={14} />
            Client
          </span>
          {customer ? (
            <button
              className="project-customer-link"
              onClick={() => openCustomer(customer.id)}
            >
              {customer.name}
              <ArrowUpRight size={14} />
            </button>
          ) : (
            <strong>Personal project</strong>
          )}
        </div>
        <div className="project-fact">
          <span className="project-fact-label">
            <CalendarDays size={14} />
            Target date
          </span>
          <strong
            className={
              project.due &&
              project.due < today &&
              project.status !== "Completed"
                ? "overdue"
                : ""
            }
          >
            {project.due ? (
              <time dateTime={project.due}>
                {new Date(project.due + "T12:00:00").toLocaleDateString(
                  "en-GB",
                  { day: "numeric", month: "short", year: "numeric" },
                )}
              </time>
            ) : (
              "No target date"
            )}
          </strong>
        </div>
        <div className="project-fact project-completion">
          <span className="project-fact-label">
            <CheckCheck size={14} />
            Task progress
          </span>
          <div>
            <strong>
              {completed} of {tasks.length} complete
            </strong>
            <span>{progress}%</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Task completion"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className={project.color} style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
      <div className="project-content-grid">
        <section
          className="panel project-tasks"
          aria-labelledby="project-tasks-title"
        >
          <div className="section-heading">
            <h2 id="project-tasks-title">
              Tasks <span className="count-badge">{tasks.length}</span>
            </h2>
            <button className="text-link" onClick={addTask}>
              <Plus size={15} />
              Add task
            </button>
          </div>
          <div
            className="tabs project-task-tabs"
            aria-label="Filter project tasks"
          >
            {["Open", "Completed", "All"].map((value) => (
              <button
                key={value}
                className={filter === value ? "active" : ""}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value}
                <span>
                  {value === "All"
                    ? tasks.length
                    : value === "Completed"
                      ? completed
                      : tasks.length - completed}
                </span>
              </button>
            ))}
          </div>
          <div className="project-task-rows">
            {visibleTasks.map((task) => (
              <TaskRow key={task.id} task={task} hideProject />
            ))}
            {!visibleTasks.length && (
              <div className="empty-state">
                <span className="empty-icon">
                  <CheckCheck size={23} strokeWidth={1.5} />
                </span>
                <h3>
                  {!tasks.length
                    ? "A fresh start"
                    : filter === "Completed"
                      ? "No completed tasks yet"
                      : "All caught up"}
                </h3>
                <p>
                  {!tasks.length
                    ? "Add the first task to give this project its next step."
                    : filter === "Completed"
                      ? "Tasks you complete will appear here."
                      : "Every task is complete. Add a next step when you’re ready."}
                </p>
              </div>
            )}
          </div>
          <button className="inline-add" onClick={addTask}>
            <Plus size={16} />
            Add a task<span>N</span>
          </button>
        </section>
        <section
          className="panel project-notes"
          aria-labelledby="project-notes-title"
        >
          <div className="section-heading">
            <h2 id="project-notes-title">
              Notes <span className="count-badge">{notes.length}</span>
            </h2>
            <button className="text-link" onClick={addNote}>
              <Plus size={15} />
              Add note
            </button>
          </div>
          <p className="panel-caption">The context behind the work.</p>
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
                <time dateTime={note.updated_at}>
                  Updated {prettyDate(note.updated_at.slice(0, 10), today)}
                </time>
              </button>
            ))}
            {!notes.length && (
              <div className="empty-state">
                <span className="empty-icon">
                  <FileText size={23} strokeWidth={1.5} />
                </span>
                <h3>A place for the details</h3>
                <p>Keep ideas, decisions, and useful context together.</p>
                <button className="button secondary" onClick={addNote}>
                  <Plus size={14} />
                  Add a note
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </article>
  );
}
