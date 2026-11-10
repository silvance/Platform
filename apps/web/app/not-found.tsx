import Link from "next/link";

// Root-level 404. Served with a real 404 status, which is the
// correct signal for crawlers (Search Console treats a 404 for a
// URL that genuinely doesn't exist as resolved, not as an error
// to fix). Before this file existed, Next served its unbranded
// default 404 — functionally identical, but this one gives a lost
// human a way back in.
export const metadata = {
  title: "Page not found — CI Cyber Lab",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "4rem 1.25rem",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontSize: ".8rem",
          letterSpacing: ".12em",
          textTransform: "uppercase",
          opacity: 0.6,
          marginBottom: ".75rem",
        }}
      >
        404 — not found
      </p>
      <h1 style={{ marginBottom: ".75rem" }}>
        This page doesn&rsquo;t exist
      </h1>
      <p style={{ marginBottom: "2rem", opacity: 0.85 }}>
        The address may be mistyped, or the page may have moved. The
        scenario library and your progress are unaffected.
      </p>
      <p>
        <Link href="/" style={{ color: "var(--accent)" }}>
          ← Back to CI Cyber Lab
        </Link>
        {"  ·  "}
        <Link href="/scenarios" style={{ color: "var(--accent)" }}>
          Scenario library
        </Link>
      </p>
    </main>
  );
}
