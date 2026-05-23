"use client";

import { useActionState } from "react";
import {
  REVIEW_STATUS_LABELS,
  ScenarioReviewStatus,
  type AdminScenarioSummary,
  type AuthoredQuestion,
} from "@ci-train/contracts";
import {
  setInlineScenarioReviewAction,
  setInlineQuestionReviewAction,
  type InlineReviewResult,
} from "./actions";

// M21g — admin-only inline review surface, rendered on the solve
// view (/scenarios/<slug>). Lets an operator walk through a
// challenge AND capture verdict + notes (scenario-level and
// per-question) without leaving the page.
//
// Hidden from non-admin users; the parent server component
// gates rendering on session.user.role === "admin" and passes
// the admin-only payloads down. Notes never appear in any
// regular-user payload by construction.

interface Props {
  slug: string;
  admin: AdminScenarioSummary;
  questions: AuthoredQuestion[];
}

export function InlineReviewPanel({ slug, admin, questions }: Props) {
  return (
    <details
      className="card"
      style={{
        marginBottom: "1rem",
        borderColor: "var(--brand-400)",
        background:
          "linear-gradient(180deg, rgba(83, 132, 255, 0.06) 0%, transparent 60%)",
      }}
      open={admin.reviewStatus === "needs_review"}
    >
      <summary
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: ".5rem",
          flexWrap: "wrap",
        }}
      >
        <strong style={{ color: "var(--accent)" }}>Admin review</strong>
        <span className={chipFor(admin.reviewStatus)}>
          {REVIEW_STATUS_LABELS[admin.reviewStatus]}
        </span>
        <span style={{ color: "var(--muted)", fontSize: ".82rem" }}>
          {admin.reviewedAt
            ? `Last reviewed: ${new Date(admin.reviewedAt).toLocaleString()}`
            : "Never reviewed"}
        </span>
      </summary>

      <div style={{ marginTop: ".75rem" }}>
        <ScenarioReviewForm slug={slug} admin={admin} />
        {questions.length > 0 ? (
          <div style={{ marginTop: "1rem" }}>
            <h4 style={{ marginBottom: ".4rem", fontSize: ".95rem" }}>
              Per-question notes
            </h4>
            <p
              style={{
                color: "var(--muted)",
                fontSize: ".82rem",
                margin: "0 0 .5rem 0",
              }}
            >
              One textarea per question. Saved independently of the
              scenario-level verdict above.
            </p>
            <div style={{ display: "grid", gap: ".75rem" }}>
              {questions.map((q) => (
                <QuestionInlineReview
                  key={q.id}
                  slug={slug}
                  question={q}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function ScenarioReviewForm({
  slug,
  admin,
}: {
  slug: string;
  admin: AdminScenarioSummary;
}) {
  const bound = setInlineScenarioReviewAction.bind(null, slug);
  const [state, run, pending] = useActionState<
    InlineReviewResult | undefined,
    FormData
  >(bound, undefined);

  return (
    <form action={run} style={{ display: "grid", gap: ".5rem" }}>
      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: ".25rem",
        }}
      >
        <span className="field-label">Scenario verdict</span>
        <select
          name="status"
          defaultValue={admin.reviewStatus}
          className="select"
        >
          {ScenarioReviewStatus.options.map((opt) => (
            <option key={opt} value={opt}>
              {REVIEW_STATUS_LABELS[opt]}
            </option>
          ))}
        </select>
      </label>
      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: ".25rem",
        }}
      >
        <span className="field-label">Scenario notes (admin-only)</span>
        <textarea
          name="notes"
          defaultValue={admin.reviewNotes ?? ""}
          rows={3}
          maxLength={4000}
          placeholder="Overall verdict — what works, what needs a rewrite pass…"
          className="textarea"
          style={{ fontSize: ".88rem", minHeight: "4.5rem" }}
        />
      </label>
      <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary btn-sm"
        >
          {pending ? "Saving…" : "Save scenario review"}
        </button>
        {state?.ok ? (
          <span className="save-badge save-saved">saved</span>
        ) : null}
        {state && !state.ok ? (
          <span
            className="form-message error"
            style={{
              margin: 0,
              padding: 0,
              border: 0,
              background: "transparent",
            }}
          >
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function QuestionInlineReview({
  slug,
  question,
}: {
  slug: string;
  question: AuthoredQuestion;
}) {
  const bound = setInlineQuestionReviewAction.bind(null, slug, question.id);
  const [state, run, pending] = useActionState<
    InlineReviewResult | undefined,
    FormData
  >(bound, undefined);
  // The "unsupported" variant doesn't carry reviewNotes in its
  // contract shape — default to empty string and rely on the
  // server to persist what was typed.
  const initial =
    question.type === "unsupported" ? "" : question.reviewNotes ?? "";
  const promptPreview = question.promptMd.slice(0, 80);

  return (
    <form
      action={run}
      style={{
        padding: ".6rem .75rem",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-sunken)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: ".5rem",
          alignItems: "baseline",
          flexWrap: "wrap",
          marginBottom: ".4rem",
        }}
      >
        <span className="q-ordinal">Q{question.ordinal}</span>
        <span
          className="chip"
          style={{ fontSize: ".7rem", margin: 0 }}
        >
          {(question.type === "unsupported"
            ? question.underlyingType
            : question.type
          ).replace(/_/g, " ")}
        </span>
        <span
          style={{
            color: "var(--muted)",
            fontSize: ".82rem",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={question.promptMd}
        >
          {promptPreview}
          {question.promptMd.length > 80 ? "…" : ""}
        </span>
      </div>
      <textarea
        name="notes"
        defaultValue={initial}
        rows={2}
        maxLength={4000}
        placeholder="Issue with this question? Phrasing, options, answer key, debrief…"
        className="textarea"
        style={{ fontSize: ".85rem", minHeight: "3rem" }}
      />
      <div
        style={{
          display: "flex",
          gap: ".5rem",
          alignItems: "center",
          marginTop: ".35rem",
        }}
      >
        <button
          type="submit"
          disabled={pending}
          className="btn btn-ghost btn-sm"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state?.ok ? (
          <span className="save-badge save-saved">saved</span>
        ) : null}
        {state && !state.ok ? (
          <span
            className="form-message error"
            style={{
              margin: 0,
              padding: 0,
              border: 0,
              background: "transparent",
            }}
          >
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function chipFor(status: ScenarioReviewStatus): string {
  if (status === "approved") return "chip chip-ok";
  if (status === "needs_review") return "chip chip-partial";
  return "chip chip-bad";
}
