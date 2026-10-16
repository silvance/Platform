import Link from "next/link";
import { requireUser, readToken } from "@/lib/session";
import { api } from "@/lib/api";
import type { Lane, LaneSummary } from "@ci-train/contracts";
import { InlineCode } from "@/components/inline-code";
import { LANE_SECTIONS } from "@/content/lane-sections";

export const dynamic = "force-dynamic";

// challenge-library landing page. Lanes are grouped into a small
// training progression — recommended start → host & device →
// triage → findings — so the page reads as a curriculum rather than
// a flat grid of equally-weighted topics. Each row still links to
// /scenarios/lanes/<slug>; no schema change, no unlocks, no
// per-cohort logic.
//
// Grouping lives in content/lane-sections.ts (shared with the public
// landing page); lanes the API returns that aren't in any group fall
// through to a defensive "Other" section so a new Lane enum value
// never disappears from the page before that file is updated.
export default async function ScenariosPage() {
  await requireUser();
  const token = await readToken();
  const { lanes } = await api.scenarios.lanes(token!);

  const sections = groupLanes(lanes);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Challenges</h1>
          <p>
            Work top-to-bottom for the recommended training progression,
            or jump straight to the section that matches your queue.
          </p>
        </div>
      </header>

      <div className="lane-sections">
        {sections.map((section, sectionIdx) => (
          <section key={section.key} className="lane-section">
            <div className="lane-section-head">
              <span className="lane-section-num" aria-hidden>
                {pad2(sectionIdx + 1)}
              </span>
              <div>
                <h2 className="lane-section-title">{section.title}</h2>
                <p className="lane-section-desc">{section.description}</p>
              </div>
            </div>
            <ul className="lane-index">
              {section.lanes.map((lane, laneIdx) => (
                <li key={lane.lane}>
                  <Link
                    href={`/scenarios/lanes/${encodeURIComponent(lane.lane)}`}
                    className="lane-row"
                  >
                    <LaneRow
                      lane={lane}
                      number={`${sectionIdx + 1}.${laneIdx + 1}`}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function LaneRow({ lane, number }: { lane: LaneSummary; number: string }) {
  const total = lane.publishedScenarioCount;
  return (
    <>
      <span className="lane-row-num" aria-hidden>
        {number}
      </span>
      <span className="lane-row-title">{lane.label}</span>
      <span className="lane-row-desc">
        <InlineCode text={lane.description} />
      </span>
      <span className="lane-row-meta">
        {total === 0 ? (
          <span>No challenges yet</span>
        ) : (
          <span>
            <strong>{total}</strong> challenge{total === 1 ? "" : "s"}
          </span>
        )}
        <LaneProgress lane={lane} />
      </span>
    </>
  );
}

function LaneProgress({ lane }: { lane: LaneSummary }) {
  const total = lane.publishedScenarioCount;
  if (total === 0) return null;
  if (lane.completedScenarioCount >= total) {
    return <span className="status-ok">Lane complete</span>;
  }
  return (
    <>
      {lane.completedScenarioCount > 0 ? (
        <span className="status-partial">
          {lane.completedScenarioCount}/{total} done
        </span>
      ) : null}
      {lane.inProgressScenarioCount > 0 ? (
        <span className="status-partial">
          {lane.inProgressScenarioCount} in progress
        </span>
      ) : null}
    </>
  );
}

interface LaneSection {
  key: string;
  title: string;
  description: string;
  lanes: LaneSummary[];
}

function groupLanes(lanes: LaneSummary[]): LaneSection[] {
  const byLane = new Map(lanes.map((l) => [l.lane, l]));
  const placed = new Set<Lane>();
  const sections: LaneSection[] = LANE_SECTIONS.map((cfg) => {
    const grouped: LaneSummary[] = [];
    for (const slug of cfg.laneSlugs) {
      const lane = byLane.get(slug);
      if (lane) {
        grouped.push(lane);
        placed.add(slug);
      }
    }
    return {
      key: cfg.key,
      title: cfg.title,
      description: cfg.description,
      lanes: grouped,
    };
  }).filter((s) => s.lanes.length > 0);

  // Defensive: if the API returns a Lane enum value not yet known
  // to this page, surface it in an "Other" section so it doesn't
  // vanish silently.
  const orphans = lanes.filter((l) => !placed.has(l.lane));
  if (orphans.length > 0) {
    sections.push({
      key: "other",
      title: "Other",
      description: "Lanes not yet grouped on this page.",
      lanes: orphans,
    });
  }

  return sections;
}
