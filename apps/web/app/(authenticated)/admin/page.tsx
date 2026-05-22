import { requireInstructor } from "@/lib/session";

export const dynamic = "force-dynamic";

// Maintainer/admin surface. Today it's a placeholder; a later
// milestone introduces challenge authoring tooling here. Role check
// uses the existing "instructor" enum value pending a broader
// admin/maintainer role rename.
export default async function AdminPage() {
  const user = await requireInstructor();

  return (
    <main>
      <h1>Admin</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Welcome, {user.displayName}. Challenge authoring tooling lands here in
        a later milestone. For now this page exists to confirm the admin-only
        route guard works.
      </p>
      <div className="card">
        <dl className="kv">
          <dt>your role</dt>
          <dd className="tag-ok">{user.role}</dd>
          <dt>challenges authored</dt>
          <dd>0</dd>
        </dl>
      </div>
    </main>
  );
}
