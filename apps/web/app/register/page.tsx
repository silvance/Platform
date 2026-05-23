import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

// Self-service registration (M17). Open submission, admin-approval
// queue: a successful submit creates a row with approvedAt = null;
// the user can't sign in until an admin clicks "Approve" in
// /admin/users. The page handles the post-success state inline —
// no redirect to /login (the user can't sign in yet).
export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) {
    // Already signed in — registering wouldn't make sense; send
    // them where they'd normally land.
    redirect(user.role === "admin" ? "/admin" : "/scenarios");
  }

  return (
    <main>
      <h1>Request an account</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Submit your details. An admin will review the request; once they
        approve, you'll be able to sign in.
      </p>
      <RegisterForm />
    </main>
  );
}
