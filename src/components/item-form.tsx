"use client";

import { useId, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { Dialog } from "./dialog";
import { deleteItem, saveItem } from "@/lib/actions";
import { localDate } from "@/lib/validation";
import { recordSnapshot } from "@/lib/record-fields";
import { useUnsavedChanges } from "./use-unsaved-changes";
import {
  relationshipStatuses,
  stages,
  taskStates,
  taskStateLabels,
  type Stage,
  type Workspace,
  type Task,
  type Customer,
  type Project,
  type Note,
} from "@/lib/types";

export type Editor = {
  kind: "task" | "project" | "customer" | "note";
  id?: string;
  projectId?: string;
  customerId?: string;
  stage?: Stage;
};
export function ItemForm({
  editor,
  data,
  onClose,
  onSaved,
  hasActivityDraft = false,
  onDeleted,
}: {
  editor: Editor;
  data: Workspace;
  onClose: () => void;
  onSaved: (message: string) => void;
  hasActivityDraft?: boolean;
  onDeleted?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const deleteWarningId = useId();
  const deleteButton = useRef<HTMLButtonElement>(null);
  const deleteCancel = useRef<HTMLButtonElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  function requestClose() {
    if (!pending && (!dirty || window.confirm("Discard your unsaved changes?")))
      onClose();
  }
  const { kind, id } = editor;
  const task = data.tasks.find((t) => t.id === id) as Task | undefined;
  const project = data.projects.find((p) => p.id === id) as Project | undefined;
  const customer = data.customers.find((c) => c.id === id) as
    Customer | undefined;
  const note = data.notes.find((n) => n.id === id) as Note | undefined;
  // Capture once alongside uncontrolled defaults; never advance on a background refresh.
  const [original] = useState(() =>
    recordSnapshot(kind, task || project || customer || note || {}),
  );
  const [deleteRevision] = useState(data.revision);
  const itemLabel = kind === "customer" ? "client" : kind;
  const title = `${id ? "Edit" : "New"} ${itemLabel}`;
  const projectSelect = (value?: string | null) => (
    <label>
      Project
      <select name="project_id" defaultValue={value || editor.projectId || ""}>
        <option value="">Personal · no project</option>
        {data.projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
  const customerSelect = (value?: string | null) => (
    <label>
      Client
      <select
        name="customer_id"
        defaultValue={value || editor.customerId || ""}
      >
        <option value="">No client</option>
        {data.customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
  function submit(form: FormData) {
    setError("");
    startTransition(async () => {
      try {
        const result = await saveItem(form);
        if (result.ok) {
          onSaved(
            `${itemLabel[0].toUpperCase() + itemLabel.slice(1)} ${id ? "updated" : "created"}`,
          );
          onClose();
        } else setError(result.error!);
      } catch {
        setError(
          "Couldn't reach the server. Your draft is still here. Please try again.",
        );
      }
    });
  }
  return (
    <Dialog title={title} onClose={requestClose} wide={kind === "note"}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(new FormData(event.currentTarget));
        }}
        onChange={() => setDirty(true)}
        onKeyDown={(event) => {
          if (
            kind === "task" &&
            event.shiftKey &&
            event.key === "Enter" &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            if (!pending) event.currentTarget.requestSubmit();
          }
        }}
        className="editor-form"
      >
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id || ""} />
        <input type="hidden" name="original" value={original} />
        <fieldset disabled={pending}>
          {(kind === "task" || kind === "note") && (
            <label>
              {kind === "task" ? "Task name" : "Title"}
              <input
                name="title"
                required
                maxLength={200}
                data-autofocus
                defaultValue={task?.title || note?.title}
                placeholder={
                  kind === "task"
                    ? "e.g. Send the first round of concepts"
                    : "Note title"
                }
              />
            </label>
          )}
          {(kind === "project" || kind === "customer") && (
            <label>
              {kind === "project" ? "Project name" : "Business name"}
              <input
                name="name"
                required
                maxLength={200}
                data-autofocus
                defaultValue={project?.name || customer?.name}
                placeholder={
                  kind === "project"
                    ? "e.g. Website redesign"
                    : "e.g. Oak & Ember"
                }
              />
            </label>
          )}
          {kind === "task" && (
            <>
              <div className="form-grid">
                {projectSelect(task?.project_id)}
                {customerSelect(task?.customer_id)}
              </div>
              <div className="form-grid">
                <label>
                  Due date
                  <input
                    type="date"
                    name="due"
                    defaultValue={task ? task.due : localDate()}
                  />
                </label>
                <label>
                  Priority
                  <select
                    name="priority"
                    defaultValue={task?.priority || "Normal"}
                  >
                    <option>Normal</option>
                    <option>High</option>
                  </select>
                </label>
              </div>
              <label>
                Attention state
                <select name="state" defaultValue={task?.state || "actionable"}>
                  {taskStates.map((state) => (
                    <option key={state} value={state}>
                      {taskStateLabels[state]}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {kind === "project" && (
            <>
              <label>
                Description
                <textarea
                  name="description"
                  rows={3}
                  maxLength={4000}
                  defaultValue={project?.description}
                  placeholder="Project scope and details"
                />
              </label>
              {customerSelect(project?.customer_id)}
              <div className="form-grid">
                <label>
                  Target date
                  <input type="date" name="due" defaultValue={project?.due} />
                </label>
                <label>
                  Status
                  <select
                    name="status"
                    defaultValue={project?.status || "Active"}
                  >
                    <option>Active</option>
                    <option>Paused</option>
                    <option>Completed</option>
                  </select>
                </label>
              </div>
              <label>
                Project color
                <select name="color" defaultValue={project?.color || "green"}>
                  <option value="green">Sage</option>
                  <option value="purple">Lavender</option>
                  <option value="orange">Terracotta</option>
                  <option value="blue">Sky</option>
                </select>
              </label>
            </>
          )}
          {kind === "customer" && (
            <>
              <div className="form-grid">
                <label>
                  Contact person
                  <input
                    name="contact"
                    maxLength={200}
                    defaultValue={customer?.contact}
                    placeholder="Their name"
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    name="email"
                    maxLength={254}
                    defaultValue={customer?.email}
                    placeholder="hello@business.com"
                  />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Relationship
                  <select
                    name="relationship_status"
                    defaultValue={customer?.relationship_status || "Lead"}
                  >
                    {relationshipStatuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Pipeline stage
                  <select
                    name="stage"
                    defaultValue={customer?.stage || editor.stage || "Prospect"}
                  >
                    {stages.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Next follow-up
                <input
                  type="date"
                  name="follow_up"
                  defaultValue={customer?.follow_up}
                />
              </label>
              <label>
                Details
                <textarea
                  name="details"
                  maxLength={6000}
                  rows={4}
                  defaultValue={customer?.details}
                  placeholder="Business details and relevant background"
                />
              </label>
            </>
          )}
          {kind === "note" && (
            <>
              <label className="note-body-label">
                Note
                <textarea
                  className="note-editor"
                  name="body"
                  maxLength={50000}
                  rows={12}
                  defaultValue={note?.body}
                  placeholder="Write your note…"
                />
              </label>
              <div className="form-grid">
                {projectSelect(note?.project_id)}
                {customerSelect(note?.customer_id)}
              </div>
            </>
          )}
        </fieldset>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {confirmDelete && (
          <div
            className="delete-confirm"
            role="group"
            aria-label="Confirm deletion"
            aria-describedby={deleteWarningId}
          >
            <p id={deleteWarningId}>
              Delete this {itemLabel}?{" "}
              {kind === "customer"
                ? "Its activity history will be deleted. Linked projects, tasks, and notes will be kept without this client link."
                : kind === "project"
                  ? "Its tasks and notes will be kept without a project."
                  : "This can’t be undone."}
              {hasActivityDraft &&
                " Your unsaved activity draft will also be discarded."}
            </p>
            <button
              type="button"
              className="button danger"
              aria-describedby={deleteWarningId}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const result = await deleteItem(kind, id!, deleteRevision);
                    if (result.ok) {
                      onDeleted?.();
                      onSaved("Item deleted");
                      onClose();
                    } else setError(result.error!);
                  } catch {
                    setError("Couldn't delete this item. Please try again.");
                  }
                })
              }
            >
              Yes, delete
            </button>
            <button
              type="button"
              className="button ghost"
              ref={deleteCancel}
              aria-describedby={deleteWarningId}
              disabled={pending}
              onClick={() => {
                flushSync(() => setConfirmDelete(false));
                deleteButton.current?.focus();
              }}
            >
              Cancel
            </button>
          </div>
        )}
        <div className="form-footer">
          {id && (
            <button
              type="button"
              className="icon-button delete-button"
              aria-label={`Delete ${itemLabel}`}
              disabled={pending}
              ref={deleteButton}
              onClick={() => {
                flushSync(() => setConfirmDelete(true));
                deleteCancel.current?.focus();
              }}
            >
              <Trash2 size={17} />
            </button>
          )}
          <span className="spacer" />
          <button
            type="button"
            className="button secondary"
            disabled={pending}
            onClick={requestClose}
          >
            Cancel
          </button>
          {kind === "task" && (
            <kbd className="submit-hint" title="Submit with Shift+Enter">
              Shift + Enter
            </kbd>
          )}
          <button
            className="button primary"
            type="submit"
            disabled={pending}
            aria-keyshortcuts={kind === "task" ? "Shift+Enter" : undefined}
          >
            {pending && <Loader2 size={15} className="spin" />}
            {pending ? "Saving…" : id ? "Save changes" : `Create ${itemLabel}`}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
