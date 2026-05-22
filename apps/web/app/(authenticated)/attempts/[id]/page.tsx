import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser, readToken } from "@/lib/session";
import { api, ApiError } from "@/lib/api";
import { Markdown } from "@/components/markdown";
import { QuestionPanel } from "@/components/questions/question-panel";
import { SubmitButton } from "@/components/questions/submit-button";
import { isAwarenessOnly } from "@ci-train/contracts";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AttemptPage({ params }: Props) {
  await requireUser();
  const token = await readToken();
  const { id } = await params;

  let attempt;
  try {
    attempt = await api.attempts.get(token!, id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    if (err instanceof ApiError && err.status === 403) notFound();
    throw err;
  }

  // If the attempt is already submitted, send the trainee straight to
  // the debrief — no point letting them re-enter the in-progress page.
  if (attempt.status === "submitted") {
    redirect(`/attempts/${id}/debrief`);
  }

  // Fetch the scenario detail so we can render brief + artifact tabs
  // alongside the questions. Trainees never see drafts here either.
  const scenario = await api.scenarios.getBySlug(token!, attempt.scenarioSlug);
  const showAwarenessBanner = scenario.skillAreas.some(isAwarenessOnly);
  const disclaimer = scenario.brief?.disclaimerMd ?? null;
  const unansweredCount = attempt.questions.filter(
    (q) => !attempt.answers.some((a) => a.questionId === q.id && a.response !== null),
  ).length;

  return (
    <main>
      <div style={{ fontSize: ".9rem", marginBottom: ".5rem" }}>
        <Link href={`/scenarios/${attempt.scenarioSlug}`} style={{ color: "var(--accent)" }}>
          ← Back to scenario
        </Link>
      </div>

      <h1>{attempt.scenarioTitle}</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Attempt in progress · {attempt.questions.length} question
        {attempt.questions.length === 1 ? "" : "s"} · max score {attempt.maxScore}
      </p>

      <div style={{ marginBottom: "1rem" }}>
        {scenario.skillAreas.map((a) => (
          <span
            key={a}
            className={`chip ${
              showAwarenessBanner && isAwarenessOnly(a) ? "chip-rf" : "chip-skill"
            }`}
          >
            {a}
          </span>
        ))}
        <span className="chip chip-difficulty">difficulty {scenario.difficulty}/5</span>
      </div>

      {disclaimer ? <Markdown source={disclaimer} variant="callout" /> : null}

      {scenario.brief ? (
        <details className="card" style={{ marginBottom: "1rem" }}>
          <summary style={{ cursor: "pointer", color: "var(--muted)" }}>
            Show scenario brief
          </summary>
          <div style={{ marginTop: ".5rem" }}>
            <Markdown source={scenario.brief.markdownBody} />
          </div>
        </details>
      ) : null}

      {scenario.artifacts.length > 0 ? (
        <p style={{ color: "var(--muted)", fontSize: ".9rem", marginTop: "1rem" }}>
          Artifacts are on the scenario page —{" "}
          <Link href={`/scenarios/${attempt.scenarioSlug}`} style={{ color: "var(--accent)" }}>
            open in another tab
          </Link>{" "}
          to keep them visible while you answer.
        </p>
      ) : null}

      <h2>Questions</h2>
      <QuestionPanel
        attemptId={attempt.id}
        questions={attempt.questions}
        answers={attempt.answers}
        locked={false}
      />

      <div style={{ marginTop: "1.5rem" }}>
        <SubmitButton attemptId={attempt.id} unansweredCount={unansweredCount} />
      </div>

      <footer>
        Your answers autosave as you make them. Submitting locks the attempt and
        reveals the debrief.
      </footer>
    </main>
  );
}
