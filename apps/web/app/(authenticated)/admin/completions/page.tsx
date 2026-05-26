import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { readToken, requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

// Admin-only recent-completions feed. Each row is a (user,
// scenario) where every question in the scenario was solved
// at least once. Newest-first by completion time. Up to 200
// rows per page; the response carries the total count so the
// header can say "showing 200 of 412."
export default async function CompletionsPage() {
  await requireAdmin();
  const token = await readToken();
  if (!token) redirect("/login");

  const { completions, totalCount } = await api.completions.listRecent(token, {
    limit: 200,
  });

  return (
    <main>
      <header className="page-header">
        <div>
          <h1 style={{ marginBottom: ".25rem" }}>Completions</h1>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            {totalCount > completions.length
              ? `Showing ${completions.length} of ${totalCount}, newest first.`
              : totalCount > 0
                ? `${totalCount} completion${totalCount === 1 ? "" : "s"}, newest first.`
                : "Newest first."}
          </p>
        </div>
      </header>

      {completions.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>Nothing here yet.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Completed</th>
                <th>User</th>
                <th>Challenge</th>
                <th>First-try / total</th>
                <th>Submissions</th>
                <th>Time on task</th>
              </tr>
            </thead>
            <tbody>
              {completions.map((c) => {
                const completed = new Date(c.completedAt);
                const started = new Date(c.startedAt);
                const durationMs =
                  completed.getTime() - started.getTime();
                return (
                  <tr key={`${c.userId}:${c.scenarioId}`}>
                    <td>
                      <time
                        dateTime={c.completedAt}
                        title={completed.toISOString()}
                      >
                        {completed.toLocaleString()}
                      </time>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span>{c.userDisplayName}</span>
                        <span
                          style={{
                            color: "var(--muted)",
                            fontSize: ".78rem",
                          }}
                        >
                          {c.userEmail}
                        </span>
                      </div>
                    </td>
                    <td>
                      <Link
                        href={`/scenarios/${encodeURIComponent(c.scenarioSlug)}`}
                        style={{ color: "var(--accent)" }}
                      >
                        {c.scenarioTitle}
                      </Link>
                    </td>
                    <td>
                      {c.firstTryCount}
                      {" / "}
                      {c.totalQuestions}
                    </td>
                    <td>{c.totalAttempts}</td>
                    <td title={formatDurationVerbose(durationMs)}>
                      {formatDurationShort(durationMs)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

// "38m 12s" / "1h 04m" / "2d 03h" depending on magnitude. Negative
// or non-finite durations (clock skew, malformed data) collapse to
// "—" so the table cell isn't misleading.
function formatDurationShort(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) {
    return `${days}d ${pad(hours)}h`;
  }
  if (hours > 0) {
    return `${hours}h ${pad(minutes)}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${pad(seconds)}s`;
  }
  return `${seconds}s`;
}

function formatDurationVerbose(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "duration unavailable";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds) parts.push(`${seconds}s`);
  return parts.length ? parts.join(" ") : "0s";
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
