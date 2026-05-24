import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Privacy — CI Cyber Lab",
};

export default function PrivacyPage() {
  return (
    <>
      <main
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "2rem 1.25rem",
        }}
      >
        <div style={{ fontSize: ".9rem", marginBottom: "1rem" }}>
          <Link href="/" style={{ color: "var(--accent)" }}>
            ← CI Cyber Lab
          </Link>
        </div>
        <h1 style={{ marginBottom: ".5rem" }}>Privacy</h1>
        <p style={{ color: "var(--muted)" }}>
          What CI Cyber Lab collects, what it doesn't, and what users should
          never enter here.
        </p>

        <h2 style={{ marginTop: "1.5rem" }}>What is collected</h2>
        <ul>
          <li>
            <strong>Account information</strong> needed to operate the site:
            email, display name, password hash, role, and account status
            (enabled / disabled).
          </li>
          <li>
            <strong>Challenge activity</strong>: per-question submissions, the
            latest answer state for rehydration, attempt counts, and
            completion status.
          </li>
          <li>
            <strong>Basic web analytics</strong> may be used to understand how
            the site is used and where challenges need improvement. Analytics
            do not identify individual users by name.
          </li>
        </ul>

        <h2 style={{ marginTop: "1.5rem" }}>What is not collected</h2>
        <ul>
          <li>
            Passwords are <strong>never stored in plaintext</strong>. Only an
            Argon2id hash is persisted.
          </li>
          <li>
            CI Cyber Lab does <strong>not ask users to upload real case
            data</strong>. Every artefact and scenario shipped with the
            platform is fictional and sanitized.
          </li>
        </ul>

        <h2 style={{ marginTop: "1.5rem" }}>What users should not enter</h2>
        <p>
          Do not enter classified, sensitive, operational, personally
          identifying, or real investigative information into CI Cyber Lab —
          including in question free-text fields, admin notes, or
          authored-scenario content. Treat the platform as an unclassified
          training environment.
        </p>

        <h2 style={{ marginTop: "1.5rem" }}>Contributions</h2>
        <p>
          Optional contributions to help offset hosting costs are handled
          entirely by <strong>GitHub Sponsors</strong>. CI Cyber Lab does not
          receive payment information, does not retain billing records, and
          does not link sponsorship to any platform account.
        </p>

        <h2 style={{ marginTop: "1.5rem" }}>Scope</h2>
        <p>
          CI Cyber Lab is an independent, unclassified training project
          maintained in my personal capacity. It is not a substitute for
          accredited training, agency tooling, or any official record system.
        </p>

        <h2 style={{ marginTop: "1.5rem" }}>Contact</h2>
        <p>
          Questions about this page or how the platform handles data can be
          directed to the site maintainer through the project's GitHub
          repository.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
