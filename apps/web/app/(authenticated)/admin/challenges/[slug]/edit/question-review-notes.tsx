"use client";

import { useActionState } from "react";
import type { ActionResult } from "./actions";

// Per-question review-notes textarea. Lives below the
// QuestionForm in each question card on the edit page. Calls
// the dedicated /admin/challenges/:slug/questions/:qid/review
// endpoint via the server action passed in, so it's
// independent of question content edits and the form can be
// submitted without rewriting the question itself.

interface Props {
  // Bound server action (the page does `.bind(null, slug, qid)`
  // so this component doesn't need to know the slug or id).
  action: (
    state: ActionResult | undefined,
    formData: FormData,
  ) => Promise<ActionResult>;
  defaultValue: string;
}

export function QuestionReviewNotes({ action, defaultValue }: Props) {
  const [state, runAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  return (
    <form
      action={runAction}
      style={{
        marginTop: ".75rem",
        padding: ".75rem",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-sunken)",
        border: "1px solid var(--border)",
      }}
    >
      <label
        style={{
          display: "block",
          marginBottom: ".5rem",
          color: "var(--muted-strong)",
          fontSize: ".82rem",
          fontWeight: 500,
        }}
      >
        Reviewer notes (admin-only — not shown to users)
      </label>
      <textarea
        name="notes"
        defaultValue={defaultValue}
        rows={3}
        maxLength={4000}
        placeholder="What's wrong with this question? Phrasing, options, expected answer, debrief — anything to flag for a future rewrite pass."
        className="textarea"
        style={{ fontSize: ".88rem", minHeight: "4.5rem" }}
      />
      <div
        style={{
          display: "flex",
          gap: ".5rem",
          alignItems: "center",
          marginTop: ".4rem",
        }}
      >
        <button
          type="submit"
          className="btn btn-ghost btn-sm"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save notes"}
        </button>
        {state?.ok ? (
          <span className="save-badge save-saved">saved</span>
        ) : null}
        {state && !state.ok ? (
          <span className="form-message error" style={{ margin: 0, padding: 0, border: 0, background: "transparent" }}>
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
