import Link from "next/link";
import { requireInstructor, readToken } from "@/lib/session";
import { api } from "@/lib/api";
import { ImportPackForm } from "./import-pack-form";

export const dynamic = "force-dynamic";

export default async function AdminChallengesPage() {
  await requireInstructor();
  const token = await readToken();
  const { scenarios } = await api.authoring.list(token!);

  return (
    <main>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <h1>Challenges</h1>
        <Link href="/admin/challenges/new" className="admin-btn">
          New challenge
        </Link>
      </header>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Author and manage challenge content. Drafts are visible only to admins.
      </p>

      <details
        className="card"
        style={{ padding: ".75rem 1.25rem", marginBottom: ".75rem" }}
      >
        <summary style={{ cursor: "pointer", color: "var(--muted)" }}>
          Import scenario pack (.zip)
        </summary>
        <div style={{ marginTop: ".75rem" }}>
          <ImportPackForm />
        </div>
      </details>

      {scenarios.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            No challenges yet.{" "}
            <Link href="/admin/challenges/new" style={{ color: "var(--accent)" }}>
              Create one
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Difficulty</th>
                <th>Questions</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.title}</div>
                    <code style={{ color: "var(--muted)", fontSize: ".8rem" }}>
                      {s.slug}
                    </code>
                  </td>
                  <td>
                    <span className={`admin-status-${s.status}`}>{s.status}</span>
                  </td>
                  <td>{s.difficulty}/5</td>
                  <td>{s.questionCount}</td>
                  <td style={{ color: "var(--muted)", fontSize: ".8rem" }}>
                    {new Date(s.updatedAt).toLocaleDateString()}
                  </td>
                  <td>
                    <Link
                      href={`/admin/challenges/${s.slug}/edit`}
                      style={{ color: "var(--accent)" }}
                    >
                      Edit →
                    </Link>
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
