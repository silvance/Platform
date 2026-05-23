import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, readToken } from "@/lib/session";
import { api, ApiError } from "@/lib/api";
import { Markdown } from "@/components/markdown";
import { ArtifactViewer } from "@/components/viewers/artifact-viewer";
import { QuestionCard } from "@/components/questions/question-card";
import {
  isAwarenessOnly,
  type AdminScenarioDetail,
  type ArtifactListItem,
} from "@ci-train/contracts";
import { InlineReviewPanel } from "./inline-review-panel";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readSingle(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function ScenarioWorkspacePage({ params, searchParams }: Props) {
  const user = await requireUser();
  const token = await readToken();
  const { slug } = await params;
  const sp = await searchParams;
  const focusedArtifactId = readSingle(sp["artifact"]);

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

  // Artifact tab dispatch (unchanged from M3).
  const validArtifactIds = new Set(scenario.artifacts.map((a) => a.id));
  const activeArtifactId =
    focusedArtifactId && validArtifactIds.has(focusedArtifactId)
      ? focusedArtifactId
      : null;
  const activeArtifact: ArtifactListItem | null = activeArtifactId
    ? scenario.artifacts.find((a) => a.id === activeArtifactId) ?? null
    : null;

  const completedAll =
    progress.completedAt !== null && progress.totalQuestions > 0;

  return (
    <main>
      <div style={{ fontSize: ".9rem", marginBottom: ".5rem" }}>
        <Link href="/scenarios" style={{ color: "var(--accent)" }}>
          ← All scenarios
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
            {a}
          </span>
        ))}
        <span className="chip chip-difficulty">difficulty {scenario.difficulty}/5</span>
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

      {adminDetail ? (
        <InlineReviewPanel
          slug={slug}
          admin={adminDetail}
          questions={adminDetail.questions}
        />
      ) : null}

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

      {/* Artifact tabs (unchanged from M3) */}
      {scenario.artifacts.length > 0 ? (
        <ArtifactTabs
          slug={slug}
          artifacts={scenario.artifacts}
          activeArtifactId={activeArtifactId}
        />
      ) : null}

      {activeArtifact ? (
        <div style={{ marginBottom: "1.5rem" }}>
          <ArtifactViewer
            scenarioSlug={slug}
            artifact={activeArtifact}
            token={token!}
          />
        </div>
      ) : null}

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
    </main>
  );
}

function ArtifactTabs({
  slug,
  artifacts,
  activeArtifactId,
}: {
  slug: string;
  artifacts: ArtifactListItem[];
  activeArtifactId: string | null;
}) {
  // The brief + questions are rendered unconditionally below the
  // tabs, so the old "Brief + questions" tab that just cleared the
  // artifact selection was redundant. Tabs are now strictly one per
  // artifact; no tab is highlighted when no artifact is open.
  return (
    <nav className="artifact-tabs" aria-label="Scenario artifacts">
      {artifacts.map((a) => (
        <Link
          key={a.id}
          href={`/scenarios/${slug}?artifact=${encodeURIComponent(a.id)}`}
          className={`tab ${activeArtifactId === a.id ? "tab-active" : ""}`}
          title={`${a.mimeType} · ${formatBytes(a.sizeBytes)}`}
        >
          <span className="tab-name">{a.displayName}</span>
          <span className="tab-kind">{a.kind}</span>
        </Link>
      ))}
    </nav>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
