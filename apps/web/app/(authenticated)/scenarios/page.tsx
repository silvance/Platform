import Link from "next/link";
import { requireUser, readToken } from "@/lib/session";
import { api } from "@/lib/api";
import { ScenarioListQuery, isAwarenessOnly, type ScenarioListItem } from "@ci-train/contracts";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readSingle(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function ScenariosPage({ searchParams }: Props) {
  const user = await requireUser();
  const token = await readToken();

  const sp = await searchParams;
  const query = ScenarioListQuery.parse({
    skillArea: readSingle(sp["skillArea"]),
    difficulty: readSingle(sp["difficulty"]),
    tag: readSingle(sp["tag"]),
  });

  const list = await api.scenarios.list(token!, query);

  return (
    <main>
      <h1>Scenarios</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Welcome, {user.displayName}. Pick a scenario to read the brief.
        Artifacts and questions land in upcoming milestones (M3, M5).
      </p>

      <FilterBar query={query} totalShown={list.scenarios.length} total={list.total} />

      {list.scenarios.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>No scenarios match your filters.</p>
        </div>
      ) : (
        <ul className="scenario-list" style={{ listStyle: "none", padding: 0 }}>
          {list.scenarios.map((s) => (
            <li key={s.id} className="scenario-card">
              <Link href={`/scenarios/${s.slug}`}>
                <ScenarioCard scenario={s} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function ScenarioCard({ scenario }: { scenario: ScenarioListItem }) {
  const hasAwarenessOnly = scenario.skillAreas.some(isAwarenessOnly);
  return (
    <>
      <h3>{scenario.title}</h3>
      <div className="summary">{scenario.summary}</div>
      <div>
        {scenario.skillAreas.map((a) => (
          <span
            key={a}
            className={`chip ${hasAwarenessOnly && isAwarenessOnly(a) ? "chip-rf" : "chip-skill"}`}
          >
            {a}
          </span>
        ))}
        <span className="chip chip-difficulty">difficulty {scenario.difficulty}/5</span>
        {scenario.estimatedMinutes !== null ? (
          <span className="chip">≈ {scenario.estimatedMinutes} min</span>
        ) : null}
      </div>
    </>
  );
}

function FilterBar({
  query,
  totalShown,
  total,
}: {
  query: ScenarioListQuery;
  totalShown: number;
  total: number;
}) {
  const hasAny = Boolean(query.skillArea || query.difficulty || query.tag);
  if (!hasAny) {
    return (
      <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
        Showing {totalShown} of {total}.
      </p>
    );
  }
  return (
    <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
      Showing {totalShown} of {total} ·
      {query.skillArea ? <> skillArea=<code>{query.skillArea}</code></> : null}
      {query.difficulty !== undefined ? <> · difficulty={query.difficulty}</> : null}
      {query.tag ? <> · tag=<code>{query.tag}</code></> : null}
      {" "}<Link href="/scenarios" style={{ color: "var(--accent)" }}>clear filters</Link>
    </p>
  );
}
