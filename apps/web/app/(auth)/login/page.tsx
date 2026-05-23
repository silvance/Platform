import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/scenarios");
  }

  return (
    <div className="auth-form-inner">
      <h1>Sign in</h1>
      <p className="lead">Welcome back. Use your CICyberLab credentials.</p>
      <LoginForm />
      <p className="auth-form-footer">
        No account yet?{" "}
        <Link href="/register">Request one</Link>
      </p>
    </div>
  );
}
