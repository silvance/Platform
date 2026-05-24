import type { ReactNode } from "react";
import Link from "next/link";

const SUPPORT_URL = process.env.SUPPORT_URL?.trim() || null;

// Two-column shell for /login + /register. Stacks vertically on
// narrow screens via the .auth-shell media query.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand-panel">
        <a href="/login" className="auth-brand-mark">
          CI Cyber Lab
        </a>
        <div className="auth-tagline">
          <h2>Counter-intelligence and digital-forensics training.</h2>
          <p>
            Read the artifacts. Decide what is supportable. Write the finding.
            All examples are fictional and sanitized.
          </p>
          <ul className="auth-feature-list" style={{ marginTop: "2rem" }}>
            <li>Lane-organised challenge library with a recommended order in each lane.</li>
            <li>Per-user progress with debriefs after each question.</li>
            <li>Admin tools for content, accounts, and challenge review.</li>
          </ul>
        </div>
        <p
          className="auth-footer-note"
          style={{ display: "flex", flexWrap: "wrap", gap: ".75rem", alignItems: "center" }}
        >
          <span>
            © {new Date().getFullYear()} CI Cyber Lab. Fictional, sanitized
            examples for training only.
          </span>
          <Link href="/about" style={{ color: "inherit", opacity: 0.8 }}>
            About
          </Link>
          <Link href="/privacy" style={{ color: "inherit", opacity: 0.8 }}>
            Privacy
          </Link>
          {SUPPORT_URL ? (
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "inherit", opacity: 0.8 }}
            >
              Support hosting costs
            </a>
          ) : null}
        </p>
      </aside>
      <main className="auth-form-panel">{children}</main>
    </div>
  );
}
