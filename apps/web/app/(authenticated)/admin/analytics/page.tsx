import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { readToken, requireAdmin } from "@/lib/session";
import {
  LANE_LABELS,
  type QuestionAnalytics,
  type ScenarioAnalytics,
} from "@ci-train/contracts";

export const dynamic = "force-dynamic";

// admin-only per-scenario / per-question analytics surface.
// Shows which scenarios have traction and which individual
// questions are tripping people up (low first-try-correct
// indicates a candidate bad answer key or unclear wording).
export default async function AnalyticsPage() {
  await requireAdmin();
  const token = await readToken();
  if (!token) redirect("/login");

  const { scenarios } = await api.analytics.get(token);

  // Pre-sort: most-attempted scenarios first, then by lane then title.
  const ordered = [...scenarios].sort((a, b) => {
    if (a.usersStarted !== b.usersStarted) {
      return b.usersStarted - a.usersStarted;
    }
    if (a.lane !== b.lane) return a.lane.localeCompare(b.lane);
    return a.title.localeCompare(b.title);
  });

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "1.5rem 1.25rem" }}>
      <h1 style={{ marginBottom: ".5rem" }}>Analytics</h1>
      <p className="lead" style={{ marginTop: 0, marginBottom: "1.25rem", maxWidth: 760 }}>
        Per-scenario and per-question completion stats. Use the
        first-try-correct rate to spot questions that may have a
        bad answer key, an unclear stem, or distractors that read
        as correct.
      </p>

      {ordered.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>No scenarios yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {ordered.map((s) => (
            <ScenarioBlock key={s.scenarioId} scenario={s} />
          ))}
        </div>
      )}
    </main>
  );
}

function ScenarioBlock({ scenario }: { scenario: ScenarioAnalytics }) {
  const completionRate =
    scenario.usersStarted > 0
      ? Math.round((scenario.usersCompleted / scenario.usersStarted) * 100)
      : 0;
  return (
    <details
      className="card"
      open={scenario.usersStarted > 0}
      style={{ padding: ".9rem 1.1rem" }}
    >
      <summary
        style={{
          cursor: "pointer",
          display: "flex",
          flexWrap: "wrap",
          gap: ".5rem",
          alignItems: "center",
        }}
      >
        <strong style={{ fontSize: "1rem" }}>{scenario.title}</strong>
        <span className="chip" style={{ fontSize: ".72rem" }}>
          {LANE_LABELS[scenario.lane]}
        </span>
        {scenario.module ? (
          <span className="chip" style={{ fontSize: ".72rem" }}>
            {scenario.module}
          </span>
        ) : null}
        <span style={{ color: "var(--muted)", fontSize: ".85rem", marginLeft: "auto" }}>
          {scenario.usersStarted} started · {scenario.usersCompleted} completed
          {scenario.usersStarted > 0 ? ` (${completionRate}%)` : ""}
        </span>
        <Link
          href={`/admin/challenges/${encodeURIComponent(scenario.slug)}/edit`}
          style={{ color: "var(--accent)", fontSize: ".85rem" }}
        >
          edit →
        </Link>
      </summary>
      <div style={{ marginTop: ".75rem", overflowX: "auto" }}>
        {scenario.questions.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>No questions.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                <th style={th}>#</th>
                <th style={th}>Prompt</th>
                <th style={th}>Type</th>
                <th style={th}>Attempted</th>
                <th style={th}>Completed</th>
                <th style={th}>First-try correct</th>
                <th style={th}>Total submissions</th>
              </tr>
            </thead>
            <tbody>
              {scenario.questions.map((q) => (
                <QuestionRow key={q.questionId} q={q} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}

function QuestionRow({ q }: { q: QuestionAnalytics }) {
  // First-try rate is the headline signal; flag it for the
  // operator's eye when it dips below 50% with a meaningful
  // sample size.
  const sampleSize = q.usersCompleted;
  const firstTryRate =
    sampleSize > 0 ? Math.round((q.firstTryCorrect / sampleSize) * 100) : null;
  const lowSignal = sampleSize >= 5 && firstTryRate !== null && firstTryRate < 50;

  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <td style={td}>{q.ordinal}</td>
      <td style={{ ...td, maxWidth: 480 }}>
        <span style={{ color: "var(--muted)" }}>{q.promptPreview}</span>
      </td>
      <td style={td}>
        <code style={{ fontSize: ".78rem" }}>{q.type}</code>
      </td>
      <td style={td}>{q.usersAttempted}</td>
      <td style={td}>{q.usersCompleted}</td>
      <td style={{ ...td, color: lowSignal ? "var(--status-bad-fg)" : "inherit" }}>
        {firstTryRate === null ? "—" : `${q.firstTryCorrect} / ${sampleSize} (${firstTryRate}%)`}
        {lowSignal ? (
          <span
            title="Less than half of completers got this on their first try with a sample of 5+ — worth reviewing the wording / answer key."
            style={{
              marginLeft: ".4rem",
              fontSize: ".7rem",
              color: "var(--status-bad-fg)",
            }}
          >
            ⚠
          </span>
        ) : null}
      </td>
      <td style={td}>{q.totalSubmissions}</td>
    </tr>
  );
}

const th: React.CSSProperties = {
  padding: ".55rem .5rem",
  fontSize: ".82rem",
  fontWeight: 500,
  borderBottom: "1px solid var(--border)",
};
const td: React.CSSProperties = {
  padding: ".55rem .5rem",
  fontSize: ".88rem",
  verticalAlign: "top",
};
