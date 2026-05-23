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

// Field-by-field safeParse so a single bad query param doesn't take
// the rest of the user's filters with it. Returns the salvaged query
// plus the names of fields whose values were dropped.
function parseScenarioFilters(
  sp: Record<string, string | string[] | undefined>,
): { query: ScenarioListQuery; invalidFilterFields: string[] } {
  const shape = ScenarioListQuery.shape;
  const raw = {
    skillArea: readSingle(sp["skillArea"]),
    difficulty: readSingle(sp["difficulty"]),
    tag: readSingle(sp["tag"]),
  };
  const query: Record<string, unknown> = {};
  const invalid: string[] = [];
  for (const key of Object.keys(raw) as Array<keyof typeof raw>) {
    const value = raw[key];
    if (value === undefined) continue;
    const r = shape[key].safeParse(value);
    if (r.success) {
      if (r.data !== undefined) query[key] = r.data;
    } else {
      invalid.push(key);
    }
  }
  return {
    query: query as ScenarioListQuery,
    invalidFilterFields: invalid,
  };
}

// M22 difficulty-tab navigation. Reuses the existing ?difficulty=
// filter so each tab is a real, bookmarkable, server-rendered URL
// — clicking "Level 2" gets you /scenarios?difficulty=2 with its
// own page state. The "All" tab clears the filter.
const DIFFICULTY_TABS: Array<{
  label: string;
  blurb: string;
  difficulty: number | null;
}> = [
  { label: "All", blurb: "Every difficulty",              difficulty: null },
  { label: "Level 1", blurb: "Intro / Basics",            difficulty: 1 },
  { label: "Level 2", blurb: "Beginner",                  difficulty: 2 },
  { label: "Level 3", blurb: "Intermediate",              difficulty: 3 },
  { label: "Level 4", blurb: "Advanced",                  difficulty: 4 },
  { label: "Level 5", blurb: "Expert",                    difficulty: 5 },
];

function buildHref(
  query: ScenarioListQuery,
  difficulty: number | null,
): string {
  const params = new URLSearchParams();
  if (difficulty !== null) params.set("difficulty", String(difficulty));
  if (query.skillArea) params.set("skillArea", query.skillArea);
  if (query.tag) params.set("tag", query.tag);
  const qs = params.toString();
  return qs ? `/scenarios?${qs}` : "/scenarios";
}

export default async function ScenariosPage({ searchParams }: Props) {
  const user = await requireUser();
  const token = await readToken();

  const sp = await searchParams;
  const { query, invalidFilterFields } = parseScenarioFilters(sp);

  const list = await api.scenarios.list(token!, query);
  const activeDifficulty = query.difficulty ?? null;

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Challenges</h1>
          <p>
            Welcome, {user.displayName}. Pick a challenge to inspect its
            artifacts, answer questions, and retry until correct.
          </p>
        </div>
      </header>

      <nav
        aria-label="Filter by difficulty"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: ".4rem",
          marginBottom: "1rem",
        }}
      >
        {DIFFICULTY_TABS.map((t) => {
          const isActive = activeDifficulty === t.difficulty;
          return (
            <Link
              key={t.label}
              href={buildHref(query, t.difficulty)}
              className="nav-link"
              data-active={isActive}
              style={{ paddingLeft: "0.85rem", paddingRight: "0.85rem" }}
              title={t.blurb}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {invalidFilterFields.length > 0 ? (
        <div
          className="card"
          style={{
            borderColor: "rgba(255, 196, 0, 0.45)",
            background: "rgba(255, 196, 0, 0.06)",
            color: "#f0d68a",
          }}
        >
          Ignored invalid filter{invalidFilterFields.length === 1 ? "" : "s"}:{" "}
          {invalidFilterFields.map((f) => (
            <code key={f} style={{ marginRight: ".5rem" }}>{f}</code>
          ))}
        </div>
      ) : null}

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

// M22 progress chip. Three states:
//   completed     all questions correct (or no questions but row exists)
//   in-progress   started, at least one question solved, not all
//   (omitted)     never started
function ProgressBadge({ scenario }: { scenario: ScenarioListItem }) {
  const { completedQuestions: done, totalQuestions: total } = scenario;
  if (total > 0 && done >= total) {
    return <span className="chip chip-ok">✓ Completed</span>;
  }
  if (done > 0) {
    return (
      <span className="chip chip-partial">
        In progress · {done}/{total}
      </span>
    );
  }
  return null;
}

function ScenarioCard({ scenario }: { scenario: ScenarioListItem }) {
  const hasAwarenessOnly = scenario.skillAreas.some(isAwarenessOnly);
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: ".5rem",
        }}
      >
        <h3 style={{ margin: 0 }}>{scenario.title}</h3>
        <ProgressBadge scenario={scenario} />
      </div>
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
