"use client";

import { useRef, useState } from "react";
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
}

// One card per question. Holds local state across submissions —
// when the user gets it right, the card flips to a completed state
// that shows their answer + the answer key + the debrief. Until
// then it allows unlimited retries, optionally showing a hint when
// one's authored and the threshold's hit.
//
// Completed questions are auto-minimized when the page loads, so
// returning students see their incomplete questions front and
// centre. A question the student gets right *this session* stays
// expanded so the debrief is visible immediately.
export function QuestionCard({ scenarioSlug, question, initialState }: Props) {
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
  const [selectionFeedback, setSelectionFeedback] = useState<
    SubmitAnswerResponse["selectionFeedback"]
  >(null);

  // Capture "was completed when the page loaded" once. Used to
  // decide whether to start collapsed (returning student already
  // saw the debrief) or expanded (just-completed-now, debrief is
  // new information).
  const wasCompletedOnLoadRef = useRef<boolean>(
    initialState?.completedAt != null,
  );

  const isCompleted = completedAt !== null;
  const formDisabled = isCompleted;

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
    setSelectionFeedback(r.selectionFeedback);
    setFeedback({ correct: r.correct, completedJustNow: r.completedJustNow });
    if (r.correct && r.completedJustNow) {
      setCompletedAt(new Date().toISOString());
    }
    if (r.correct && r.answerKey) {
      setAnswerKey(r.answerKey);
    }
  }

  const completedChip = isCompleted ? (
    <span className="chip chip-ok">
      completed {attemptCount === 1 ? "first try" : `try ${attemptCount}`}
    </span>
  ) : attemptCount > 0 ? (
    <span className="chip">try {attemptCount}</span>
  ) : null;

  const headerChips = (
    <>
      <span className="q-ordinal">Q{question.ordinal}</span>
      <span className="chip">{question.type.replace(/_/g, " ")}</span>
      <span className="chip">weight {question.weight}</span>
      {completedChip}
    </>
  );

  const body = (
    <>
      <div className="q-prompt">
        <Markdown source={question.promptMd} />
      </div>

      <QuestionForm
        question={question}
        initialResponse={lastResponse}
        disabled={formDisabled}
        onSubmit={handleSubmit}
      />

      {!isCompleted && feedback && !feedback.correct ? (
        <SelectionFeedbackBanner feedback={selectionFeedback} />
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
    </>
  );

  if (isCompleted) {
    return (
      <article className="card q-card q-completed">
        <details open={!wasCompletedOnLoadRef.current}>
          <summary className="q-header q-summary">{headerChips}</summary>
          {body}
        </details>
      </article>
    );
  }

  return (
    <article className="card q-card">
      <header className="q-header">{headerChips}</header>
      {body}
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

// Banner shown after an incorrect submission on multi-pick / select-
// indicators questions. Gives the student a count-only view of how
// close they are — "you have 3 of 4 right, plus 2 extras" — so they
// can converge without us revealing which specific items are right
// or wrong. Falls back to the original "Not yet — try again" string
// when the response carries no breakdown (single-pick MC, text_match,
// confidence).
function SelectionFeedbackBanner({
  feedback,
}: {
  feedback: SubmitAnswerResponse["selectionFeedback"];
}) {
  if (!feedback) {
    return (
      <p className="save-badge save-error" style={{ marginTop: ".5rem" }}>
        Not yet — try again.
      </p>
    );
  }
  const { correctPicked, totalPicked, totalCorrect } = feedback;
  const extras = Math.max(0, totalPicked - correctPicked);
  const missing = Math.max(0, totalCorrect - correctPicked);

  const lines: string[] = [];
  if (totalPicked === 0) {
    lines.push(
      `You haven't selected anything yet. The answer set has ${totalCorrect} item${
        totalCorrect === 1 ? "" : "s"
      }.`,
    );
  } else {
    lines.push(
      `${correctPicked} of your ${totalPicked} selection${
        totalPicked === 1 ? " is" : "s are"
      } part of the answer.`,
    );
    if (extras > 0) {
      lines.push(
        `${extras} of your selection${
          extras === 1 ? " is" : "s are"
        } not part of the answer.`,
      );
    }
    if (missing > 0) {
      lines.push(
        `${missing} item${
          missing === 1 ? "" : "s"
        } from the answer ${missing === 1 ? "is" : "are"} still missing.`,
      );
    }
    if (extras === 0 && missing === 0) {
      // Defensive: shouldn't render — if both are zero the answer is right.
      lines.push("Re-read the question and try again.");
    }
  }

  return (
    <div
      className="save-badge save-error"
      style={{
        marginTop: ".5rem",
        display: "flex",
        flexDirection: "column",
        gap: ".15rem",
        alignItems: "flex-start",
      }}
    >
      <strong>Not yet.</strong>
      {lines.map((line, i) => (
        <span key={i} style={{ fontWeight: 400 }}>
          {line}
        </span>
      ))}
    </div>
  );
}
