import Link from "next/link";

// Read once at module init. SUPPORT_URL is opt-in: when unset, the
// "Support hosting costs" link doesn't render at all. The variable
// is consumed server-side only — it never reaches the browser as
// part of a client bundle.
const SUPPORT_URL = process.env.SUPPORT_URL?.trim() || null;

export function SiteFooter() {
  return (
    <footer
      style={{
        marginTop: "3rem",
        padding: "1.25rem 1rem 1.5rem",
        borderTop: "1px solid var(--border)",
        color: "var(--muted)",
        fontSize: ".82rem",
        display: "flex",
        gap: "1rem",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span>
        © {new Date().getFullYear()} CICyberLab. Fictional, sanitized
        examples for training only.
      </span>
      <span aria-hidden style={{ opacity: 0.5 }}>·</span>
      <Link href="/about" style={{ color: "var(--muted)" }}>
        About
      </Link>
      {SUPPORT_URL ? (
        <>
          <span aria-hidden style={{ opacity: 0.5 }}>·</span>
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--muted)" }}
          >
            Support hosting costs
          </a>
        </>
      ) : null}
    </footer>
  );
}
