import Link from "next/link";
import { readToken, requireUser } from "@/lib/session";
import { api } from "@/lib/api";
import { SKILL_AREA_LABELS } from "@ci-train/contracts";
import type {
  CalibrationStats,
  MeStatsResponse,
  SkillAreaProgress,
  StreakStats,
} from "@ci-train/contracts";

export const dynamic = "force-dynamic";

export default async function MeStatsPage() {
  const user = await requireUser();
  const token = await readToken();
  const stats: MeStatsResponse = await api.stats.me(token!);

  return (
    <main>
      <h1>Your stats</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        {user.displayName}, here's how you're tracking across the catalog.
      </p>

      <HeaderTiles stats={stats} />
      <SkillAreaGrid rows={stats.skillAreaProgress} />

      <div style={{ marginTop: "2rem" }}>
        <Link href="/me/progress" className="admin-btn admin-btn-ghost">
          View all scenarios →
        </Link>
      </div>
    </main>
  );
}

// ─── Header tiles ─────────────────────────────────────────────

function HeaderTiles({ stats }: { stats: MeStatsResponse }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "0.75rem",
        marginBottom: "1.5rem",
      }}
    >
      <Tile
        label="Scenarios completed"
        value={String(stats.totals.scenariosCompleted)}
        sub={`${stats.totals.scenariosStarted} started`}
      />
      <Tile
        label="Questions correct"
        value={String(stats.totals.questionsCorrect)}
        sub={`${stats.totals.questionsAnswered} attempted`}
      />
      <CalibrationTile calibration={stats.calibration} />
      <StreakTile streak={stats.streak} />
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card" style={{ padding: "1rem" }}>
      <div style={{ color: "var(--muted)", fontSize: ".8rem" }}>{label}</div>
      <div style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ color: "var(--muted)", fontSize: ".75rem", marginTop: ".25rem" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function CalibrationTile({ calibration }: { calibration: CalibrationStats }) {
  const sub =
    calibration.totalConfidenceQuestions === 0
      ? "Answer some confidence questions to grade"
      : `${calibration.percentInRange}% in range ` +
        `(${calibration.withinRange} / ${calibration.totalConfidenceQuestions})`;
  return (
    <Tile label="Calibration grade" value={calibration.grade} sub={sub} />
  );
}

function StreakTile({ streak }: { streak: StreakStats }) {
  const value = streak.currentDays === 0 ? "—" : `${streak.currentDays} day${streak.currentDays === 1 ? "" : "s"}`;
  const sub =
    streak.longestDays === 0
      ? "No activity yet"
      : `Longest: ${streak.longestDays} day${streak.longestDays === 1 ? "" : "s"}`;
  return <Tile label="Current streak" value={value} sub={sub} />;
}

// ─── Skill-area grid ──────────────────────────────────────────

function SkillAreaGrid({ rows }: { rows: SkillAreaProgress[] }) {
  // Sort: areas with any activity first (desc by percent), then the
  // untouched ones in their enum order. Gives a stable layout but
  // foregrounds where the user has been working.
  const sorted = [...rows].sort((a, b) => {
    if (a.questionsCorrect > 0 || b.questionsCorrect > 0) {
      return b.percentComplete - a.percentComplete;
    }
    return 0;
  });

  return (
    <>
      <h2 style={{ marginTop: "1rem", marginBottom: ".75rem" }}>
        Skill areas
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "0.6rem",
        }}
      >
        {sorted.map((row) => (
          <SkillAreaCard key={row.skillArea} row={row} />
        ))}
      </div>
    </>
  );
}

function SkillAreaCard({ row }: { row: SkillAreaProgress }) {
  const label = SKILL_AREA_LABELS[row.skillArea];
  const percent = row.percentComplete;
  return (
    <div
      className="card"
      style={{
        padding: ".75rem .9rem",
        display: "flex",
        flexDirection: "column",
        gap: ".4rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: ".5rem",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: ".9rem" }}>{label}</span>
        <span
          style={{
            color: "var(--muted)",
            fontSize: ".75rem",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {row.questionsCorrect} / {row.questionsTotal}
        </span>
      </div>
      <ProgressBar percent={percent} />
      <div
        style={{
          fontSize: ".7rem",
          color: "var(--muted)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {percent}%
      </div>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      style={{
        height: "6px",
        width: "100%",
        background: "var(--bg-sunken)",
        borderRadius: "3px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${percent}%`,
          background: "var(--accent)",
          transition: "width .2s ease",
        }}
      />
    </div>
  );
}
