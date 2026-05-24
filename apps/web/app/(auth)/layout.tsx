import type { ReactNode } from "react";

// Two-column shell for /login + /register. Stacks vertically on
// narrow screens via the .auth-shell media query.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand-panel">
        <a href="/login" className="auth-brand-mark">
          CICyberLab
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
        <p className="auth-footer-note">
          © {new Date().getFullYear()} CICyberLab. Fictional, sanitized
          examples for training only.
        </p>
      </aside>
      <main className="auth-form-panel">{children}</main>
    </div>
  );
}
