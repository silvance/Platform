"use client";

import { useState, useTransition } from "react";
import type { ConfidenceValue, QuestionPayload, QuestionResponse } from "@ci-train/contracts";
import { saveAnswerAction } from "@/app/(authenticated)/attempts/[id]/actions";

interface Props {
  attemptId: string;
  question: QuestionPayload;
  initialValue: ConfidenceValue | null;
  locked: boolean;
}

const LABELS: Record<ConfidenceValue, string> = {
  1: "Not confident",
  2: "Slightly",
  3: "Moderate",
  4: "Confident",
  5: "Certain",
};

export function ConfidenceQuestion({ attemptId, question, initialValue, locked }: Props) {
  const [value, setValue] = useState<ConfidenceValue | null>(initialValue);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [_pending, start] = useTransition();

  function pick(v: ConfidenceValue) {
    if (locked) return;
    setValue(v);
    setStatus("saving");
    const body: QuestionResponse = { type: "confidence", data: { value: v } };
    start(async () => {
      const r = await saveAnswerAction(attemptId, question.id, body);
      setStatus(r.ok ? "saved" : "error");
    });
  }

  return (
    <div className="q-widget q-confidence">
      <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
        {([1, 2, 3, 4, 5] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => pick(v)}
            disabled={locked}
            className={`confidence-pill ${value === v ? "confidence-active" : ""}`}
          >
            <span style={{ fontWeight: 600 }}>{v}</span>
            <span style={{ fontSize: ".75rem", color: "var(--muted)" }}> · {LABELS[v]}</span>
          </button>
        ))}
      </div>
      <SaveBadge status={status} />
    </div>
  );
}

function SaveBadge({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;
  if (status === "saving") return <span className="save-badge save-saving">saving…</span>;
  if (status === "saved") return <span className="save-badge save-saved">saved</span>;
  return <span className="save-badge save-error">save failed</span>;
}
