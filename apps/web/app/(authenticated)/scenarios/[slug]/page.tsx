import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser, readToken } from "@/lib/session";
import { api, ApiError } from "@/lib/api";
import { Markdown } from "@/components/markdown";
import { ArtifactViewer } from "@/components/viewers/artifact-viewer";
import { AttemptControl } from "@/components/attempt-control";
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

export default async function ScenarioDetailPage({ params, searchParams }: Props) {
  const user = await requireUser();
  const token = await readToken();
  const { slug } = await params;
  const sp = await searchParams;
  const focusedArtifactId = readSingle(sp["artifact"]);

  let scenario;
  try {
    scenario = await api.scenarios.getBySlug(token!, slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const showAwarenessBanner = scenario.skillAreas.some(isAwarenessOnly);
  const disclaimer = scenario.brief?.disclaimerMd ?? null;

  // Resolve which artifact tab is active. Default to "brief". `?artifact=<id>`
  // pins a specific artifact; unknown ids are silently dropped (back to brief).
  const validArtifactIds = new Set(scenario.artifacts.map((a) => a.id));
  const activeArtifactId =
    focusedArtifactId && validArtifactIds.has(focusedArtifactId)
      ? focusedArtifactId
      : null;
  // If the URL had ?artifact=garbage, normalize the URL on next click.
  if (focusedArtifactId && !validArtifactIds.has(focusedArtifactId)) {
    // Don't redirect on server-render; the user will just see the brief.
    // (Could redirect, but harmless to no-op.)
  }
  const activeArtifact: ArtifactListItem | null = activeArtifactId
    ? scenario.artifacts.find((a) => a.id === activeArtifactId) ?? null
    : null;

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

      {user.role === "trainee" ? (
        <AttemptControl slug={slug} />
      ) : null}

      {disclaimer ? <Markdown source={disclaimer} variant="callout" /> : null}

      {scenario.artifacts.length > 0 ? (
        <ArtifactTabs
          slug={slug}
          artifacts={scenario.artifacts}
          activeArtifactId={activeArtifactId}
        />
      ) : null}

      {activeArtifact ? (
        <ArtifactViewer
          scenarioSlug={slug}
          artifact={activeArtifact}
          token={token!}
        />
      ) : scenario.brief ? (
        <Markdown source={scenario.brief.markdownBody} />
      ) : (
        <div className="card">
          <p style={{ margin: 0, color: "var(--muted)" }}>
            This scenario has no brief content yet.
          </p>
        </div>
      )}

      <footer>
        Questions, submissions, and the debrief view arrive in M5.
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
        Brief
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
