import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ScenariosPage() {
  const user = await requireUser();

  return (
    <main>
      <h1>Scenarios</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Welcome, {user.displayName}. M2 wires up the scenario catalog —
        for now this page exists to confirm the trainee flow is gated.
      </p>
      <div className="card">
        <dl className="kv">
          <dt>your role</dt>
          <dd className="tag-ok">{user.role}</dd>
          <dt>scenarios available</dt>
          <dd>0 (coming in M2)</dd>
        </dl>
      </div>
    </main>
  );
}
