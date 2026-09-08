"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  FileText,
  Mail,
  Plus,
  Settings2,
} from "lucide-react";
import { mailtoHref } from "@/lib/mailto";
import { stages, type Customer, type Workspace } from "@/lib/types";
import { Dialog } from "./dialog";
import { ActivityForm, type ActivityDraft } from "./activity-drafts";
import { Timeline } from "./timeline";
import { ProjectMark, prettyDate } from "./workspace-items";
import type { Editor } from "./item-form";

export function ClientDetailDialog({
  customer,
  data,
  today,
  pending,
  activityPending,
  feedback,
  draft,
  onClose,
  openEditor,
  updateStage,
  onDraftChange,
  onActivityPending,
  onActivitySaved,
}: {
  customer: Customer;
  data: Workspace;
  today: string;
  pending: boolean;
  activityPending: boolean;
  feedback: { message: string; error: boolean } | null;
  draft: ActivityDraft;
  onClose: () => void;
  openEditor: (editor: Editor) => void;
  updateStage: (stage: string) => void;
  onDraftChange: (draft: ActivityDraft) => void;
  onActivityPending: (pending: boolean) => void;
  onActivitySaved: (message: string) => void;
}) {
  const projects = data.projects.filter(
    (project) => project.customer_id === customer.id,
  );
  const notes = data.notes.filter((note) => note.customer_id === customer.id);
  const activities = data.activities.filter(
    (activity) => activity.customer_id === customer.id,
  );
  function allowNavigation(event: { preventDefault: () => void }) {
    if (pending || activityPending) event.preventDefault();
    else onClose();
  }

  return (
    <Dialog
      title={customer.name}
      subtitle={customer.contact || undefined}
      onClose={onClose}
      feedback={feedback}
      wide
    >
      <div className="detail-body">
        <div className="detail-top">
          <select
            className="stage-select"
            aria-label="Client stage"
            disabled={pending}
            value={customer.stage}
            onChange={(event) => updateStage(event.target.value)}
          >
            {stages.map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>
          <Link
            className="button secondary small-button"
            href={`/clients/${encodeURIComponent(customer.id)}`}
            prefetch={true}
            onNavigate={allowNavigation}
          >
            <ArrowUpRight size={14} />
            Open workspace
          </Link>
          <button
            className="button secondary small-button"
            onClick={() => openEditor({ kind: "customer", id: customer.id })}
          >
            <Settings2 size={14} />
            Edit details
          </button>
        </div>
        {customer.email && (
          <a className="customer-email" href={mailtoHref(customer.email)}>
            <Mail size={15} />
            {customer.email}
            <ArrowUpRight size={13} />
          </a>
        )}
        <p className="detail-description">
          {customer.details || "No details added."}
        </p>
        <div className="follow-up-detail">
          <CalendarDays size={16} />
          <span>Next follow-up</span>
          <strong>
            {customer.follow_up
              ? prettyDate(customer.follow_up, today)
              : "Not scheduled"}
          </strong>
          <button
            className="text-link"
            onClick={() => openEditor({ kind: "customer", id: customer.id })}
          >
            Change
          </button>
        </div>
        <div className="section-heading">
          <h3>Projects</h3>
          <button
            className="text-link"
            onClick={() =>
              openEditor({ kind: "project", customerId: customer.id })
            }
          >
            <Plus size={14} />
            New project
          </button>
        </div>
        {projects.map((project) => (
          <Link
            key={project.id}
            className="detail-note"
            href={`/projects/${encodeURIComponent(project.id)}`}
            prefetch={true}
            onNavigate={allowNavigation}
          >
            <ProjectMark color={project.color} size="small" />
            {project.name}
            <ArrowUpRight size={14} />
          </Link>
        ))}
        {!projects.length && (
          <p className="detail-empty">No projects for this client.</p>
        )}
        <div className="section-heading">
          <h3>Client notes</h3>
          <button
            className="text-link"
            onClick={() =>
              openEditor({ kind: "note", customerId: customer.id })
            }
          >
            <Plus size={14} />
            Add note
          </button>
        </div>
        {notes.map((note) => (
          <button
            key={note.id}
            className="detail-note"
            onClick={() => openEditor({ kind: "note", id: note.id })}
          >
            <FileText size={16} />
            {note.title}
            <ArrowUpRight size={14} />
          </button>
        ))}
        {!notes.length && <p className="detail-empty">No linked notes yet.</p>}
        <div className="section-heading">
          <h3>Timeline</h3>
        </div>
        <ActivityForm
          key={customer.id}
          customerId={customer.id}
          notify={onActivitySaved}
          draft={draft}
          onDraftChange={onDraftChange}
          onPendingChange={onActivityPending}
        />
        <div className="timeline">
          <Timeline
            activities={activities}
            projects={data.projects}
            onNavigate={allowNavigation}
          />
        </div>
      </div>
    </Dialog>
  );
}
