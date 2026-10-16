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
import { LANE_INTROS } from "@/content/lane-intros";
import { LaneIntro } from "@/components/lane-intro";
import { InlineCode } from "@/components/inline-code";

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
  // render as one numbered index rather than a heading per module —
  // on most lanes each module is a singleton (modules are a tag, not
  // a unit of progression).
  //
  // Within the flat order: easier module-groups come first
  // (tiebreak alphabetic), then by per-scenario sequence inside
  // the group. The module name is shown in each row's metadata so
  // the grouping info survives the flatten.
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
            <InlineCode text={LANE_DESCRIPTIONS[lane]} />
          </p>
        </div>
      </header>

      {LANE_INTROS[lane] && (
        <LaneIntro lane={lane} source={LANE_INTROS[lane]!.trim()} />
      )}

      {scenarios.length === 0 ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <p style={{ margin: 0 }}>Nothing here yet.</p>
        </div>
      ) : (
        <ol className="challenge-index">
          {flatScenarios.map((s, idx) => (
            <li key={s.id} className="challenge-row">
              <Link href={`/scenarios/${s.slug}`}>
                <ChallengeRow scenario={s} ordinal={idx + 1} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function ProgressStatus({ scenario }: { scenario: ScenarioListItem }) {
  const { completedQuestions: done, totalQuestions: total } = scenario;
  if (total > 0 && done >= total) {
    return <span className="status-ok">Completed</span>;
  }
  if (done > 0) {
    return (
      <span className="status-partial">
        In progress {done}/{total}
      </span>
    );
  }
  return null;
}

function ChallengeRow({
  scenario,
  ordinal,
}: {
  scenario: ScenarioListItem;
  ordinal: number;
}) {
  const awarenessOnly = scenario.skillAreas.some(isAwarenessOnly);
  return (
    <>
      <span className="challenge-num" aria-hidden>
        {String(ordinal).padStart(2, "0")}
      </span>
      <div>
        <h3 className="challenge-title">{scenario.title}</h3>
        <p className="challenge-summary">
          <InlineCode text={scenario.summary} />
        </p>
        <p className="meta-line">
          {scenario.skillAreas.map((a, i) => (
            <span key={a}>
              {i > 0 ? <span className="sep">·</span> : null}
              {SKILL_AREA_LABELS[a]}
            </span>
          ))}
          {awarenessOnly ? (
            <>
              <span className="sep">·</span>
              <span className="status-warn">Awareness only</span>
            </>
          ) : null}
        </p>
      </div>
      <div className="challenge-meta">
        <span>Level {scenario.difficulty}</span>
        {scenario.module ? <span>{scenario.module}</span> : null}
        <ProgressStatus scenario={scenario} />
      </div>
    </>
  );
}
