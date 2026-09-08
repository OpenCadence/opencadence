"use client";

import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { finishFirstRun } from "@/lib/actions";

export function FirstRunSetup() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function choose(choice: "examples" | "empty") {
    setError("");
    startTransition(async () => {
      try {
        const result = await finishFirstRun(choice);
        if (!result.ok)
          setError(result.error || "Couldn't finish setup. Please try again.");
      } catch {
        setError("Couldn't reach the server. Please try again.");
      }
    });
  }

  return (
    <section className="first-run" aria-labelledby="first-run-title">
      <div className="first-run-copy">
        <span className="eyebrow">Welcome to OpenCadence</span>
        <h1 id="first-run-title">Choose how to start</h1>
        <p>
          Explore a fictional freelance workspace, or begin with a clean slate.
          Your Community workspace is stored on the computer running
          OpenCadence.
        </p>
        {error && (
          <p className="first-run-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="first-run-actions">
        <button
          className="button primary"
          disabled={pending}
          onClick={() => choose("examples")}
        >
          <Check size={16} />
          {pending ? "Saving…" : "Use example workspace"}
        </button>
        <button
          className="button secondary"
          disabled={pending}
          onClick={() => choose("empty")}
        >
          <Trash2 size={15} />
          Start empty
        </button>
      </div>
    </section>
  );
}
