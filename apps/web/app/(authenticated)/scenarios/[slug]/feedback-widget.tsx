"use client";

import { useState, useTransition } from "react";
import { FEEDBACK_BODY_MAX_CHARS } from "@ci-train/contracts";
import {
  submitScenarioFeedbackAction,
  type SubmitFeedbackResult,
} from "./actions";

interface Props {
  slug: string;
}

// Bottom-of-page feedback widget. Optional 1-5 rating, required
// body. Append-only — submitting replaces the form with a small
// "thanks, submit another?" panel rather than clearing the
// fields, so an enthusiastic pilot user can leave several notes
// in one sitting without re-typing the rating.
export function FeedbackWidget({ slug }: Props) {
  const [body, setBody] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [result, setResult] = useState<SubmitFeedbackResult | null>(null);
  const [pending, startTransition] = useTransition();

  const remaining = FEEDBACK_BODY_MAX_CHARS - body.length;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData();
    form.set("body", body);
    if (rating !== null) form.set("rating", String(rating));
    startTransition(async () => {
      const r = await submitScenarioFeedbackAction(slug, result ?? undefined, form);
      setResult(r);
      if (r.ok) {
        setBody("");
        setRating(null);
      }
    });
  }

  function startAnother() {
    setResult(null);
  }

  return (
    <section
      aria-labelledby="feedback-heading"
      style={{
        marginTop: "2rem",
        padding: "1rem 1.25rem",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <h2
        id="feedback-heading"
        style={{
          fontSize: "0.95rem",
          margin: "0 0 0.25rem 0",
          color: "var(--fg-strong)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Feedback on this challenge
      </h2>
      <p style={{ margin: "0 0 0.75rem 0", color: "var(--muted)", fontSize: "0.85rem" }}>
        Found a typo, an unclear question, or a debrief that helped /
        didn't? Drop a quick note. Visible only to admins.
      </p>

      {result?.ok ? (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            background: "var(--status-ok-bg)",
            border: "1px solid var(--status-ok-border)",
            color: "var(--status-ok-fg)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <span>Thanks — feedback recorded.</span>
          <button
            type="button"
            onClick={startAnother}
            style={{
              background: "transparent",
              border: "1px solid var(--status-ok-border)",
              color: "var(--status-ok-fg)",
              borderRadius: "var(--radius-md)",
              padding: "0.35rem 0.75rem",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Add another note
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.85rem",
                color: "var(--muted-strong)",
                marginRight: "0.5rem",
              }}
            >
              Rating (optional):
            </span>
            <span role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => {
                const selected = rating === n;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setRating(selected ? null : n)}
                    title={`${n} of 5`}
                    style={{
                      background: selected ? "var(--bg-active)" : "transparent",
                      border: `1px solid ${
                        selected ? "var(--accent)" : "var(--border)"
                      }`,
                      color: selected ? "var(--accent)" : "var(--fg)",
                      borderRadius: "var(--radius-pill)",
                      padding: "0.25rem 0.65rem",
                      marginRight: "0.25rem",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      minWidth: "2.25rem",
                    }}
                  >
                    {n}
                  </button>
                );
              })}
              {rating !== null ? (
                <button
                  type="button"
                  onClick={() => setRating(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--muted)",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    marginLeft: "0.5rem",
                  }}
                >
                  clear
                </button>
              ) : null}
            </span>
          </div>

          <label
            htmlFor="feedback-body"
            style={{
              display: "block",
              fontSize: "0.85rem",
              color: "var(--muted-strong)",
              marginBottom: "0.25rem",
            }}
          >
            Note
          </label>
          <textarea
            id="feedback-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={FEEDBACK_BODY_MAX_CHARS}
            rows={3}
            required
            placeholder="e.g. Q3's wording is ambiguous; took me 4 tries to land it."
            style={{
              width: "100%",
              minHeight: "5rem",
              padding: "0.5rem 0.75rem",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "var(--bg)",
              color: "var(--fg)",
              fontFamily: "inherit",
              fontSize: "0.9rem",
              resize: "vertical",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "0.5rem",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                color: remaining < 100 ? "var(--status-warn-fg)" : "var(--muted)",
              }}
            >
              {remaining} characters left
            </span>
            <button
              type="submit"
              disabled={pending || body.trim().length === 0}
              style={{
                background: "var(--accent)",
                color: "#fff",
                border: "0",
                borderRadius: "var(--radius-md)",
                padding: "0.45rem 1rem",
                cursor:
                  pending || body.trim().length === 0
                    ? "not-allowed"
                    : "pointer",
                opacity: pending || body.trim().length === 0 ? 0.6 : 1,
                fontWeight: 500,
              }}
            >
              {pending ? "Submitting…" : "Send feedback"}
            </button>
          </div>

          {result && !result.ok ? (
            <p
              style={{
                marginTop: "0.5rem",
                color: "var(--status-bad-fg)",
                fontSize: "0.85rem",
              }}
            >
              {result.error}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
