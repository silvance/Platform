import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "About — CI Cyber Lab",
};

const SUPPORT_URL = process.env.SUPPORT_URL?.trim() || null;

export default function AboutPage() {
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
        <h1 style={{ marginBottom: ".5rem" }}>About CI Cyber Lab</h1>

        <p>
          I built CI Cyber Lab to train new CI Digital Threat Investigators
          (CDTIs). The ramp into the work is steep — you have to learn to read
          forensic artefacts, write findings that survive cross-examination,
          and stay calibrated about what the evidence does and doesn't
          establish. The trainers I had to learn on were scattered across
          textbooks, official courses, and trial-by-fire. This is the trainer
          I wish existed when I started.
        </p>

        <p>
          Every challenge is built around a single reading skill: examine an
          artefact, decide what's supportable, write the finding. Debriefs
          separate fact from inference and name the over-claims that an
          experienced reviewer (or opposing counsel) will pick on. The
          platform is unclassified, uses only fictional and sanitized
          examples, and is maintained in my personal capacity.
        </p>

        <h2 style={{ marginTop: "2rem" }}>What this isn't</h2>
        <ul>
          <li>
            It isn't a substitute for unit training, accredited courses, or
            the supervision of credentialed agents and examiners.
          </li>
          <li>
            It isn't a credential. Completing a challenge doesn't certify
            anyone for anything.
          </li>
          <li>
            It isn't classified. No real cases, no real names, no live
            indicators.
          </li>
        </ul>

        <section
          style={{
            marginTop: "2.5rem",
            padding: "1rem 1.25rem",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg-sunken)",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
            Support hosting costs
          </h2>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            CI Cyber Lab is an independent, unclassified training project
            maintained in my personal capacity. Optional contributions help
            offset domain, hosting, and infrastructure costs. Contributions
            do not provide access, influence challenge content, or create any
            official relationship.
          </p>
          {SUPPORT_URL ? (
            <p style={{ marginTop: "1rem", marginBottom: 0 }}>
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
                style={{ textDecoration: "none" }}
              >
                Support hosting costs
              </a>
            </p>
          ) : null}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
