import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { LogoutButton } from "./logout-button";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <>
      <header
        style={{
          borderBottom: "1px solid #1f2845",
          padding: "1rem 1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 1080,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
          <strong>ci-train</strong>
          <nav style={{ display: "flex", gap: "1rem" }}>
            <Link href="/scenarios" style={{ color: "var(--accent)" }}>
              Challenges
            </Link>
            {user.role === "admin" ? (
              <Link href="/admin" style={{ color: "var(--accent)" }}>
                Admin
              </Link>
            ) : null}
          </nav>
        </div>
        <div style={{ display: "flex", gap: ".75rem", alignItems: "center" }}>
          <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>
            {user.displayName}
            {user.role === "admin" ? (
              <>
                {" "}·{" "}
                <span className="tag-ok">admin</span>
              </>
            ) : null}
          </span>
          <LogoutButton />
        </div>
      </header>
      {children}
    </>
  );
}
