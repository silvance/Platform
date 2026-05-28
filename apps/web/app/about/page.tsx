import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const dynamic = "force-dynamic";

// Page is still doing its URL-categorization job (mentions
// "training", "Education", "not commercial", etc.) but written in
// the maintainer's voice instead of the obviously-SEO-bait register
// from M21j.
export const metadata = {
  title: "About — CI Cyber Lab",
  description:
    "CI Cyber Lab is a training platform for counterintelligence and digital-forensics analysts. Unclassified, non-commercial, run in my personal capacity.",
  openGraph: {
    title: "About CI Cyber Lab",
    description:
      "Training platform for counterintelligence and digital-forensics analysts. Unclassified, non-commercial.",
    type: "website",
  },
};

const SUPPORT_URL = process.env.SUPPORT_URL?.trim() || null;
const CONTACT_URL = "https://github.com/silvance/Platform/issues";

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
        <h1 style={{ marginBottom: ".5rem" }}>About</h1>

        <p>
          CI Cyber Lab is a training platform for analysts working in
          counterintelligence and digital forensics. I run it in my
          personal capacity. Every scenario is fabricated &mdash;
          fabricated artifacts, fabricated names, fabricated cases. No
          real incident is reproduced here.
        </p>

        <p>
          I built it for CI Digital Threat Investigators (CDTIs) coming
          out of formal coursework. The ramp into the work is steep, the
          available material is scattered across textbooks and trial-by-fire,
          and most of what an analyst eventually needs they pick up from
          working real cases under a senior reviewer. This is the trainer I
          wish existed when I started &mdash; a place to practice reading
          artifacts and writing findings without anyone's actual incident on
          the line.
        </p>

        <p>
          Each scenario walks one reading skill: look at the evidence,
          decide what is supportable, write it down. The debriefs separate
          fact from inference and call out the over-claims a reviewer
          (or opposing counsel) will pick on.
        </p>

        <h2>What this isn&rsquo;t</h2>
        <p>
          This is not a substitute for unit training or for the supervision
          of credentialed examiners. Completing a scenario doesn't certify
          anyone for anything. It's not affiliated with the Department of
          Defense, the U.S. Army, or any other government agency &mdash; I
          maintain it in my personal capacity. And it's not a commercial
          product: no subscriptions, no paywalls, no ads.
        </p>

        <h2>Data and privacy</h2>
        <p>
          Account email and display name are the only personal data the site
          collects, and the only thing they're used for is sign-in and the
          per-user progress page. No analytics tracking of identifiable users;
          no advertising; no third-party sharing.
        </p>

        <h2>For IT administrators</h2>
        <p>
          If you're evaluating whether to allow this site on a managed
          network: the appropriate URL category is{" "}
          <strong>Education</strong> or <strong>Training / Tools</strong>.
          The site serves educational content; there's no user-to-user
          messaging, no public posting, and no learner file upload.
        </p>

        <h2>Contact</h2>
        <p>
          Questions, miscategorizations, or content concerns are best raised
          at{" "}
          <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">
            github.com/silvance/Platform/issues
          </a>
          .
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
            The site is independent and runs on my dime. If you want to
            chip in to offset the domain, hosting, and infrastructure costs,
            the link below goes to a tipping page. Contributions don't get
            you access, don't influence challenge content, and don't create
            any official relationship.
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
