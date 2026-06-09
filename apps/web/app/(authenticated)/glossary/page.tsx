import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Markdown } from "@/components/markdown";
import { LANE_LABELS, SKILL_AREA_LABELS } from "@ci-train/contracts";
import { GLOSSARY, type GlossaryTerm } from "@/content/glossary";

export const dynamic = "force-dynamic";

// Reference glossary page. Alphabetical listing of artifact / tool /
// discipline terms across the catalog, intended as a "what's this
// thing?" lookup surface for analysts hitting unfamiliar lanes.
//
// Each term has a sticky anchor, so external links (lane intros,
// scenario briefs) can deep-link to specific entries via
// /glossary#prefetch.
export default async function GlossaryPage() {
  await requireUser();

  const sorted = [...GLOSSARY].sort((a, b) =>
    a.term.toLowerCase().localeCompare(b.term.toLowerCase()),
  );

  // Group by first letter for the alphabet jump-bar.
  const byLetter = new Map<string, GlossaryTerm[]>();
  for (const t of sorted) {
    const letter = t.term[0]!.toUpperCase();
    const bucket = byLetter.get(letter);
    if (bucket) bucket.push(t);
    else byLetter.set(letter, [t]);
  }
  const letters = [...byLetter.keys()].sort();

  return (
    <main>
      <h1>Glossary</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Reference for artifacts, tools, and disciplines across the catalog.
        {" "}
        Useful when a lane references something unfamiliar mid-scenario.
      </p>

      <nav
        aria-label="Glossary index"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: ".5rem",
          margin: "1rem 0 1.5rem",
        }}
      >
        {letters.map((l) => (
          <a
            key={l}
            href={`#section-${l}`}
            className="chip"
            style={{ textDecoration: "none" }}
          >
            {l}
          </a>
        ))}
      </nav>

      {letters.map((letter) => (
        <section key={letter} style={{ marginBottom: "1.5rem" }}>
          <h2
            id={`section-${letter}`}
            style={{
              fontSize: "1.2rem",
              borderBottom: "1px solid var(--border)",
              paddingBottom: ".25rem",
              marginBottom: ".75rem",
              color: "var(--muted-strong)",
            }}
          >
            {letter}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: ".75rem",
            }}
          >
            {byLetter.get(letter)!.map((t) => (
              <TermCard key={t.id} term={t} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

function TermCard({ term }: { term: GlossaryTerm }) {
  return (
    <article
      id={term.id}
      className="card"
      style={{
        padding: ".85rem 1rem",
        scrollMarginTop: "70px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: ".5rem",
          marginBottom: ".25rem",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "1rem",
          }}
        >
          {term.term}
        </h3>
        {term.aliases && term.aliases.length > 0 ? (
          <span
            style={{
              color: "var(--muted)",
              fontSize: ".75rem",
              fontStyle: "italic",
            }}
          >
            also: {term.aliases.join(", ")}
          </span>
        ) : null}
      </div>
      <div style={{ fontSize: ".9rem" }}>
        <Markdown source={term.definition} noGlossary />
      </div>
      {(term.lanes && term.lanes.length > 0) ||
      (term.skillAreas && term.skillAreas.length > 0) ? (
        <div
          style={{
            marginTop: ".5rem",
            display: "flex",
            gap: ".3rem",
            flexWrap: "wrap",
          }}
        >
          {term.lanes?.map((l) => (
            <Link
              key={l}
              href={`/scenarios/lanes/${encodeURIComponent(l)}`}
              className="chip"
              style={{ textDecoration: "none", fontSize: ".7rem" }}
            >
              {LANE_LABELS[l]}
            </Link>
          ))}
          {term.skillAreas?.map((a) => (
            <span key={a} className="chip chip-skill" style={{ fontSize: ".7rem" }}>
              {SKILL_AREA_LABELS[a]}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
