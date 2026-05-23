import { redirect } from "next/navigation";
import Link from "next/link";
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
    redirect(user.role === "admin" ? "/admin" : "/scenarios");
  }

  return (
    <div className="auth-form-inner">
      <h1>Request an account</h1>
      <p className="lead">
        Submit your details. An admin will review and enable the account.
      </p>
      <RegisterForm />
      <p className="auth-form-footer">
        Already have an account?{" "}
        <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
