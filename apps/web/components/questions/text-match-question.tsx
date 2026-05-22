"use client";

import { useState, useTransition } from "react";
import type { QuestionPayload, QuestionResponse } from "@ci-train/contracts";

interface Props {
  question: QuestionPayload;
  initialText: string;
  disabled: boolean;
  onSubmit: (response: QuestionResponse) => void | Promise<void>;
}

export function TextMatchForm({ question, initialText, disabled, onSubmit }: Props) {
  const [text, setText] = useState(initialText);
  const [pending, start] = useTransition();
  const maxLength = question.textMatch?.maxLength ?? 500;
  const caseLabel = question.textMatch?.caseSensitive ? "case-sensitive" : "case-insensitive";
  const wsLabel = question.textMatch?.normalizeWhitespace
    ? "whitespace normalized"
    : "exact whitespace";

  function submit() {
    if (disabled || pending || text.trim().length === 0) return;
    const body: QuestionResponse = {
      type: "text_match",
      data: { text },
    };
    start(() => Promise.resolve(onSubmit(body)));
  }

  return (
    <div className="q-widget q-text-match">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, maxLength))}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        disabled={disabled}
        placeholder="Type your answer…"
        style={{
          width: "100%",
          padding: ".5rem .75rem",
          background: "#0b1020",
          border: "1px solid #2a3556",
          borderRadius: 6,
          color: "var(--fg)",
          fontSize: "1rem",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: ".25rem", fontSize: ".75rem", color: "var(--muted)" }}>
        <span>{caseLabel} · {wsLabel}</span>
        <span>{text.length} / {maxLength}</span>
      </div>
      <button
        type="button"
        disabled={disabled || pending || text.trim().length === 0}
        onClick={submit}
        className="q-submit"
        style={{ marginTop: ".5rem" }}
      >
        {pending ? "Checking…" : disabled ? "Submitted" : "Submit"}
      </button>
    </div>
  );
}
