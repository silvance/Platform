import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, readToken } from "@/lib/session";
import { api, ApiError } from "@/lib/api";
import { Markdown } from "@/components/markdown";
import { isAwarenessOnly } from "@ci-train/contracts";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ScenarioDetailPage({ params }: Props) {
  await requireUser();
  const token = await readToken();
  const { slug } = await params;

  let scenario;
  try {
    scenario = await api.scenarios.getBySlug(token!, slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const showAwarenessBanner = scenario.skillAreas.some(isAwarenessOnly);
  const disclaimer = scenario.brief?.disclaimerMd ?? null;

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

      {scenario.brief ? (
        <Markdown source={scenario.brief.markdownBody} />
      ) : (
        <div className="card">
          <p style={{ margin: 0, color: "var(--muted)" }}>
            This scenario has no brief content yet.
          </p>
        </div>
      )}

      <footer>
        Artifacts arrive in M3. Questions, submissions, and the debrief
        view arrive in M5.
      </footer>
    </main>
  );
}
