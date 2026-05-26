import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, readToken } from "@/lib/session";
import { api } from "@/lib/api";
import {
  Lane,
  LANE_DESCRIPTIONS,
  LANE_LABELS,
  SKILL_AREA_LABELS,
  isAwarenessOnly,
  type ScenarioListItem,
} from "@ci-train/contracts";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

// per-lane page. Lists every published challenge in the lane in
// recommended-sequence order, grouped by module (the free-text
// subdivision the admin can set per scenario). Cards link out to
// the existing /scenarios/[slug] solve view.
export default async function LanePage({ params }: Props) {
  await requireUser();
  const token = await readToken();
  const { slug } = await params;

  const parsed = Lane.safeParse(slug);
  if (!parsed.success) notFound();
  const lane = parsed.data;

  const { scenarios } = await api.scenarios.list(token!, { lane });

  // Order: group by module so related challenges stay adjacent, but
  // render as a single multi-column grid so the page doesn't degrade
  // into a tall single column on lanes where each module is a
  // singleton (which is most of them — modules are a tag, not a
  // unit of progression).
  //
  // Within the flat order: easier module-groups come first
  // (tiebreak alphabetic), then by per-scenario sequence inside
  // the group. The module name is surfaced as a chip on each card
  // so the grouping info survives the flatten.
  const groups = new Map<string, ScenarioListItem[]>();
  for (const s of scenarios) {
    const key = s.module ?? "Other";
    const bucket = groups.get(key);
    if (bucket) bucket.push(s);
    else groups.set(key, [s]);
  }
  const orderedGroups = Array.from(groups.entries()).sort(
    ([aName, aItems], [bName, bItems]) => {
      const aDiff = Math.min(...aItems.map((i) => i.difficulty));
      const bDiff = Math.min(...bItems.map((i) => i.difficulty));
      if (aDiff !== bDiff) return aDiff - bDiff;
      return aName.localeCompare(bName);
    },
  );
  const flatScenarios = orderedGroups.flatMap(([, items]) => items);

  return (
    <main>
      <div style={{ fontSize: ".9rem", marginBottom: ".5rem" }}>
        <Link href="/scenarios" style={{ color: "var(--accent)" }}>
          ← All lanes
        </Link>
      </div>
      <header className="page-header">
        <div>
          <h1 style={{ marginBottom: ".25rem" }}>{LANE_LABELS[lane]}</h1>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            {LANE_DESCRIPTIONS[lane]}
          </p>
        </div>
      </header>

      {scenarios.length === 0 ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <p style={{ margin: 0 }}>Nothing here yet.</p>
        </div>
      ) : (
        <ul
          className="scenario-list"
          style={{ listStyle: "none", padding: 0, marginTop: "1rem" }}
        >
          {flatScenarios.map((s, idx) => (
            <li key={s.id} className="scenario-card">
              <Link href={`/scenarios/${s.slug}`}>
                <ScenarioCard scenario={s} ordinal={idx + 1} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

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

function ScenarioCard({
  scenario,
  ordinal,
}: {
  scenario: ScenarioListItem;
  ordinal: number;
}) {
  const hasAwarenessOnly = scenario.skillAreas.some(isAwarenessOnly);
  return (
    <>
      {scenario.module ? (
        <div
          style={{
            fontSize: ".7rem",
            textTransform: "uppercase",
            letterSpacing: ".06em",
            color: "var(--muted)",
            fontWeight: 600,
            marginBottom: ".25rem",
          }}
        >
          {scenario.module}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: ".5rem",
        }}
      >
        <h3 style={{ margin: 0 }}>
          <span
            style={{
              color: "var(--muted)",
              fontVariantNumeric: "tabular-nums",
              marginRight: ".4rem",
            }}
            aria-hidden
          >
            {String(ordinal).padStart(2, "0")}.
          </span>
          {scenario.title}
        </h3>
        <ProgressBadge scenario={scenario} />
      </div>
      <div className="summary">{scenario.summary}</div>
      <div>
        {scenario.skillAreas.map((a) => (
          <span
            key={a}
            className={`chip ${hasAwarenessOnly && isAwarenessOnly(a) ? "chip-rf" : "chip-skill"}`}
          >
            {SKILL_AREA_LABELS[a]}
          </span>
        ))}
        <span className="chip chip-difficulty">
          Level {scenario.difficulty}
        </span>
        {scenario.estimatedMinutes !== null ? (
          <span className="chip">≈ {scenario.estimatedMinutes} min</span>
        ) : null}
      </div>
    </>
  );
}
