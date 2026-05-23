import { requireUser } from "@/lib/session";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await requireUser();

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "1.5rem 1.25rem" }}>
      <h1 style={{ marginBottom: ".25rem" }}>Account security</h1>
      <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: "1.25rem" }}>
        Signed in as {user.email}.
      </p>
      <ChangePasswordForm />
      <section style={{ marginTop: "1.5rem", color: "var(--muted)", fontSize: ".9rem", maxWidth: 480 }}>
        <p style={{ marginTop: 0 }}>
          Changing your password keeps you signed in on this tab and signs you
          out everywhere else.
        </p>
        <p style={{ marginBottom: 0 }}>
          Lost access? An admin can reset your password from the user-management
          page. On the VPS, the operator can also use the
          {" "}<code>reset-password</code> script.
        </p>
      </section>
    </main>
  );
}
