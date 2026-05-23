import Link from "next/link";
import { notFound } from "next/navigation";
import { readToken, requireAdmin } from "@/lib/session";
import { api, ApiError } from "@/lib/api";
import {
  ArtifactKind,
  SkillArea,
  type AuthoredArtifact,
  type AuthoredIndicatorSet,
  type AuthoredQuestion,
} from "@ci-train/contracts";
import {
  addIndicatorSetAction,
  addQuestionAction,
  deleteArtifactAction,
  deleteIndicatorSetAction,
  deleteQuestionAction,
  deleteScenarioAction,
  setQuestionReviewAction,
  updateBriefAction,
  updateIndicatorSetAction,
  updateMetadataAction,
  updateQuestionAction,
  uploadArtifactAction,
} from "./actions";
import { MetadataForm } from "./metadata-form";
import { BriefForm } from "./brief-form";
import { QuestionForm } from "./question-form";
import { QuestionReviewNotes } from "./question-review-notes";
import { IndicatorSetForm } from "./indicator-set-form";
import { ArtifactUploadForm } from "./artifact-upload-form";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function EditChallengePage({ params }: Props) {
  await requireAdmin();
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
  // to know about FormData. Per-question / set / artifact edit + delete
  // bind their row id the same way.
  const metadataAction = updateMetadataAction.bind(null, slug);
  const briefAction = updateBriefAction.bind(null, slug);
  const addAction = addQuestionAction.bind(null, slug);
  const deleteScenario = deleteScenarioAction.bind(null, slug);
  const addSetAction = addIndicatorSetAction.bind(null, slug);
  const uploadAction = uploadArtifactAction.bind(null, slug);

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
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <a
            href={`/api/admin/challenges/${scenario.slug}/export`}
            style={{ color: "var(--accent)" }}
          >
            Download pack ↓
          </a>
          {scenario.status === "published" ? (
            <Link
              href={`/scenarios/${scenario.slug}`}
              style={{ color: "var(--accent)" }}
            >
              View as user →
            </Link>
          ) : null}
        </div>
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

      <h2>Artifacts ({scenario.artifacts.length})</h2>
      {scenario.artifacts.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "var(--muted)" }}>
            No artifacts yet. Upload evidence below.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Kind</th>
                <th>Size</th>
                <th>SHA-256</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scenario.artifacts.map((a) => (
                <ArtifactRow key={a.id} slug={slug} artifact={a} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ margin: "1rem 0 .25rem", fontSize: ".95rem" }}>Upload artifact</h3>
      <div className="card">
        <ArtifactUploadForm
          action={uploadAction}
          artifactKinds={ArtifactKind.options}
        />
      </div>

      <h2>Indicator sets ({scenario.indicatorSets.length})</h2>
      <p style={{ color: "var(--muted)", margin: "-.25rem 0 .75rem", fontSize: ".9rem" }}>
        Authored item sets that <code>select_indicators</code> questions grade against.
        Items + their ids are visible to users; correctness lives on the question.
      </p>
      {scenario.indicatorSets.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "var(--muted)" }}>
            No indicator sets yet. Add one below before authoring a
            <code> select_indicators</code> question.
          </p>
        </div>
      ) : (
        scenario.indicatorSets.map((s) => (
          <IndicatorSetEditorCard key={s.id} slug={slug} set={s} artifacts={scenario.artifacts} />
        ))
      )}

      <h3 style={{ margin: "1rem 0 .25rem", fontSize: ".95rem" }}>Add indicator set</h3>
      <div className="card">
        <IndicatorSetForm
          action={addSetAction}
          submitLabel="Add indicator set"
          artifacts={scenario.artifacts}
        />
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
          <QuestionEditorCard
            key={q.id}
            slug={slug}
            question={q}
            indicatorSets={scenario.indicatorSets}
          />
        ))
      )}

      <h3 style={{ margin: "1rem 0 .25rem", fontSize: ".95rem" }}>Add question</h3>
      <div className="card">
        <QuestionForm
          action={addAction}
          indicatorSets={scenario.indicatorSets}
          submitLabel="Add question"
        />
      </div>

      <h2 style={{ color: "var(--bad)" }}>Danger zone</h2>
      <div className="card">
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Deleting this challenge removes the brief, all questions, indicator
          sets, artifacts, and any user progress on it. Artifact bytes on disk
          are also removed (one-way).
        </p>
        <form action={deleteScenario} style={{ marginTop: ".75rem" }}>
          <button type="submit" className="admin-btn admin-btn-danger">
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
  indicatorSets,
}: {
  slug: string;
  question: AuthoredQuestion;
  indicatorSets: AuthoredIndicatorSet[];
}) {
  if (question.type === "unsupported") {
    const reviewAction = setQuestionReviewAction.bind(null, slug, question.id);
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
          The admin UI doesn't yet author{" "}
          <code>{question.underlyingType}</code>. Edit via the seed for now.
        </p>
        {/* Unsupported-type questions can still carry review
            notes — the unsupported variant doesn't include
            reviewNotes in its contract shape, but the API still
            stores them. Default to empty string. */}
        <QuestionReviewNotes action={reviewAction} defaultValue="" />
      </div>
    );
  }
  const updateAction = updateQuestionAction.bind(null, slug, question.id);
  const deleteAction = deleteQuestionAction.bind(null, slug, question.id);
  const reviewAction = setQuestionReviewAction.bind(null, slug, question.id);
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
          indicatorSets={indicatorSets}
          action={updateAction}
          submitLabel="Save question"
        />
        <QuestionReviewNotes
          action={reviewAction}
          defaultValue={question.reviewNotes ?? ""}
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

