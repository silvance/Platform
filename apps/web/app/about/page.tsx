import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const dynamic = "force-dynamic";

// Front-loads the "this is a training / educational resource"
// signal because URL-categorization reviewers (Symantec/Broadcom
// WebPulse, Zscaler ZIA, Forcepoint, Talos) read this page first
// when deciding whether a domain belongs in "Education" vs "Personal
// Page" / "Uncategorized". Several enterprise filters (notably DoD
// proxies) drop uncategorized .codes / Vercel-hosted sites into a
// read-only / no-posting policy by default; clear ownership +
// purpose copy + schema markup is the cheapest fix.
export const metadata = {
  title: "About — CI Cyber Lab",
  description:
    "CI Cyber Lab is an unclassified, non-commercial training platform for counterintelligence and digital-forensics analysts. Fictional, sanitized scenarios only.",
  openGraph: {
    title: "About CI Cyber Lab",
    description:
      "Unclassified educational training platform for counterintelligence and digital-forensics analysts.",
    type: "website",
  },
};

const SUPPORT_URL = process.env.SUPPORT_URL?.trim() || null;
const CONTACT_URL = "https://github.com/silvance/Platform/issues";

// schema.org JSON-LD identifying the site as an educational
// resource. Categorization crawlers + content classifiers (e.g.
// Cisco Talos, Symantec WebPulse) ingest this structured data and
// weight it heavily when assigning a category. Server-rendered into
// the document so it ships in the initial HTML, no client bundle.
const SCHEMA_JSONLD = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "CI Cyber Lab",
  alternateName: "CICyberLab",
  description:
    "Unclassified, non-commercial training platform for counterintelligence and digital-forensics analysts. Uses only fictional and sanitized example artifacts.",
  educationalCredentialAwarded: "None — completion is not a credential.",
  audience: {
    "@type": "EducationalAudience",
    educationalRole: "Counterintelligence and digital-forensics analysts.",
  },
  isAccessibleForFree: true,
  inLanguage: "en-US",
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA_JSONLD) }}
      />
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
        <p className="lead" style={{ fontSize: "1.05rem", color: "var(--muted-strong)" }}>
          CI Cyber Lab is an <strong>unclassified, non-commercial training
          platform</strong> for counterintelligence and digital-forensics
          analysts. Every scenario uses fictional, sanitized example artifacts
          designed to teach analytic reading skills.
        </p>

        <h2>Purpose</h2>
        <p>
          I built CI Cyber Lab to train new CI Digital Threat Investigators
          (CDTIs). The ramp into the work is steep — you have to learn to read
          forensic artifacts, write findings that survive cross-examination, and
          stay calibrated about what the evidence does and doesn&rsquo;t
          establish. The trainers I had were scattered across textbooks,
          official courses, and trial-by-fire. This is the trainer I wish
          existed when I started.
        </p>
        <p>
          Each challenge is built around a single reading skill: examine an
          artifact, decide what is supportable, write the finding. Debriefs
          separate fact from inference and name the over-claims that an
          experienced reviewer (or opposing counsel) will pick on.
        </p>

        <h2>Audience</h2>
        <p>
          Counterintelligence Digital Threat Investigators, military and
          civilian intelligence and forensics analysts, and learners working
          through introductory DF/CI material. Use is voluntary; there is no
          enrollment, no track, and no certificate.
        </p>

        <h2>Content and data</h2>
        <ul>
          <li>
            <strong>Unclassified.</strong> No real cases, no real names, no
            live indicators, no operational data.
          </li>
          <li>
            <strong>Fictional and sanitized.</strong> Every artifact (logs,
            emails, registry exports, extraction reports, etc.) is constructed
            for instruction. Resemblance to a real incident is coincidental.
          </li>
          <li>
            <strong>Author-curated.</strong> Scenarios are written by the site
            maintainer. The platform is not a user-generated-content site,
            a discussion forum, or a file-sharing service.
          </li>
          <li>
            <strong>No personal data trafficking.</strong> Account email and
            display name are the only PII collected, used solely for sign-in
            and progress tracking. No analytics tracking of identifiable
            users; no advertising; no third-party sale.
          </li>
        </ul>

        <h2>What this isn&rsquo;t</h2>
        <ul>
          <li>
            Not a substitute for unit training, accredited courses, or the
            supervision of credentialed agents and examiners.
          </li>
          <li>
            Not a credential. Completing a challenge does not certify anyone
            for anything.
          </li>
          <li>
            Not an official Department of Defense, U.S. Army, or U.S.
            Government site. The platform is maintained in the author&rsquo;s
            personal capacity and is not affiliated with, endorsed by, or
            sponsored by any government agency.
          </li>
          <li>
            Not a commercial product. No subscriptions, no pay-walled content,
            no advertising.
          </li>
        </ul>

        <h2>Contact</h2>
        <p>
          Questions, miscategorizations, or content concerns:{" "}
          <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">
            github.com/silvance/Platform/issues
          </a>
          .
        </p>

        <h2>Network filters and URL categorization</h2>
        <p>
          If you are an IT administrator evaluating whether to allow this site
          on a managed network, the appropriate URL category is{" "}
          <strong>Education</strong> or <strong>Training / Tools</strong>. The
          site serves educational content only; there is no user-to-user
          messaging, no public posting, and no file upload by learners.
        </p>

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
