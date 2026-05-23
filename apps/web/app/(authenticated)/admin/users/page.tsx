import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { readToken, requireAdmin } from "@/lib/session";
import { CreateUserForm } from "./create-user-form";
import { UserRow } from "./user-row";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  const me = await requireAdmin();
  const token = await readToken();
  if (!token) redirect("/login");

  const { users } = await api.users.list(token);

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "1.5rem 1.25rem" }}>
      <h1 style={{ marginBottom: "1.25rem" }}>Users</h1>

      <CreateUserForm />

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg-sunken)", textAlign: "left" }}>
              <th style={headerStyle}>User</th>
              <th style={headerStyle}>Role</th>
              <th style={headerStyle}>Status</th>
              <th style={headerStyle}>Last login</th>
              <th style={headerStyle}>Password</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} user={u} isSelf={u.id === me.id} />
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "1rem", color: "var(--muted)" }}>
                  No users — that shouldn't happen, did the seed run?
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
          maxWidth: 680,
        }}
      >
        <h3 style={{ color: "var(--fg)", marginBottom: ".4rem" }}>Notes</h3>
        <ul style={{ paddingLeft: "1.25rem", marginTop: 0 }}>
          <li>
            Disabling a user immediately signs them out everywhere.
          </li>
          <li>
            Resetting a password signs the target user out everywhere and
            requires them to log in again with the new password.
          </li>
          <li>
            The system protects itself from being left without an
            enabled admin — the last admin can't demote themselves or be
            disabled.
          </li>
          <li>
            Hard delete isn't supported. Disable accounts you no longer
            want to keep around.
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
