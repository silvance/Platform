import Link from "next/link";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

// M15 turned the /admin landing into a small hub. Challenges remain
// the bulk of the authoring surface; Users is the new M15 surface.
// A redirect made sense when there was only one admin destination
// — with two, even one extra click is cheaper than guessing which
// one you wanted.
export default async function AdminPage() {
  await requireAdmin();

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "1.5rem 1.25rem" }}>
      <h1 style={{ marginBottom: "1.25rem" }}>Admin</h1>
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
            Add users, reset passwords, change roles, or disable accounts.
          </p>
        </Link>
      </div>
    </main>
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
