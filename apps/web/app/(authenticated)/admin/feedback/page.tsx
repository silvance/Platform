import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { readToken, requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

// Admin-only feedback inbox. Newest-first across the whole
// catalogue. The widget at the bottom of every /scenarios/:slug
// posts here; this page is where the admin reads the responses.
export default async function FeedbackPage() {
  await requireAdmin();
  const token = await readToken();
  if (!token) redirect("/login");

  const { feedback, totalCount } = await api.feedback.listAll(token, {
    limit: 200,
  });

  return (
    <main>
      <header className="page-header">
        <div>
          <h1 style={{ marginBottom: ".25rem" }}>Feedback</h1>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Notes submitted by users from the bottom of each challenge.
            Most-recent first; up to 200 rows per page.
            {totalCount > feedback.length ? (
              <>
                {" "}
                Showing {feedback.length} of {totalCount}.
              </>
            ) : null}
          </p>
        </div>
      </header>

      {feedback.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            No feedback yet. Once users submit notes from the widget at the
            bottom of a challenge, they'll appear here newest-first.
          </p>
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          {feedback.map((f) => {
            const ts = new Date(f.createdAt);
            return (
              <li
                key={f.id}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                    fontSize: "0.85rem",
                    color: "var(--muted-strong)",
                  }}
                >
                  <Link
                    href={`/scenarios/${encodeURIComponent(f.scenarioSlug)}`}
                    style={{
                      color: "var(--accent)",
                      fontWeight: 500,
                    }}
                  >
                    {f.scenarioTitle}
                  </Link>
                  <span style={{ color: "var(--muted)" }}>·</span>
                  <span>{f.userDisplayName}</span>
                  <span style={{ color: "var(--muted)" }}>
                    &lt;{f.userEmail}&gt;
                  </span>
                  <span style={{ color: "var(--muted)" }}>·</span>
                  <time
                    dateTime={f.createdAt}
                    title={ts.toISOString()}
                    style={{ color: "var(--muted)" }}
                  >
                    {ts.toLocaleString()}
                  </time>
                  {f.rating !== null ? (
                    <span
                      className="chip"
                      style={{
                        background: "var(--bg-active)",
                        color: "var(--accent)",
                        borderColor: "var(--accent)",
                      }}
                      title={`${f.rating} of 5`}
                    >
                      ★ {f.rating}/5
                    </span>
                  ) : null}
                </div>
                <p
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    color: "var(--fg)",
                    lineHeight: 1.5,
                  }}
                >
                  {f.body}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
