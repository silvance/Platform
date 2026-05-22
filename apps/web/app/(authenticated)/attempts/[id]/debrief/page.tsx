import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, readToken } from "@/lib/session";
import { api, ApiError } from "@/lib/api";
import { Markdown } from "@/components/markdown";
import type {
  AnswerKeyPayload,
  AttemptAnswerPayload,
  DebriefPayload,
  QuestionPayload,
} from "@ci-train/contracts";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DebriefPage({ params }: Props) {
  await requireUser();
  const token = await readToken();
  const { id } = await params;

  let debrief: DebriefPayload;
  try {
    debrief = await api.attempts.debrief(token!, id);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) notFound();
    if (err instanceof ApiError && err.status === 409) {
      // Attempt isn't submitted yet — send the user back to the in-progress page.
      return (
        <main>
          <h1>Debrief not available yet</h1>
          <p>
            This attempt hasn't been submitted.{" "}
            <Link href={`/attempts/${id}`} style={{ color: "var(--accent)" }}>
              Return to the attempt
            </Link>{" "}
            to finish and submit.
          </p>
        </main>
      );
    }
    throw err;
  }

  return (
    <main>
      <div style={{ fontSize: ".9rem", marginBottom: ".5rem" }}>
        <Link href={`/scenarios/${debrief.scenarioSlug}`} style={{ color: "var(--accent)" }}>
          ← Back to scenario
        </Link>
      </div>
      <h1>Debrief — {debrief.scenarioTitle}</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Submitted {new Date(debrief.submittedAt).toLocaleString()} · score{" "}
        <strong style={{ color: "var(--fg)" }}>
          {debrief.totalScore.toFixed(1)} / {debrief.maxScore.toFixed(1)}
        </strong>
        {" "}from auto-graded questions
      </p>

      <section className="q-panel">
        {debrief.answers.map((a) => (
          <DebriefCard key={a.questionId} answer={a} />
        ))}
      </section>

      <footer>
        Narrative answers (short / long) are flagged for instructor review in a
        future milestone. Their score isn't included in the auto-grade total.
      </footer>
    </main>
  );
}

function DebriefCard({ answer }: { answer: DebriefPayload["answers"][number] }) {
  const q = answer.question;
  const key = answer.answerKey;
  return (
    <article className="card q-card">
      <header className="q-header">
        <span className="q-ordinal">Q{q.ordinal}</span>
        <span className="chip">{q.type.replace(/_/g, " ")}</span>
        <span className="chip">weight {q.weight}</span>
        <OutcomeChip outcome={answer.autoOutcome} score={answer.autoScore} />
      </header>
      <div className="q-prompt">
        <Markdown source={q.promptMd} />
      </div>

      <div style={{ marginTop: ".5rem" }}>
        <h4 style={{ margin: "0 0 .25rem", color: "var(--muted)", fontSize: ".85rem" }}>
          YOUR ANSWER
        </h4>
        <ResponseBlock answer={answer} question={q} />
      </div>

      <div style={{ marginTop: ".75rem" }}>
        <h4 style={{ margin: "0 0 .25rem", color: "var(--muted)", fontSize: ".85rem" }}>
          EXPECTED
        </h4>
        <ExpectedBlock key={q.id + ":expected"} answerKey={key} question={q} />
      </div>

      <div style={{ marginTop: ".75rem" }}>
        <h4 style={{ margin: "0 0 .25rem", color: "var(--muted)", fontSize: ".85rem" }}>
          DEBRIEF
        </h4>
        <Markdown source={key.debriefMd} />
      </div>
    </article>
  );
}

function OutcomeChip({
  outcome,
  score,
}: {
  outcome: AttemptAnswerPayload["autoOutcome"];
  score: AttemptAnswerPayload["autoScore"];
}) {
  if (!outcome) return null;
  if (outcome === "ungradable") {
    return <span className="chip" title="Manual review pending">manual review</span>;
  }
  const tone = outcome === "correct" || outcome === "in_range"
    ? "chip-ok"
    : outcome === "partial"
      ? "chip-partial"
      : "chip-bad";
  const label = `${outcome}${score !== null ? ` · ${(score * 100).toFixed(0)}%` : ""}`;
  return <span className={`chip ${tone}`}>{label}</span>;
}

function ResponseBlock({
  answer,
  question,
}: {
  answer: AttemptAnswerPayload;
  question: QuestionPayload;
}) {
  if (!answer.response) {
    return <p style={{ color: "var(--muted)", margin: 0 }}><em>(no answer)</em></p>;
  }
  const r = answer.response;
  if (r.type === "multi_choice") {
    const ids = new Set(r.data.selectedIds);
    const options = question.options ?? [];
    return (
      <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
        {options.filter((o) => ids.has(o.id)).map((o) => (
          <li key={o.id}>{o.label}</li>
        ))}
      </ul>
    );
  }
  if (r.type === "select_indicators") {
    const ids = new Set(r.data.selectedIds);
    const items = question.indicatorSet?.items ?? [];
    return (
      <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
        {items.filter((i) => ids.has(i.id)).map((i) => (
          <li key={i.id}>{i.label}</li>
        ))}
      </ul>
    );
  }
  if (r.type === "confidence") {
    return <p style={{ margin: 0 }}><strong>{r.data.value} / 5</strong></p>;
  }
  return (
    <pre className="artifact-text" style={{ margin: 0 }}>{r.data.text || "(empty)"}</pre>
  );
}

function ExpectedBlock({
  answerKey,
  question,
}: {
  answerKey: AnswerKeyPayload;
  question: QuestionPayload;
}) {
  const exp = answerKey.expected;
  if (exp.type === "multi_choice") {
    const correct = new Set(exp.correctIds);
    const options = question.options ?? [];
    return (
      <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
        {options.filter((o) => correct.has(o.id)).map((o) => (
          <li key={o.id}>{o.label}</li>
        ))}
      </ul>
    );
  }
  if (exp.type === "select_indicators") {
    const correct = new Set(exp.correctIds);
    const items = question.indicatorSet?.items ?? [];
    return (
      <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
        {items.filter((i) => correct.has(i.id)).map((i) => (
          <li key={i.id}>{i.label}</li>
        ))}
      </ul>
    );
  }
  if (exp.type === "confidence") {
    const [lo, hi] = exp.expectedRange;
    return (
      <p style={{ margin: 0 }}>
        Calibrated range: <strong>{lo}</strong>–<strong>{hi}</strong> / 5
      </p>
    );
  }
  // short_answer / long_answer
  if (exp.rubricNote) {
    return <Markdown source={exp.rubricNote} />;
  }
  return <p style={{ color: "var(--muted)", margin: 0 }}><em>(rubric in debrief below)</em></p>;
}
