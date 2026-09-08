"use client";

import { useState, useTransition } from "react";
import { clearExamples } from "@/lib/actions";
import { Dialog } from "./dialog";

/** Errors stay in this modal; success belongs to the workspace after it closes. */
export function ClearExamplesDialog({
  hasActivityDrafts,
  onClose,
  onCleared,
}: {
  hasActivityDrafts: boolean;
  onClose: () => void;
  onCleared: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <Dialog
      title="Clear example data?"
      onClose={() => !pending && onClose()}
      feedback={error ? { message: error, error: true } : null}
    >
      <div className="clear-content">
        <p>
          This removes the remaining example tasks, projects, clients, notes,
          and activity. Items you’ve created or edited will be kept. Links to
          removed examples will be cleared.
        </p>
        {hasActivityDrafts && (
          <p>
            Unsaved activity drafts will be kept. For any removed clients, use
            Recover activity drafts to copy or discard the text after clearing.
          </p>
        )}
        <p>This can’t be undone.</p>
        <div className="form-footer">
          <button
            className="button secondary"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={pending}
            onClick={() => {
              setError("");
              startTransition(async () => {
                try {
                  const result = await clearExamples();
                  if (!result.ok)
                    setError(result.error || "Something went wrong.");
                  else {
                    onClose();
                    onCleared("Example data cleared");
                  }
                } catch {
                  setError("Couldn't reach the server. Please try again.");
                }
              });
            }}
          >
            {pending ? "Clearing…" : "Clear example data"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
