import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, readToken } from "@/lib/session";
import { api, ApiError } from "@/lib/api";
import { Markdown } from "@/components/markdown";
import { ArtifactViewer } from "@/components/viewers/artifact-viewer";
import { QuestionCard } from "@/components/questions/question-card";
import { isAwarenessOnly, type ArtifactListItem } from "@ci-train/contracts";

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
  await requireUser();
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
                background: "#0b1020",
                border: "1px solid #1f2845",
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
  return (
    <nav className="artifact-tabs" aria-label="Scenario artifacts">
      <Link
        href={`/scenarios/${slug}`}
        className={`tab ${activeArtifactId === null ? "tab-active" : ""}`}
      >
        Brief + questions
      </Link>
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
