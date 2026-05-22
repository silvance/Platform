import Link from "next/link";
import { notFound } from "next/navigation";
import { readToken, requireInstructor } from "@/lib/session";
import { api, ApiError } from "@/lib/api";
import { SkillArea, type AuthoredQuestion } from "@ci-train/contracts";
import {
  addQuestionAction,
  deleteQuestionAction,
  deleteScenarioAction,
  updateBriefAction,
  updateMetadataAction,
  updateQuestionAction,
} from "./actions";
import { MetadataForm } from "./metadata-form";
import { BriefForm } from "./brief-form";
import { QuestionForm } from "./question-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function EditChallengePage({ params }: Props) {
  await requireInstructor();
  const { slug } = await params;
  const token = await readToken();

  let scenario;
  try {
    scenario = await api.authoring.get(token!, slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // Bind the slug into the server actions so the client forms only need
  // to know about FormData. Per-question edit/delete bind the question
  // id the same way.
  const metadataAction = updateMetadataAction.bind(null, slug);
  const briefAction = updateBriefAction.bind(null, slug);
  const addAction = addQuestionAction.bind(null, slug);
  const deleteScenario = deleteScenarioAction.bind(null, slug);

  return (
    <main>
      <p style={{ marginBottom: ".5rem" }}>
        <Link href="/admin/challenges" style={{ color: "var(--accent)" }}>
          ← Challenges
        </Link>
      </p>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ marginBottom: 0 }}>{scenario.title}</h1>
          <code style={{ color: "var(--muted)", fontSize: ".85rem" }}>
            /{scenario.slug}
          </code>{" "}
          <span className={`admin-status-${scenario.status}`}>{scenario.status}</span>
        </div>
        {scenario.status === "published" ? (
          <Link
            href={`/scenarios/${scenario.slug}`}
            style={{ color: "var(--accent)" }}
          >
            View as user →
          </Link>
        ) : null}
      </header>

      <h2>Metadata</h2>
      <div className="card">
        <MetadataForm
          scenario={scenario}
          skillAreas={SkillArea.options}
          action={metadataAction}
        />
      </div>

      <h2>Brief</h2>
      <div className="card">
        <BriefForm brief={scenario.brief} action={briefAction} />
      </div>

      <h2>Questions ({scenario.questions.length})</h2>
      {scenario.questions.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "var(--muted)" }}>
            No questions yet. Add one below.
          </p>
        </div>
      ) : (
        scenario.questions.map((q) => (
          <QuestionEditorCard key={q.id} slug={slug} question={q} />
        ))
      )}

      <h2>Add question</h2>
      <div className="card">
        <QuestionForm action={addAction} submitLabel="Add question" />
      </div>

      <h2 style={{ color: "var(--bad)" }}>Danger zone</h2>
      <div className="card">
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Deleting this challenge removes the brief, all questions, and any user
          progress on it. Artifact bytes on disk are <em>not</em> cleaned up by
          this action.
        </p>
        <form
          action={deleteScenario}
          style={{ marginTop: ".75rem" }}
        >
          <button
            type="submit"
            className="admin-btn admin-btn-danger"
          >
            Delete challenge
          </button>
        </form>
      </div>
    </main>
  );
}

function QuestionEditorCard({
  slug,
  question,
}: {
  slug: string;
  question: AuthoredQuestion;
}) {
  if (question.type === "unsupported") {
    return (
      <div className="card">
        <header style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
          <span className="q-ordinal">Q{question.ordinal}</span>
          <span className="chip">{question.underlyingType.replace(/_/g, " ")}</span>
          <span className="chip" style={{ color: "var(--muted)" }}>
            not editable here
          </span>
        </header>
        <p style={{ color: "var(--muted)", marginTop: ".5rem" }}>
          {question.promptMd.slice(0, 200)}
          {question.promptMd.length > 200 ? "…" : ""}
        </p>
        <p style={{ color: "var(--muted)", fontSize: ".85rem", margin: 0 }}>
          Edit this question via the seed for now — the admin UI doesn't yet
          author <code>{question.underlyingType}</code>.
        </p>
      </div>
    );
  }
  const updateAction = updateQuestionAction.bind(null, slug, question.id);
  const deleteAction = deleteQuestionAction.bind(null, slug, question.id);
  return (
    <details className="card" style={{ padding: "1rem 1.25rem" }}>
      <summary style={{ cursor: "pointer", listStyle: "revert" }}>
        <span className="q-ordinal">Q{question.ordinal}</span>{" "}
        <span className="chip">{question.type.replace(/_/g, " ")}</span>{" "}
        <span style={{ color: "var(--muted)" }}>
          {question.promptMd.slice(0, 100)}
          {question.promptMd.length > 100 ? "…" : ""}
        </span>
      </summary>
      <div style={{ marginTop: ".75rem" }}>
        <QuestionForm
          initial={question}
          action={updateAction}
          submitLabel="Save question"
        />
        <form action={deleteAction} style={{ marginTop: ".75rem" }}>
          <button type="submit" className="admin-btn admin-btn-danger">
            Delete question
          </button>
        </form>
      </div>
    </details>
  );
}
