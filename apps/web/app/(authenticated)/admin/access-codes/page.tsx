import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { readToken, requireAdmin } from "@/lib/session";
import { CreateAccessCodeForm } from "./create-code-form";
import { CodeRow } from "./code-row";

export const dynamic = "force-dynamic";

// M23: registration access-code admin surface. Admin creates +
// disables codes; the literal `code` string is visible here (and
// nowhere else) so the admin can re-share with cohorts.
export default async function AccessCodesPage() {
  await requireAdmin();
  const token = await readToken();
  if (!token) redirect("/login");

  const { codes } = await api.accessCodes.list(token);

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "1.5rem 1.25rem" }}>
      <h1 style={{ marginBottom: ".5rem" }}>Access codes</h1>
      <p className="lead" style={{ marginTop: 0, marginBottom: "1.25rem", maxWidth: 720 }}>
        Self-registration requires one of these codes. Share a code with a
        cohort, group, or course; new accounts created with a valid code are
        auto-approved and can sign in immediately.
      </p>

      <CreateAccessCodeForm />

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg-sunken)", textAlign: "left" }}>
              <th style={headerStyle}>Code / label</th>
              <th style={headerStyle}>Status</th>
              <th style={headerStyle}>Uses</th>
              <th style={headerStyle}>Created</th>
              <th style={headerStyle}>Expires</th>
              <th style={headerStyle}></th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <CodeRow key={c.id} code={c} />
            ))}
            {codes.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "1rem", color: "var(--muted)" }}>
                  No codes yet. Issue one above to enable self-registration.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <section
        style={{
          marginTop: "1.5rem",
          color: "var(--muted)",
          fontSize: ".9rem",
          maxWidth: 720,
        }}
      >
        <h3 style={{ color: "var(--fg)", marginBottom: ".4rem" }}>Notes</h3>
        <ul style={{ paddingLeft: "1.25rem", marginTop: 0 }}>
          <li>
            Codes only create normal-user accounts. They never grant admin.
          </li>
          <li>
            Disabling a code is irreversible from this UI. Existing accounts
            that were created with that code are unaffected.
          </li>
          <li>
            The registration endpoint returns the same generic rejection
            message for missing, wrong, disabled, expired, and exhausted
            codes — by design.
          </li>
        </ul>
      </section>
    </main>
  );
}

const headerStyle: React.CSSProperties = {
  padding: ".7rem .5rem",
  fontSize: ".85rem",
  color: "var(--muted)",
  fontWeight: 500,
  borderBottom: "1px solid var(--border)",
};
