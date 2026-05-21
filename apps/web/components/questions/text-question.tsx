"use client";

import { useState, useTransition } from "react";
import type { QuestionPayload, QuestionResponse } from "@ci-train/contracts";
import { MAX_SHORT_ANSWER_CHARS, MAX_LONG_ANSWER_CHARS } from "@ci-train/contracts";
import { saveAnswerAction } from "@/app/(authenticated)/attempts/[id]/actions";

interface Props {
  attemptId: string;
  question: QuestionPayload;
  initialText: string;
  locked: boolean;
  variant: "short" | "long";
}

export function TextQuestion({ attemptId, question, initialText, locked, variant }: Props) {
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [_pending, start] = useTransition();
  const maxChars = variant === "short" ? MAX_SHORT_ANSWER_CHARS : MAX_LONG_ANSWER_CHARS;

  function save() {
    if (locked) return;
    if (text === initialText) return; // nothing changed
    setStatus("saving");
    const body: QuestionResponse =
      variant === "short"
        ? { type: "short_answer", data: { text } }
        : { type: "long_answer", data: { text } };
    start(async () => {
      const r = await saveAnswerAction(attemptId, question.id, body);
      setStatus(r.ok ? "saved" : "error");
    });
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: ".5rem .75rem",
    background: "#0b1020",
    border: "1px solid #2a3556",
    borderRadius: 6,
    color: "var(--fg)",
    fontSize: ".95rem",
    fontFamily: "inherit",
  };

  return (
    <div className="q-widget q-text">
      {variant === "short" ? (
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, maxChars))}
          onBlur={save}
          disabled={locked}
          style={fieldStyle}
        />
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, maxChars))}
          onBlur={save}
          disabled={locked}
          rows={8}
          style={{ ...fieldStyle, resize: "vertical" }}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: ".25rem", fontSize: ".75rem", color: "var(--muted)" }}>
        <span>{text.length} / {maxChars}</span>
        <SaveBadge status={status} />
      </div>
    </div>
  );
}

function SaveBadge({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;
  if (status === "saving") return <span className="save-badge save-saving">saving…</span>;
  if (status === "saved") return <span className="save-badge save-saved">saved</span>;
  return <span className="save-badge save-error">save failed</span>;
}
