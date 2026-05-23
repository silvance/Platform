"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AdminReviewRow } from "@ci-train/contracts";
import {
  REVIEW_STATUS_LABELS,
  ScenarioReviewStatus,
} from "@ci-train/contracts";
import {
  setScenarioReviewAction,
  type ReviewActionState,
} from "./actions";

const initial: ReviewActionState = { error: null, ok: null };

interface Props {
  row: AdminReviewRow;
}

// One row of the review table. The form submits the status select
// + notes textarea together so the operator gets a single "Save"
// affordance per scenario — fewer click trains, fewer dangling
// not-yet-saved changes.
export function ReviewRow({ row }: Props) {
  const [state, action, pending] = useActionState(
    setScenarioReviewAction,
    initial,
  );

  return (
    <tr style={{ borderTop: "1px solid var(--border)", verticalAlign: "top" }}>
      <td style={cellStyle}>
        <Link
          href={`/admin/challenges/${encodeURIComponent(row.slug)}/edit`}
          style={{ fontWeight: 600 }}
        >
          {row.title}
        </Link>
        <div>
          <code style={{ color: "var(--muted)", fontSize: ".8rem" }}>
            {row.slug}
          </code>
        </div>
        <div style={tagRowStyle}>
          <span className={`admin-status-${row.status}`}>{row.status}</span>
          <span className="chip chip-difficulty">d {row.difficulty}/5</span>
          <span style={countStyle}>{row.artifactCount} art</span>
          <span style={countStyle}>{row.questionCount} q</span>
          {row.questionsWithNotes > 0 ? (
            <span className="chip chip-partial">
              {row.questionsWithNotes} q-notes
            </span>
          ) : null}
        </div>
        {row.tags.length > 0 ? (
          <div style={{ marginTop: ".25rem" }}>
            {row.tags.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </td>
      <td style={cellStyle}>
        <form action={action} style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}>
          <input type="hidden" name="slug" value={row.slug} />
          <select
            name="status"
            defaultValue={row.reviewStatus}
            disabled={pending}
            className="select"
            style={{ fontSize: ".85rem" }}
          >
            {ScenarioReviewStatus.options.map((opt) => (
              <option key={opt} value={opt}>
                {REVIEW_STATUS_LABELS[opt]}
              </option>
            ))}
          </select>
          <textarea
            name="notes"
            defaultValue={row.reviewNotes ?? ""}
            placeholder="Notes (admin-only) — what's wrong, what needs follow-up…"
            rows={3}
            className="textarea"
            style={{ fontSize: ".85rem", minHeight: "4.5rem" }}
            maxLength={4000}
          />
          <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary btn-sm"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <div style={{ color: "var(--muted)", fontSize: ".78rem" }}>
              {row.reviewedAt
                ? `Last: ${new Date(row.reviewedAt).toLocaleString()}${
                    row.reviewer ? ` by ${row.reviewer.displayName}` : ""
                  }`
                : "Never reviewed"}
            </div>
          </div>
          {state.error ? (
            <div className="form-message error" style={{ fontSize: ".82rem" }}>
              {state.error}
            </div>
          ) : null}
          {state.ok ? (
            <div className="form-message ok" style={{ fontSize: ".82rem" }}>
              {state.ok}
            </div>
          ) : null}
        </form>
      </td>
    </tr>
  );
}

const cellStyle: React.CSSProperties = {
  padding: ".75rem .65rem",
};
const tagRowStyle: React.CSSProperties = {
  display: "flex",
  gap: ".35rem",
  flexWrap: "wrap",
  alignItems: "center",
  marginTop: ".4rem",
};
const countStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: ".78rem",
};
