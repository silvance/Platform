import Link from "next/link";
import { readToken, requireUser } from "@/lib/session";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function MyProgressPage() {
  const user = await requireUser();
  const token = await readToken();
  const { rows, totals } = await api.progress.me(token!);

  return (
    <main>
      <h1>My progress</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Every challenge {user.displayName} has attempted. Drafts and archived
        challenges still appear here if you have progress against them.
      </p>

      <div className="card" style={{ display: "flex", gap: "1.5rem" }}>
        <div>
          <div style={{ color: "var(--muted)", fontSize: ".8rem" }}>Touched</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>
            {totals.scenariosTouched}
          </div>
        </div>
        <div>
          <div style={{ color: "var(--muted)", fontSize: ".8rem" }}>Completed</div>
          <div
            style={{
              fontSize: "1.25rem",
              fontWeight: 600,
              color: totals.scenariosCompleted > 0 ? "var(--ok)" : "var(--fg)",
            }}
          >
            {totals.scenariosCompleted}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
          <a href="/api/me/progress/csv" className="admin-btn admin-btn-ghost">
            Download CSV
          </a>
          <a href="/api/me/progress/json" className="admin-btn admin-btn-ghost">
            Download JSON
          </a>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "var(--muted)" }}>
            No progress yet.{" "}
            <Link href="/scenarios" style={{ color: "var(--accent)" }}>
              Pick a challenge
            </Link>{" "}
            to get started.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Challenge</th>
                <th>Status</th>
                <th>Solved</th>
                <th>Started</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.scenarioId}>
                  <td>
                    <Link
                      href={`/scenarios/${r.scenarioSlug}`}
                      style={{ color: "var(--accent)", textDecoration: "none" }}
                    >
                      {r.scenarioTitle}
                    </Link>
                    <div>
                      <code style={{ color: "var(--muted)", fontSize: ".75rem" }}>
                        {r.scenarioSlug}
                      </code>
                    </div>
                  </td>
                  <td>
                    <span className={`admin-status-${r.scenarioStatus}`}>
                      {r.scenarioStatus}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        r.completedAt ? "tag-ok" : ""
                      }
                    >
                      {r.completedQuestions} / {r.totalQuestions}
                    </span>
                  </td>
                  <td style={{ color: "var(--muted)", fontSize: ".8rem" }}>
                    {new Date(r.startedAt).toLocaleDateString()}
                  </td>
                  <td style={{ color: "var(--muted)", fontSize: ".8rem" }}>
                    {r.completedAt
                      ? new Date(r.completedAt).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
