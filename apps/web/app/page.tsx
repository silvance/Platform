import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LANE_DESCRIPTIONS, LANE_LABELS } from "@ci-train/contracts";
import { getCurrentUser } from "@/lib/session";
import { SITE_URL } from "@/lib/site";
import { LANE_SECTIONS } from "@/content/lane-sections";
import { InlineCode } from "@/components/inline-code";
import { SiteFooter } from "@/components/site-footer";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Scenario-based training for counterintelligence and digital-forensics analysts: read fabricated, sanitized artifacts, decide what the evidence supports, and write defensible findings. Unclassified, free, non-commercial.";

export const metadata: Metadata = {
  title: "CI Cyber Lab — counterintelligence and digital-forensics training",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "CI Cyber Lab",
    description: DESCRIPTION,
    type: "website",
    url: "/",
  },
};

const SCHEMA_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "CI Cyber Lab",
  url: SITE_URL,
  description: DESCRIPTION,
  inLanguage: "en-US",
};

// Signed-in users go straight to their work. Everyone else — including
// the crawlers web filters use to categorize a domain — gets a public
// description of the site. A bare login form on a young domain reads
// as a credential-harvesting page, which keeps managed networks
// (e.g. DoD internet isolation) from ever allowing interaction.
export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/scenarios");

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA_JSONLD) }}
      />
      <header className="public-header">
        <div className="public-header-inner">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden />
            CI Cyber Lab
          </Link>
          <nav className="public-nav" aria-label="Site">
            <Link href="/about">About</Link>
            <Link href="/login" className="btn btn-ghost">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="landing">
        <section className="landing-hero">
          <p className="label-mono">
            Unclassified · Fictional case material · Free
          </p>
          <h1>Counterintelligence and digital-forensics training.</h1>
          <p className="landing-lead">
            Practice reading evidence the way a reviewer will: look at the
            artifacts, decide what they actually support, and write a finding
            that holds up. Every scenario is fabricated &mdash; artifacts,
            names, and cases &mdash; and sanitized for training.
          </p>
          <div className="landing-actions">
            <Link href="/register" className="btn btn-primary">
              Request an account
            </Link>
            <Link href="/login" className="btn btn-ghost">
              Sign in
            </Link>
          </div>
        </section>

        <section>
          <h2>How a scenario works</h2>
          <ol className="landing-steps">
            <li>
              <span>
                <strong>Read the artifacts.</strong> Tool output, logs, email
                headers, memory and mobile extractions &mdash; the material a
                case actually arrives with.
              </span>
            </li>
            <li>
              <span>
                <strong>Decide what is supportable.</strong> Questions separate
                what the evidence proves from what it only suggests.
              </span>
            </li>
            <li>
              <span>
                <strong>Write the finding.</strong> Debriefs call out the
                over-claims a reviewer or opposing counsel will pick on.
              </span>
            </li>
          </ol>
        </section>

        <section>
          <h2>What&rsquo;s covered</h2>
          {LANE_SECTIONS.map((section) => (
            <div key={section.key} className="landing-lanes">
              <h3>{section.title}</h3>
              <dl>
                {section.laneSlugs.map((lane) => (
                  <div key={lane} className="landing-lane">
                    <dt>{LANE_LABELS[lane]}</dt>
                    <dd>
                      <InlineCode text={LANE_DESCRIPTIONS[lane]} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>

        <section>
          <h2>What this is &mdash; and isn&rsquo;t</h2>
          <ul className="landing-facts">
            <li>
              Unclassified. Scenarios use fabricated, sanitized artifacts; no
              real incident is reproduced.
            </li>
            <li>
              Independent and non-commercial: no subscriptions, ads, or
              paywalls. Maintained in a personal capacity.
            </li>
            <li>
              Not affiliated with or endorsed by the Department of Defense, the
              U.S. Army, or any other government agency.
            </li>
            <li>
              Not a credential. Completing scenarios certifies nothing; it
              complements unit training and supervised casework.
            </li>
          </ul>
          <p className="muted">
            Evaluating this site for a managed network? See the{" "}
            <Link href="/about#for-it-administrators">
              notes for IT administrators
            </Link>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