function IndicatorSetEditorCard({
  slug,
  set,
  artifacts,
}: {
  slug: string;
  set: AuthoredIndicatorSet;
  artifacts: AuthoredArtifact[];
}) {
  const updateAction = updateIndicatorSetAction.bind(null, slug, set.id);
  const deleteAction = deleteIndicatorSetAction.bind(null, slug, set.id);
  return (
    <details className="card" style={{ padding: "1rem 1.25rem" }}>
      <summary style={{ cursor: "pointer", listStyle: "revert" }}>
        <strong>{set.displayName}</strong>{" "}
        <code style={{ color: "var(--muted)", fontSize: ".8rem" }}>
          {set.slug}
        </code>{" "}
        <span className="chip">{set.items.length} items</span>
        <span className="chip">{set.questionCount} question(s)</span>
      </summary>
      <div style={{ marginTop: ".75rem" }}>
        <IndicatorSetForm
          initial={set}
          action={updateAction}
          submitLabel="Save indicator set"
          artifacts={artifacts}
        />
        <form action={deleteAction} style={{ marginTop: ".75rem" }}>
          <button
            type="submit"
            className="admin-btn admin-btn-danger"
            disabled={set.questionCount > 0}
            title={
              set.questionCount > 0
                ? "Delete the dependent question(s) first."
                : undefined
            }
          >
            Delete indicator set
          </button>
        </form>
      </div>
    </details>
  );
}

function ArtifactRow({
  slug,
  artifact,
}: {
  slug: string;
  artifact: AuthoredArtifact;
}) {
  const deleteAction = deleteArtifactAction.bind(null, slug, artifact.id);
  return (
    <tr>
      <td>{artifact.ordinal}</td>
      <td>
        <div style={{ fontWeight: 600 }}>{artifact.displayName}</div>
        <code style={{ color: "var(--muted)", fontSize: ".75rem" }}>{artifact.mimeType}</code>
      </td>
      <td>
        <span className="chip">{artifact.kind}</span>
      </td>
      <td style={{ fontFamily: "ui-monospace, monospace", fontSize: ".85rem" }}>
        {formatBytes(artifact.sizeBytes)}
      </td>
      <td>
        <code
          style={{
            color: "var(--muted)",
            fontSize: ".7rem",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {artifact.sha256.slice(0, 12)}…
        </code>
      </td>
      <td>
        <form action={deleteAction}>
          <button
            type="submit"
            className="admin-btn admin-btn-danger"
            style={{ padding: ".25rem .55rem", fontSize: ".8rem" }}
          >
            Delete
          </button>
        </form>
      </td>
    </tr>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(2)} MiB`;
}
