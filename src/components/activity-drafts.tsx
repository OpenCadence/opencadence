"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { Loader2, Plus } from "lucide-react";
import { addActivity } from "@/lib/actions";
import { activityKinds, type ActivityKind, type Customer } from "@/lib/types";
import { Dialog } from "./dialog";
import { useUnsavedChanges } from "./use-unsaved-changes";

export type ActivityDraft = { body: string; kind: ActivityKind };
export const emptyActivity: ActivityDraft = { body: "", kind: "Note" };
type CustomerDraft = ActivityDraft & { customerName: string };
const activityDraftStorageKey = "opencadence.activity-drafts.v1";

function storeDrafts(drafts: Record<string, CustomerDraft>) {
  try {
    sessionStorage.setItem(activityDraftStorageKey, JSON.stringify(drafts));
  } catch {
    // Storage can be unavailable; drafts still work for the current render tree.
  }
}

/** Drafts belong to this browser tab, not to a route, dialog, or snapshot. */
export function useActivityDrafts(customers: Customer[]) {
  const [drafts, setDrafts] = useState<Record<string, CustomerDraft>>({});
  useEffect(() => {
    try {
      const stored = JSON.parse(
        sessionStorage.getItem(activityDraftStorageKey) || "{}",
      ) as Record<string, CustomerDraft>;
      const valid = Object.fromEntries(
        Object.entries(stored).filter(
          ([id, draft]) =>
            id &&
            typeof draft?.body === "string" &&
            draft.body.length <= 10000 &&
            typeof draft.customerName === "string" &&
            draft.customerName.length <= 200 &&
            activityKinds.includes(draft.kind),
        ),
      );
      setDrafts(valid);
    } catch {
      // Ignore malformed or unavailable session storage.
    }
  }, []);
  useUnsavedChanges(Object.values(drafts).some((draft) => !!draft.body));
  function discard(id: string) {
    setDrafts((previous) => {
      const next = { ...previous };
      delete next[id];
      storeDrafts(next);
      return next;
    });
  }
  return {
    drafts,
    discard,
    change(customer: Customer, draft: ActivityDraft) {
      if (!draft.body && draft.kind === emptyActivity.kind) {
        discard(customer.id);
        return;
      }
      setDrafts((previous) => {
        const next = {
          ...previous,
          [customer.id]: { ...draft, customerName: customer.name },
        };
        storeDrafts(next);
        return next;
      });
    },
    // Never prune from a refreshed snapshot: another window may have deleted a customer.
    orphaned: Object.entries(drafts).filter(
      ([id, draft]) =>
        draft.body && !customers.some((customer) => customer.id === id),
    ),
  };
}

export function ActivityDraftRecovery({
  drafts,
  onDiscard,
  onEmpty,
}: {
  drafts: [string, CustomerDraft][];
  onDiscard: (id: string) => void;
  onEmpty: () => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  if (!drafts.length) return null;
  return (
    <>
      <div className="example-banner" role="status">
        <span>Unsaved activity for removed clients is still available.</span>
        <button
          onClick={() => {
            setFeedback(null);
            setOpen(true);
          }}
        >
          Recover activity drafts ({drafts.length})
        </button>
      </div>
      {open && (
        <Dialog
          title="Recover activity drafts"
          onClose={() => setOpen(false)}
          feedback={feedback}
        >
          <div className="editor-form" ref={content}>
            <p>
              These clients were removed. Copy your text before leaving this
              page, or explicitly discard it. Closing this dialog keeps the
              drafts.
            </p>
            {drafts.map(([id, draft]) => (
              <section key={id}>
                <label>
                  {draft.customerName} · {draft.kind}
                  <textarea
                    readOnly
                    value={draft.body}
                    rows={5}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </label>
                <div className="form-footer">
                  <button
                    className="button secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(draft.body);
                        setFeedback({
                          message: "Activity draft copied",
                          error: false,
                        });
                      } catch {
                        setFeedback({
                          message:
                            "Couldn't copy automatically. Select the draft text and copy it manually.",
                          error: true,
                        });
                      }
                    }}
                  >
                    Copy draft
                  </button>
                  <button
                    className="button danger"
                    onClick={() => {
                      if (
                        !window.confirm("Discard this unsaved activity draft?")
                      )
                        return;
                      const lastDraft = drafts.length === 1;
                      // Commit removal (and dialog focus restoration) before
                      // focusing a control that will survive the update.
                      flushSync(() => {
                        if (lastDraft) setOpen(false);
                        onDiscard(id);
                      });
                      if (lastDraft) onEmpty();
                      else content.current?.querySelector("textarea")?.focus();
                    }}
                  >
                    Discard draft
                  </button>
                </div>
              </section>
            ))}
          </div>
        </Dialog>
      )}
    </>
  );
}
export function ActivityForm({
  customerId,
  notify,
  draft,
  onDraftChange,
  onPendingChange,
  appearance = "card",
  autoFocus = false,
  onCancel,
}: {
  customerId: string;
  notify: (message: string) => void;
  draft: ActivityDraft;
  onDraftChange: (draft: ActivityDraft) => void;
  onPendingChange: (pending: boolean) => void;
  appearance?: "card" | "plain";
  autoFocus?: boolean;
  onCancel?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <form
      className={`activity-form ${appearance === "plain" ? "plain" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError("");
        onPendingChange(true);
        startTransition(async () => {
          try {
            const result = await addActivity(form);
            if (result.ok) {
              onDraftChange(emptyActivity);
              notify("Activity logged");
            } else setError(result.error!);
          } catch {
            setError("Couldn't save activity. Please try again.");
          } finally {
            onPendingChange(false);
          }
        });
      }}
    >
      <input type="hidden" name="customer_id" value={customerId} />
      <textarea
        autoFocus={autoFocus}
        aria-label="Activity details"
        name="body"
        required
        maxLength={10000}
        rows={3}
        placeholder="Describe the email, call, meeting, or update…"
        value={draft.body}
        onChange={(event) =>
          onDraftChange({ ...draft, body: event.target.value })
        }
        disabled={pending}
      />
      <div>
        <select
          aria-label="Activity type"
          name="activity_kind"
          value={draft.kind}
          onChange={(event) =>
            onDraftChange({
              ...draft,
              kind: event.target.value as ActivityKind,
            })
          }
          disabled={pending}
        >
          {activityKinds.map((kind) => (
            <option key={kind}>{kind}</option>
          ))}
        </select>
        <span className="spacer" />
        {onCancel && (
          <button
            type="button"
            className="button secondary small-button"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button className="button primary small-button" disabled={pending}>
          {pending ? (
            <Loader2 size={14} className="spin" />
          ) : (
            <Plus size={14} />
          )}
          Log activity
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </form>
  );
}
