import type { ReactNode } from "react";

// Shared shell for /login + /register. Two-column on desktop:
// brand panel on the left (gradient + tagline + feature list),
// form on the right. Stacks vertically on narrow screens via
// the .auth-shell media query.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand-panel">
        <a href="/login" className="auth-brand-mark">
          <span className="brand-mark" aria-hidden>CL</span>
          CICyberLab
        </a>
        <div className="auth-tagline">
          <h2>Train the cyber instincts that hold up under scrutiny.</h2>
          <p>
            Static-artifact challenges in counter-intelligence and digital
            forensics. Investigate, write the finding, defend it on
            cross-examination.
          </p>
          <ul className="auth-feature-list" style={{ marginTop: "2rem" }}>
            <li>Polished challenge library with fact-vs-inference debriefs.</li>
            <li>Per-user progress with answer keys revealed on completion.</li>
            <li>Admin tools for adding challenges and managing accounts.</li>
          </ul>
        </div>
        <p className="auth-footer-note">
          © {new Date().getFullYear()} CICyberLab. All challenges use
          fictional, sanitized examples.
        </p>
      </aside>
      <main className="auth-form-panel">{children}</main>
    </div>
  );
}
