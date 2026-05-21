import { requireInstructor } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireInstructor();

  return (
    <main>
      <h1>Instructor admin</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Welcome, {user.displayName}. M5 onward lands the real instructor tools
        (scenario authoring, submission review). For now this page exists to
        confirm the instructor-only route guard works.
      </p>
      <div className="card">
        <dl className="kv">
          <dt>your role</dt>
          <dd className="tag-ok">{user.role}</dd>
          <dt>scenarios authored</dt>
          <dd>0</dd>
          <dt>submissions to review</dt>
          <dd>0</dd>
        </dl>
      </div>
    </main>
  );
}
