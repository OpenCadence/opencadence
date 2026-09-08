import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  FileText,
  FolderClosed,
  MessageSquare,
  Plus,
} from "lucide-react";
import type { Workspace } from "@/lib/types";
import { getAttention } from "@/lib/attention";
import type { Editor } from "./item-form";
import { TaskRow, FollowUp, ProjectCard } from "./workspace-items";

export function TodayView({
  data,
  today,
  openEditor,
}: {
  data: Workspace;
  today: string;
  openEditor: (editor: Editor) => void;
}) {
  const { actions, waitingOnMe, waitingOnClients, dueFollowUps } = getAttention(
    data,
    today,
  );
  const yourActionsCount = actions.length + waitingOnMe.length;
  const activeProjects = data.projects.filter(
    (project) => project.status === "Active",
  );
  return (
    <>
      <div className="page-heading today-heading">
        <h1>Today</h1>
      </div>
      <div className="overview-grid">
        <div className="stats-grid">
          <Link href="/?view=tasks" className="stat-card">
            <span className="stat-icon green" aria-hidden="true">
              <CheckCheck size={18} />
            </span>
            <span className="stat-number">{yourActionsCount}</span>
            <span className="stat-title">Your actions</span>
            <span className="stat-caption">
              Today & overdue <ArrowUpRight size={14} aria-hidden="true" />
            </span>
          </Link>
          <Link href="/?view=projects" className="stat-card">
            <span className="stat-icon purple" aria-hidden="true">
              <FolderClosed size={18} />
            </span>
            <span className="stat-number">{activeProjects.length}</span>
            <span className="stat-title">Active projects</span>
            <span className="stat-caption">
              View projects <ArrowUpRight size={14} aria-hidden="true" />
            </span>
          </Link>
          <Link href="/?view=customers" className="stat-card">
            <span className="stat-icon orange" aria-hidden="true">
              <MessageSquare size={18} />
            </span>
            <span className="stat-number">{dueFollowUps.length}</span>
            <span className="stat-title">Follow-ups due</span>
            <span className="stat-caption">
              View clients <ArrowUpRight size={14} aria-hidden="true" />
            </span>
          </Link>
        </div>
      </div>
      <div className="daily-grid">
        <section className="panel task-panel" id="today-tasks">
          <div className="section-heading">
            <h2>
              Your actions{" "}
              <span className="count-badge">{yourActionsCount}</span>
            </h2>
            <Link className="text-link" href="/?view=tasks">
              All tasks <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="panel-caption">Due today and overdue.</div>
          <div className="attention-group">
            <h3>Next actions</h3>
            <div className="task-list">
              {actions.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
              {!actions.length && (
                <p className="attention-empty">No next actions due.</p>
              )}
            </div>
          </div>
          <div className="attention-group">
            <h3>People waiting on you</h3>
            <div className="task-list">
              {waitingOnMe.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
              {!waitingOnMe.length && (
                <p className="attention-empty">Nobody is waiting on you.</p>
              )}
            </div>
          </div>
          <button
            className="inline-add"
            onClick={() => openEditor({ kind: "task" })}
          >
            <Plus size={16} />
            Add a task<span>N</span>
          </button>
        </section>
        <section className="panel follow-panel">
          <div className="section-heading">
            <h2>Client attention</h2>
            <Link
              className="icon-button"
              href="/?view=customers"
              aria-label="View client pipeline"
            >
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="panel-caption">Who owes the next move.</div>
          <div className="attention-group">
            <h3>
              Waiting on clients{" "}
              <span className="count-badge">{waitingOnClients.length}</span>
            </h3>
            <div className="task-list">
              {waitingOnClients.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
              {!waitingOnClients.length && (
                <p className="attention-empty">No client responses due.</p>
              )}
            </div>
          </div>
          <div className="attention-group">
            <h3>Follow-ups due</h3>
            <div className="follow-list">
              {dueFollowUps.map((customer) => (
                <FollowUp key={customer.id} customer={customer} />
              ))}
              {!dueFollowUps.length && (
                <p className="attention-empty">No follow-ups due.</p>
              )}
            </div>
          </div>
          <Link href="/?view=customers" className="pipeline-link">
            View clients <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <section className="projects-section">
        <div className="section-heading">
          <h2>Active projects</h2>
          <Link className="text-link" href="/?view=projects">
            All projects <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="project-grid">
          {activeProjects.slice(0, 3).map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
          {!activeProjects.length && (
            <button
              className="new-project-card"
              onClick={() => openEditor({ kind: "project" })}
            >
              <Plus size={24} />
              <h3>New project</h3>
            </button>
          )}
        </div>
      </section>
      <section className="recent-notes">
        <div className="section-heading">
          <h2>Recent notes</h2>
          <Link className="text-link" href="/?view=notes">
            All notes <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="notes-strip">
          {data.notes.slice(0, 3).map((n) => (
            <button
              key={n.id}
              onClick={() => openEditor({ kind: "note", id: n.id })}
            >
              <FileText size={17} strokeWidth={1.5} />
              <span>{n.title}</span>
              <ArrowUpRight size={14} />
            </button>
          ))}
          {!data.notes.length && (
            <button onClick={() => openEditor({ kind: "note" })}>
              <Plus size={17} />
              New note
              <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      </section>
    </>
  );
}
