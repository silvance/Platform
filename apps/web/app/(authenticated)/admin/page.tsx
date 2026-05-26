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
    <main>
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
        <div className="card muted">
          Stats unavailable. Check the api container.
        </div>
      )}

      <h2>Admin tools</h2>
      <div className="card-grid">
        <Link href="/admin/challenges" className="tool-card">
          <span className="tool-card-title">Challenges</span>
          <p className="tool-card-body">
            Create, edit, import, and manage scenarios + their artifacts.
          </p>
        </Link>
        <Link href="/admin/users" className="tool-card">
          <span className="tool-card-title">Users</span>
          <p className="tool-card-body">
            Add users, approve pending registrations, reset passwords, change
            roles, or disable accounts.
          </p>
        </Link>
        <Link href="/admin/review" className="tool-card">
          <span className="tool-card-title">Review</span>
          <p className="tool-card-body">
            Challenge review — mark scenarios approved / needs-rewrite / flagged,
            capture notes without leaving the page.
          </p>
        </Link>
        <Link href="/admin/completions" className="tool-card">
          <span className="tool-card-title">Completions</span>
          <p className="tool-card-body">
            Recent-completions feed — who finished which challenge, when,
            and how many attempts they took.
          </p>
        </Link>
      </div>
    </main>
  );
}

function StatsGrid({ stats }: { stats: AdminStatsResponse }) {
  return (
    <div className="card-grid-tight" style={{ marginBottom: "var(--space-5)" }}>
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
  const inner = (
    <>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value.toLocaleString()}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </>
  );
  return href ? (
    <Link href={href} className="stat-card" data-accent={accent}>
      {inner}
    </Link>
  ) : (
    <div className="stat-card" data-accent={accent}>
      {inner}
    </div>
  );
}
