import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, readToken } from "@/lib/session";
import { api, ApiError } from "@/lib/api";
import { Markdown } from "@/components/markdown";
import { ArtifactViewer } from "@/components/viewers/artifact-viewer";
import { QuestionCard } from "@/components/questions/question-card";
import {
  LANE_LABELS,
  SKILL_AREA_LABELS,
  isAwarenessOnly,
  type AdminScenarioDetail,
} from "@ci-train/contracts";
import { InlineReviewPanel } from "./inline-review-panel";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ScenarioWorkspacePage({ params }: Props) {
  const user = await requireUser();
  const token = await readToken();
  const { slug } = await params;

  // Pull the scenario detail (brief + artifacts) and the caller's
  // progress in parallel.
  let scenario, progress;
  try {
    [scenario, progress] = await Promise.all([
      api.scenarios.getBySlug(token!, slug),
      api.progress.get(token!, slug),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // M21g: admin-only inline review payload. Fetched from the
  // authoring endpoint which already carries reviewStatus +
  // per-question reviewNotes. The user-facing /scenarios/:slug
  // payload above never contains these fields, so trust-boundary
  // discipline is preserved by construction. Failure is non-fatal:
  // we just don't render the panel.
  let adminDetail: AdminScenarioDetail | null = null;
  if (user.role === "admin") {
    try {
      adminDetail = await api.authoring.get(token!, slug);
    } catch {
      adminDetail = null;
    }
  }

  const showAwarenessBanner = scenario.skillAreas.some(isAwarenessOnly);
  const disclaimer = scenario.brief?.disclaimerMd ?? null;

  const completedAll =
    progress.completedAt !== null && progress.totalQuestions > 0;

  return (
    <main>
      <div style={{ fontSize: ".9rem", marginBottom: ".5rem" }}>
        <Link
          href={`/scenarios/lanes/${encodeURIComponent(scenario.lane)}`}
          style={{ color: "var(--accent)" }}
        >
          ← {LANE_LABELS[scenario.lane]}
        </Link>
      </div>

      <h1>{scenario.title}</h1>

      <div style={{ marginBottom: "1rem" }}>
        {scenario.skillAreas.map((a) => (
          <span
            key={a}
            className={`chip ${
              showAwarenessBanner && isAwarenessOnly(a) ? "chip-rf" : "chip-skill"
            }`}
          >
            {SKILL_AREA_LABELS[a]}
          </span>
        ))}
        <span className="chip chip-difficulty">Level {scenario.difficulty}</span>
        {scenario.estimatedMinutes !== null ? (
          <span className="chip">≈ {scenario.estimatedMinutes} min</span>
        ) : null}
        {scenario.tags.map((t) => (
          <span key={t} className="chip">#{t}</span>
        ))}
      </div>

      {disclaimer ? <Markdown source={disclaimer} variant="callout" /> : null}

      {/* Progress strip — solved / total */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <strong>Solved:</strong> {progress.completedQuestions} /{" "}
            {progress.totalQuestions}{" "}
            {completedAll ? (
              <span className="chip chip-ok">challenge complete</span>
            ) : null}
          </div>
          <div style={{ flex: "1 1 200px", maxWidth: "300px", marginLeft: "auto" }}>
            <div
              style={{
                background: "var(--bg-sunken)",
                border: "1px solid var(--border)",
                borderRadius: 999,
                overflow: "hidden",
                height: "8px",
              }}
            >
              <div
                style={{
                  width: `${(progress.completedQuestions / Math.max(1, progress.totalQuestions)) * 100}%`,
                  background: "var(--ok)",
                  height: "100%",
                  transition: "width 200ms ease-out",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Brief (collapsible so it doesn't push questions off the screen) */}
      {scenario.brief ? (
        <details className="card" style={{ marginBottom: "1rem" }} open>
          <summary style={{ cursor: "pointer", color: "var(--muted)" }}>
            Scenario brief
          </summary>
          <div style={{ marginTop: ".5rem" }}>
            <Markdown source={scenario.brief.markdownBody} />
          </div>
        </details>
      ) : null}

      {/* Artifacts: each rendered inline, in declared order. No
          tabs — the brief is collapsible above, the questions
          are below, and every artifact is a sibling block in
          between. */}
      {scenario.artifacts.map((a) => (
        <div key={a.id} style={{ marginBottom: "1.5rem" }}>
          <h2
            style={{
              fontSize: "1rem",
              margin: "0 0 .5rem 0",
              color: "var(--muted-strong)",
              display: "flex",
              alignItems: "baseline",
              gap: ".5rem",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: "var(--fg)" }}>{a.displayName}</span>
            <span className="chip" style={{ fontSize: ".7rem" }}>{a.kind}</span>
          </h2>
          <ArtifactViewer
            scenarioSlug={slug}
            artifact={a}
            token={token!}
          />
        </div>
      ))}

      <h2>Questions</h2>
      <section className="q-panel">
        {progress.questions.map((q) => {
          const state =
            progress.responses.find((r) => r.questionId === q.id) ?? null;
          return (
            <QuestionCard
              key={q.id}
              scenarioSlug={slug}
              question={q}
              initialState={state}
            />
          );
        })}
      </section>

      <footer>
        Challenge mode — answer each question until correct. Your progress is
        saved automatically. There's no overall "submit" — completing every
        question marks the scenario complete.
      </footer>

      {/* Admin review panel: rendered at the very bottom of the
          page so it doesn't push the brief / artifacts / questions
          down when an admin is solving. Still admin-only by
          construction (adminDetail is only fetched when role
          === "admin"). */}
      {adminDetail ? (
        <InlineReviewPanel
          slug={slug}
          admin={adminDetail}
          questions={adminDetail.questions}
        />
      ) : null}
    </main>
  );
}

