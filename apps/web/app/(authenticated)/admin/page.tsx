import Link from "next/link";
import { readToken, requireAdmin } from "@/lib/session";
import { api, ApiError } from "@/lib/api";
import type { AdminStatsResponse } from "@ci-train/contracts";

export const dynamic = "force-dynamic";

// /admin landing. The stats dashboard at the top answers
// "is anything awaiting action?" without clicking through.
export default async function AdminPage() {
  await requireAdmin();
  const token = await readToken();
  let stats: AdminStatsResponse | null = null;
  if (token) {
    try {
      stats = await api.stats.get(token);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    }
  }

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "1.5rem 1.25rem" }}>
      <header className="page-header">
        <div>
          <h1>Admin</h1>
          <p>
            Operator dashboard. Pending self-registrations, scenario review
            verdicts, and total completions surface here.
          </p>
        </div>
      </header>

      {stats ? <StatsGrid stats={stats} /> : (
        <div className="card" style={{ color: "var(--muted)" }}>
          Stats unavailable. Check the api container.
        </div>
      )}

      <h2 style={{ marginTop: "2rem" }}>Admin tools</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "1rem",
        }}
      >
        <Link href="/admin/challenges" className="card" style={cardStyle}>
          <strong style={{ fontSize: "1.05rem" }}>Challenges</strong>
          <p style={pStyle}>
            Create, edit, import, and manage scenarios + their artifacts.
          </p>
        </Link>
        <Link href="/admin/users" className="card" style={cardStyle}>
          <strong style={{ fontSize: "1.05rem" }}>Users</strong>
          <p style={pStyle}>
            Add users, approve pending registrations, reset passwords, change
            roles, or disable accounts.
          </p>
        </Link>
        <Link href="/admin/review" className="card" style={cardStyle}>
          <strong style={{ fontSize: "1.05rem" }}>Review</strong>
          <p style={pStyle}>
            Challenge review — mark scenarios approved / needs-rewrite / flagged,
            capture notes without leaving the page.
          </p>
        </Link>
      </div>
    </main>
  );
}

function StatsGrid({ stats }: { stats: AdminStatsResponse }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: "0.75rem",
        marginBottom: "1.25rem",
      }}
    >
      <StatCard
        label="Pending approval"
        value={stats.users.pendingApproval}
        href="/admin/users"
        accent={stats.users.pendingApproval > 0 ? "bad" : undefined}
      />
      <StatCard
        label="Users"
        value={stats.users.total}
        sub={`${stats.users.byRole.admin} admin · ${stats.users.byRole.user} user`}
        href="/admin/users"
      />
      <StatCard
        label="Published challenges"
        value={stats.scenarios.byStatus.published}
        sub={`${stats.scenarios.byStatus.draft} draft · ${stats.scenarios.byStatus.archived} archived`}
        href="/admin/challenges"
      />
      <StatCard
        label="Awaiting review"
        value={stats.scenarios.byReview.needs_review}
        sub={`${stats.scenarios.byReview.approved} approved · ${stats.scenarios.byReview.flagged} flagged`}
        href="/admin/review"
        accent={stats.scenarios.byReview.needs_review > 0 ? "warn" : undefined}
      />
      <StatCard
        label="Completed answers"
        value={stats.attempts.completedAllTime}
        sub="across all users"
      />
      <StatCard
        label="Disabled accounts"
        value={stats.users.disabled}
        sub="soft-deleted"
        href="/admin/users"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  href,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  href?: string;
  accent?: "bad" | "warn";
}) {
  const cardCls =
    accent === "bad"
      ? "tag-bad"
      : accent === "warn"
      ? "tag-warn"
      : "";

  const inner = (
    <div className="card" style={{ height: "100%" }}>
      <div
        style={{
          color: "var(--muted)",
          fontSize: ".78rem",
          textTransform: "uppercase",
          letterSpacing: ".04em",
          marginBottom: ".25rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.75rem",
          fontWeight: 600,
          lineHeight: 1.1,
        }}
        className={cardCls}
      >
        {value}
      </div>
      {sub ? (
        <div
          style={{
            color: "var(--muted)",
            fontSize: ".8rem",
            marginTop: ".35rem",
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

const cardStyle: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "var(--fg)",
};
const pStyle: React.CSSProperties = {
  color: "var(--muted)",
  marginTop: ".4rem",
  marginBottom: 0,
  fontSize: ".9rem",
};
