import Link from "next/link";
import { requireUser, readToken } from "@/lib/session";
import { api } from "@/lib/api";
import type { LaneSummary } from "@ci-train/contracts";

export const dynamic = "force-dynamic";

// challenge-library landing page. Replaces the flat all-cards
// list with a lane overview: one card per Lane, showing the count
// of published challenges plus the user's progress in that lane.
// Each card links to /scenarios/lanes/<slug>, which renders the
// challenges in their recommended sequence within the lane.
export default async function ScenariosPage() {
  await requireUser();
  const token = await readToken();
  const { lanes } = await api.scenarios.lanes(token!);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Challenges</h1>
          <p>
            Pick a lane. Each one groups challenges by mission area.
          </p>
        </div>
      </header>

      <ul
        className="card-grid"
        style={{ marginTop: "var(--space-4)" }}
      >
        {lanes.map((lane) => (
          <li key={lane.lane}>
            <Link
              href={`/scenarios/lanes/${encodeURIComponent(lane.lane)}`}
              className="lane-card"
            >
              <LaneCard lane={lane} />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

function LaneCard({ lane }: { lane: LaneSummary }) {
  const empty = lane.publishedScenarioCount === 0;
  return (
    <>
      <div className="lane-card-head">
        <h3 className="lane-card-title">{lane.label}</h3>
        <LaneProgressBadge lane={lane} />
      </div>
      <p className="lane-card-body">{lane.description}</p>
      <div className="lane-card-foot">
        {empty ? (
          <span>No challenges yet</span>
        ) : (
          <>
            <span>
              <strong>{lane.publishedScenarioCount}</strong>{" "}
              challenge{lane.publishedScenarioCount === 1 ? "" : "s"}
            </span>
            {lane.inProgressScenarioCount > 0 ? (
              <span>· {lane.inProgressScenarioCount} in progress</span>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

function LaneProgressBadge({ lane }: { lane: LaneSummary }) {
  const total = lane.publishedScenarioCount;
  if (total === 0) return null;
  if (lane.completedScenarioCount >= total) {
    return <span className="chip chip-ok">✓ Lane complete</span>;
  }
  if (lane.completedScenarioCount > 0) {
    return (
      <span className="chip chip-partial">
        {lane.completedScenarioCount}/{total} done
      </span>
    );
  }
  return null;
}
