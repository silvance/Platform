"use client";

import { useState } from "react";
import type {
  AnswerKeyPayload,
  QuestionPayload,
  QuestionResponse,
  QuestionStatePayload,
  SubmitAnswerResponse,
} from "@ci-train/contracts";
import { Markdown } from "@/components/markdown";
import { submitAnswerAction } from "@/app/(authenticated)/scenarios/[slug]/actions";
import { MultiChoiceForm } from "./multi-choice-question";
import { ConfidenceForm } from "./confidence-question";
import { SelectIndicatorsForm } from "./select-indicators-question";
import { TextMatchForm } from "./text-match-question";

interface Props {
  scenarioSlug: string;
  question: QuestionPayload;
  initialState: QuestionStatePayload | null;
  // If the trainee role is missing (instructor preview), the form is
  // disabled and shows "preview only".
  canSubmit: boolean;
}

// One card per question. Holds local state across submissions —
// when the trainee gets it right, the card flips to a completed
// state that shows their answer + the answer key + the debrief.
// Until then it allows unlimited retries, optionally showing a hint
// when one's authored and the threshold's hit.
export function QuestionCard({ scenarioSlug, question, initialState, canSubmit }: Props) {
  const [completedAt, setCompletedAt] = useState<string | null>(
    initialState?.completedAt ?? null,
  );
  const [attemptCount, setAttemptCount] = useState<number>(
    initialState?.attemptCount ?? 0,
  );
  const [lastResponse, setLastResponse] = useState<QuestionResponse | null>(
    initialState?.lastResponse ?? null,
  );
  const [answerKey, setAnswerKey] = useState<AnswerKeyPayload | null>(
    initialState?.answerKey ?? null,
  );
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    null | { correct: boolean; completedJustNow: boolean }
  >(null);

  const isCompleted = completedAt !== null;
  const formDisabled = isCompleted || !canSubmit;

  async function handleSubmit(response: QuestionResponse) {
    setError(null);
    const result = await submitAnswerAction(scenarioSlug, question.id, response);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const r: SubmitAnswerResponse = result.result;
    setLastResponse(response);
    setAttemptCount(r.attemptCount);
    setHint(r.hint);
    setFeedback({ correct: r.correct, completedJustNow: r.completedJustNow });
    if (r.correct && r.completedJustNow) {
      setCompletedAt(new Date().toISOString());
    }
    if (r.correct && r.answerKey) {
      setAnswerKey(r.answerKey);
    }
  }

  return (
    <article className={`card q-card ${isCompleted ? "q-completed" : ""}`}>
      <header className="q-header">
        <span className="q-ordinal">Q{question.ordinal}</span>
        <span className="chip">{question.type.replace(/_/g, " ")}</span>
        <span className="chip">weight {question.weight}</span>
        {isCompleted ? (
          <span className="chip chip-ok">
            completed {attemptCount === 1 ? "first try" : `try ${attemptCount}`}
          </span>
        ) : attemptCount > 0 ? (
          <span className="chip">try {attemptCount}</span>
        ) : null}
      </header>

      <div className="q-prompt">
        <Markdown source={question.promptMd} />
      </div>

      <QuestionForm
        question={question}
        initialResponse={lastResponse}
        disabled={formDisabled}
        onSubmit={handleSubmit}
      />

      {!canSubmit ? (
        <p style={{ color: "var(--muted)", fontSize: ".85rem", marginTop: ".5rem" }}>
          Instructor preview — submissions disabled.
        </p>
      ) : null}

      {!isCompleted && feedback && !feedback.correct ? (
        <p className="save-badge save-error" style={{ marginTop: ".5rem" }}>
          Not yet — try again.
        </p>
      ) : null}

      {hint && !isCompleted ? (
        <div
          className="card"
          style={{
            marginTop: ".5rem",
            borderColor: "rgba(255, 196, 0, 0.45)",
            background: "rgba(255, 196, 0, 0.06)",
            color: "#f0d68a",
            padding: ".5rem .75rem",
          }}
        >
          <strong>Hint:</strong> {hint}
        </div>
      ) : null}

      {error ? (
        <p className="save-badge save-error" style={{ marginTop: ".5rem" }}>
          {error}
        </p>
      ) : null}

      {isCompleted && answerKey ? (
        <details className="card" style={{ marginTop: ".75rem" }} open>
          <summary style={{ cursor: "pointer", color: "var(--muted)" }}>
            Debrief
          </summary>
          <div style={{ marginTop: ".5rem" }}>
            <Markdown source={answerKey.debriefMd} />
          </div>
        </details>
      ) : null}
    </article>
  );
}

function QuestionForm({
  question,
  initialResponse,
  disabled,
  onSubmit,
}: {
  question: QuestionPayload;
  initialResponse: QuestionResponse | null;
  disabled: boolean;
  onSubmit: (r: QuestionResponse) => void;
}) {
  switch (question.type) {
    case "multi_choice": {
      const initial =
        initialResponse?.type === "multi_choice"
          ? initialResponse.data.selectedIds
          : [];
      return (
        <MultiChoiceForm
          question={question}
          initialSelectedIds={initial}
          disabled={disabled}
          onSubmit={onSubmit}
        />
      );
    }
    case "confidence": {
      const initial =
        initialResponse?.type === "confidence" ? initialResponse.data.value : null;
      return (
        <ConfidenceForm
          question={question}
          initialValue={initial}
          disabled={disabled}
          onSubmit={onSubmit}
        />
      );
    }
    case "select_indicators": {
      const initial =
        initialResponse?.type === "select_indicators"
          ? initialResponse.data.selectedIds
          : [];
      return (
        <SelectIndicatorsForm
          question={question}
          initialSelectedIds={initial}
          disabled={disabled}
          onSubmit={onSubmit}
        />
      );
    }
    case "text_match": {
      const initial =
        initialResponse?.type === "text_match" ? initialResponse.data.text : "";
      return (
        <TextMatchForm
          question={question}
          initialText={initial}
          disabled={disabled}
          onSubmit={onSubmit}
        />
      );
    }
    default:
      return null;
  }
}
