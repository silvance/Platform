import Link from "next/link";
import { readToken, requireUser } from "@/lib/session";
import { api, ApiError } from "@/lib/api";
import { SKILL_AREA_LABELS } from "@ci-train/contracts";
import type {
  CalibrationStats,
  MeDailyResponse,
  MeStatsResponse,
  SkillAreaProgress,
  StreakStats,
} from "@ci-train/contracts";

export const dynamic = "force-dynamic";

// Tolerate one or both of /me/stats and /me/daily being unavailable
// on the deployed API. Both endpoints landed in separate PRs and
// the operator may not have re-deployed the API since; rather than
// crashing the entire Stats page with a Next.js server-side
// exception, fetch each independently and render whatever came back.
async function safeFetch<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; status: number | null; message: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, status: err.status, message: err.message };
    }
    return { ok: false, status: null, message: err instanceof Error ? err.message : "Request failed." };
  }
}

export default async function MeStatsPage() {
  const user = await requireUser();
  const token = await readToken();
  const [statsResult, dailyResult] = await Promise.all([
    safeFetch(() => api.stats.me(token!)),
    safeFetch(() => api.stats.daily(token!)),
  ]);

  return (
    <main>
      <h1>Your stats</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        {user.displayName}, here's how you're tracking across the catalog.
      </p>

      {dailyResult.ok ? (
        <DailyCard daily={dailyResult.data} />
      ) : (
        <UnavailableCard
          label="Today's challenge"
          status={dailyResult.status}
          message={dailyResult.message}
          hint="This card needs the /me/daily API endpoint (added recently). If the deployed API server is older, re-pack and re-deploy it."
        />
      )}

      {statsResult.ok ? (
        <>
          <HeaderTiles stats={statsResult.data} />
          <SkillAreaGrid rows={statsResult.data.skillAreaProgress} />
        </>
      ) : (
        <UnavailableCard
          label="Profile statistics"
          status={statsResult.status}
          message={statsResult.message}
          hint="This page needs the /me/stats API endpoint. If the deployed API server is older, re-pack and re-deploy it."
        />
      )}

      <div style={{ marginTop: "2rem" }}>
        <Link href="/me/progress" className="admin-btn admin-btn-ghost">
          View all scenarios →
        </Link>
      </div>
    </main>
  );
}

// Inline "this section couldn't load" card. Used when one of the
// dashboard's two endpoints is missing on the deployed API.
function UnavailableCard({
  label,
  status,
  message,
  hint,
}: {
  label: string;
  status: number | null;
  message: string;
  hint: string;
}) {
  return (
    <section
      className="card"
      style={{
        margin: "0 0 1.25rem",
        padding: "1rem 1.25rem",
        background: "var(--bg-elevated)",
        borderLeft: "3px solid rgba(255, 196, 0, 0.6)",
      }}
    >
      <div
        style={{
          fontSize: ".75rem",
          textTransform: "uppercase",
          letterSpacing: ".05em",
          color: "var(--muted)",
          marginBottom: ".25rem",
        }}
      >
        {label} — unavailable
      </div>
      <p style={{ margin: ".25rem 0", fontSize: ".9rem" }}>
        {status === 404
          ? "The API endpoint isn't available on this deployment."
          : `${status ?? ""} ${message}`.trim()}
      </p>
      <p style={{ margin: ".25rem 0 0", fontSize: ".8rem", color: "var(--muted)" }}>
        {hint}
      </p>
    </section>
  );
}

// ─── Daily card ───────────────────────────────────────────────

function DailyCard({ daily }: { daily: MeDailyResponse }) {
  if (daily.suggestion === null) {
    return (
      <section
        className="card"
        style={{
          margin: "0 0 1.25rem",
          padding: "1rem 1.25rem",
          background: "var(--bg-elevated)",
          borderLeft: "3px solid var(--accent)",
        }}
      >
        <div
          style={{
            fontSize: ".75rem",
            textTransform: "uppercase",
            letterSpacing: ".05em",
            color: "var(--muted)",
          }}
        >
          Today's challenge
        </div>
        <p style={{ margin: ".4rem 0 0" }}>
          You're caught up — every published scenario has been completed.
          Nice run.
        </p>
      </section>
    );
  }
  const s = daily.suggestion;
  return (
    <section
      className="card"
      style={{
        margin: "0 0 1.25rem",
        padding: "1rem 1.25rem",
        background: "var(--bg-elevated)",
        borderLeft: "3px solid var(--accent)",
      }}
    >
      <div
        style={{
          fontSize: ".75rem",
          textTransform: "uppercase",
          letterSpacing: ".05em",
          color: "var(--muted)",
          marginBottom: ".25rem",
        }}
      >
        Today's challenge
      </div>
      <Link
        href={`/scenarios/${encodeURIComponent(s.scenarioSlug)}`}
        style={{
          fontSize: "1.1rem",
          fontWeight: 600,
          color: "var(--fg)",
          textDecoration: "none",
        }}
      >
        {s.scenarioTitle} →
      </Link>
      <div
        style={{
          marginTop: ".25rem",
          fontSize: ".85rem",
          color: "var(--muted)",
        }}
      >
        {s.laneLabel} · {s.reason}
      </div>
    </section>
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
