import Link from "next/link";
import { requireUser, readToken } from "@/lib/session";
import { api } from "@/lib/api";
import type { LaneSummary } from "@ci-train/contracts";

export const dynamic = "force-dynamic";

// M25 challenge-library landing page. Replaces the flat all-cards
// list with a lane overview: one card per Lane, showing the count
// of published challenges plus the user's progress in that lane.
// Each card links to /scenarios/lanes/<slug>, which renders the
// challenges in their recommended sequence within the lane.
export default async function ScenariosPage() {
  const user = await requireUser();
  const token = await readToken();
  const { lanes } = await api.scenarios.lanes(token!);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Challenges</h1>
          <p>
            Welcome, {user.displayName}. Pick a lane to start.
          </p>
        </div>
      </header>

      <ul
        className="lane-list"
        style={{
          listStyle: "none",
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "1rem",
          marginTop: "1rem",
        }}
      >
        {lanes.map((lane) => (
          <li key={lane.lane}>
            <Link
              href={`/scenarios/lanes/${encodeURIComponent(lane.lane)}`}
              className="card"
              style={{
                display: "block",
                padding: "1rem 1.1rem",
                textDecoration: "none",
                color: "inherit",
                height: "100%",
              }}
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
    <div style={{ display: "flex", flexDirection: "column", gap: ".5rem", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: ".5rem",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{lane.label}</h3>
        <LaneProgressBadge lane={lane} />
      </div>
      <p
        style={{
          margin: 0,
          color: "var(--muted)",
          fontSize: ".88rem",
          lineHeight: 1.45,
          flex: 1,
        }}
      >
        {lane.description}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: ".5rem",
          fontSize: ".82rem",
          color: "var(--muted)",
          marginTop: ".25rem",
        }}
      >
        {empty ? (
          <span>No challenges yet</span>
        ) : (
          <>
            <span>
              <strong style={{ color: "var(--fg)" }}>
                {lane.publishedScenarioCount}
              </strong>{" "}
              challenge{lane.publishedScenarioCount === 1 ? "" : "s"}
            </span>
            {lane.inProgressScenarioCount > 0 ? (
              <span>· {lane.inProgressScenarioCount} in progress</span>
            ) : null}
          </>
        )}
      </div>
    </div>
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
