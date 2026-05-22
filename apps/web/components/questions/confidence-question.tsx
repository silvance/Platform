"use client";

import { useState, useTransition } from "react";
import type {
  ConfidenceValue,
  QuestionPayload,
  QuestionResponse,
} from "@ci-train/contracts";

const LABELS: Record<ConfidenceValue, string> = {
  1: "Not confident",
  2: "Slightly",
  3: "Moderate",
  4: "Confident",
  5: "Certain",
};

interface Props {
  question: QuestionPayload;
  initialValue: ConfidenceValue | null;
  disabled: boolean;
  onSubmit: (response: QuestionResponse) => void | Promise<void>;
}

export function ConfidenceForm({ question, initialValue, disabled, onSubmit }: Props) {
  const [value, setValue] = useState<ConfidenceValue | null>(initialValue);
  const [pending, start] = useTransition();

  function submit() {
    if (disabled || pending || value === null) return;
    const body: QuestionResponse = { type: "confidence", data: { value } };
    start(() => Promise.resolve(onSubmit(body)));
  }

  return (
    <div className="q-widget q-confidence">
      <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
        {([1, 2, 3, 4, 5] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => !disabled && setValue(v)}
            disabled={disabled}
            className={`confidence-pill ${value === v ? "confidence-active" : ""}`}
          >
            <span style={{ fontWeight: 600 }}>{v}</span>
            <span style={{ fontSize: ".75rem", color: "var(--muted)" }}> · {LABELS[v]}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || pending || value === null}
        onClick={submit}
        className="q-submit"
        style={{ marginTop: ".5rem" }}
      >
        {pending ? "Submitting…" : disabled ? "Submitted" : "Submit"}
      </button>
    </div>
  );
}
