import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

// Self-service registration (M23). Gated by an admin-issued access
// code: a valid code creates an auto-approved account so the user
// can sign in on the next request. Bad code → 400 with a generic
// message. Without a code there's no path to an account on this
// surface.
export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/scenarios");
  }

  return (
    <div className="auth-form-inner">
      <h1>Create an account</h1>
      <p className="lead">
        Enter the access code you were given, along with your details.
      </p>
      <RegisterForm />
      <p className="auth-form-footer">
        Already have an account?{" "}
        <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
