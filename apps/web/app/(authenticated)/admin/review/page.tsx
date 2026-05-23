import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin, readToken } from "@/lib/session";
import { api } from "@/lib/api";
import { REVIEW_STATUS_LABELS } from "@ci-train/contracts";
import { ReviewRow } from "./review-row";

export const dynamic = "force-dynamic";

// Admin-only playthrough-review surface. Lists every scenario
// with the counts an admin cares about, the current review
// verdict, the last reviewer + timestamp, and an inline
// status + notes form per row.
//
// Order: rows where `reviewStatus !== "approved"` rise to the
// top (alphabetical-asc on the enum puts `approved` after
// everything else by accident — works in our favour here).
export default async function AdminReviewPage() {
  await requireAdmin();
  const token = await readToken();
  if (!token) redirect("/login");

  const { scenarios } = await api.authoring.listForReview(token);

  const total = scenarios.length;
  const approved = scenarios.filter((s) => s.reviewStatus === "approved").length;
  const pending = scenarios.filter((s) => s.reviewStatus === "needs_review").length;
  const flagged = total - approved - pending;

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "1.5rem 1.25rem" }}>
      <header className="page-header">
        <div>
          <h1>Challenge review</h1>
          <p>
            Playthrough log. Admin-only. Set a review verdict per scenario as
            you walk through it; flag specific issues without leaving the
            page. Notes don't reach regular users.
          </p>
        </div>
      </header>

      <div
        className="card"
        style={{
          display: "flex",
          gap: "1.5rem",
          flexWrap: "wrap",
          marginBottom: "1.25rem",
        }}
      >
        <Stat label="Total" value={total} />
        <Stat label="Approved" value={approved} />
        <Stat label="Needs review" value={pending} />
        <Stat label="Flagged (other)" value={flagged} />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg-sunken)", textAlign: "left" }}>
              <th style={headerStyle}>Scenario</th>
              <th style={{ ...headerStyle, width: "44%" }}>Review</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <ReviewRow key={s.id} row={s} />
            ))}
          </tbody>
        </table>
      </div>

      <section
        style={{
          marginTop: "1.5rem",
          color: "var(--muted)",
          fontSize: ".88rem",
          maxWidth: 720,
        }}
      >
        <h3 style={{ color: "var(--fg)", marginBottom: ".4rem" }}>How this is used</h3>
        <ul style={{ paddingLeft: "1.25rem", marginTop: 0 }}>
          <li>
            Click a scenario title to open the authoring editor where
            per-question notes can also be recorded.
          </li>
          <li>
            Status options: {Object.values(REVIEW_STATUS_LABELS).join(", ")}.
          </li>
          <li>
            Notes are admin-only and never reach the user-facing scenario
            payload.
          </li>
        </ul>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: ".8rem", textTransform: "uppercase", letterSpacing: ".04em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  padding: ".7rem .65rem",
  fontSize: ".78rem",
  color: "var(--muted-strong)",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  borderBottom: "1px solid var(--border)",
};
