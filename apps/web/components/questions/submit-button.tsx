"use client";

import { useState, useTransition } from "react";
import { submitAttemptAction } from "@/app/(authenticated)/attempts/[id]/actions";

interface Props {
  attemptId: string;
  // Count of unanswered questions, used for the confirmation prompt.
  unansweredCount: number;
}

export function SubmitButton({ attemptId, unansweredCount }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="primary"
        style={{
          background: "var(--accent)",
          color: "#0b1020",
          border: 0,
          borderRadius: 6,
          padding: ".55rem 1rem",
          fontSize: "1rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Submit attempt
      </button>
    );
  }

  return (
    <div className="card" style={{ borderColor: "rgba(255, 196, 0, 0.45)" }}>
      <p style={{ margin: 0 }}>
        Submit your attempt? <strong>This locks all answers</strong> and reveals the
        debrief.
        {unansweredCount > 0 ? (
          <>
            <br />
            <span style={{ color: "#f0d68a" }}>
              {unansweredCount} question{unansweredCount === 1 ? "" : "s"} still
              {unansweredCount === 1 ? " is" : " are"} unanswered.
            </span>
          </>
        ) : null}
      </p>
      <div style={{ display: "flex", gap: ".5rem", marginTop: ".75rem" }}>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => submitAttemptAction(attemptId))}
          style={{
            background: "var(--accent)",
            color: "#0b1020",
            border: 0,
            borderRadius: 6,
            padding: ".5rem 1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {pending ? "Submitting…" : "Yes, submit"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          style={{
            background: "transparent",
            color: "var(--muted)",
            border: "1px solid #2a3556",
            borderRadius: 6,
            padding: ".5rem 1rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
