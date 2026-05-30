import Link from "next/link";
import { requireUser, readToken } from "@/lib/session";
import { api } from "@/lib/api";
import type { Lane, LaneSummary } from "@ci-train/contracts";

export const dynamic = "force-dynamic";

// challenge-library landing page. Lanes are grouped into a small
// training progression — recommended start → host & device →
// triage → findings — so the page reads as a curriculum rather than
// a flat grid of equally-weighted topics. Each card still links to
// /scenarios/lanes/<slug>; no schema change, no unlocks, no
// per-cohort logic.
//
// Grouping is configured below; lanes the API returns that aren't
// in any group fall through to a defensive "Other" section so a new
// Lane enum value never disappears from the page before this file
// is updated.
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
        {sections.map((section) => (
          <section key={section.key} className="lane-section">
            <div className="lane-section-head">
              <h2 className="lane-section-title">{section.title}</h2>
              <p className="lane-section-desc">{section.description}</p>
            </div>
            <ul className="card-grid">
              {section.lanes.map((lane) => (
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
          </section>
        ))}
      </div>
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

// ─── Section configuration ───────────────────────────────────
// One config object so the page edit is the only place to touch
// when a new Lane enum value lands. Keep the lane order inside
// each section as the canonical reading order.

interface LaneSection {
  key: string;
  title: string;
  description: string;
  lanes: LaneSummary[];
}

interface LaneSectionConfig {
  key: string;
  title: string;
  description: string;
  laneSlugs: readonly Lane[];
}

const LANE_SECTIONS: readonly LaneSectionConfig[] = [
  {
    key: "recommended-start",
    title: "Recommended Start",
    description:
      "Begin here. Short scenarios that warm you up on the platform and lay down the DF fundamentals every later lane builds on.",
    laneSlugs: ["ojt_bridge", "foundations"],
  },
  {
    key: "host-device-forensics",
    title: "Host & Device Forensics",
    description:
      "Per-OS and per-device artifact triage — Windows, Linux, macOS, mobile extractions, memory images, and removable-media spillage cases.",
    laneSlugs: [
      "windows_artifacts",
      "linux_forensics",
      "macos_forensics",
      "mobile_forensics",
      "memory_forensics",
      "removable_media_spillage",
    ],
  },
  {
    key: "cyber-triage",
    title: "Cyber Triage",
    description:
      "Reading inbound telemetry without over-claiming — email + BEC, network logs, malware samples, insider-risk indicators, RF awareness.",
    laneSlugs: [
      "email_bec",
      "network_logs",
      "malware_analysis",
      "insider_risk",
      "rf_awareness",
    ],
  },
  {
    key: "findings-evidence",
    title: "Findings & Evidence",
    description:
      "Turning what the artifacts prove into custody-clean, defensible written findings.",
    laneSlugs: ["evidence_handling", "report_writing"],
  },
];

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
