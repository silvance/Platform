import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/scenarios");
  }

  return (
    <main>
      <h1>CICyberLab</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>Sign in to continue.</p>
      <LoginForm />
    </main>
  );
}
