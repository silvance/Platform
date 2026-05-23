import Link from "next/link";
import { requireAdmin, readToken } from "@/lib/session";
import { api } from "@/lib/api";
import {
  AdminScenarioListQuery,
  REVIEW_STATUS_LABELS,
} from "@ci-train/contracts";
import { ImportPackForm } from "./import-pack-form";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readSingle(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

// M21d: per-field safeParse so a single bad URL param doesn't
// wipe the rest of the filter set. Returns the salvaged query
// plus the dropped field names.
function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): { query: AdminScenarioListQuery; invalid: string[] } {
  const raw = {
    status: readSingle(sp["status"]),
    difficulty: readSingle(sp["difficulty"]),
    reviewStatus: readSingle(sp["reviewStatus"]),
    tag: readSingle(sp["tag"]),
    q: readSingle(sp["q"]),
  };
  const shape = AdminScenarioListQuery.shape;
  const query: Record<string, unknown> = {};
  const invalid: string[] = [];
  for (const key of Object.keys(raw) as Array<keyof typeof raw>) {
    const value = raw[key];
    if (value === undefined) continue;
    const r = shape[key].safeParse(value);
    if (r.success) {
      if (r.data !== undefined) query[key] = r.data;
    } else {
      invalid.push(key);
    }
  }
  return {
    query: query as AdminScenarioListQuery,
    invalid,
  };
}

export default async function AdminChallengesPage({ searchParams }: Props) {
  await requireAdmin();
  const token = await readToken();

  const sp = await searchParams;
  const { query, invalid } = parseFilters(sp);
  const { scenarios } = await api.authoring.list(token!, query);

  return (
    <main>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <h1>Challenges</h1>
        <Link href="/admin/challenges/new" className="admin-btn">
          New challenge
        </Link>
      </header>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Author and manage challenge content. Drafts are visible only to admins.
      </p>

      <details
        className="card"
        style={{ padding: ".75rem 1.25rem", marginBottom: ".75rem" }}
      >
        <summary style={{ cursor: "pointer", color: "var(--muted)" }}>
          Import scenario pack (.zip)
        </summary>
        <div style={{ marginTop: ".75rem" }}>
          <ImportPackForm />
        </div>
      </details>

      <FilterBar query={query} invalid={invalid} totalShown={scenarios.length} />

      {scenarios.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            No challenges match these filters.{" "}
            <Link href="/admin/challenges" style={{ color: "var(--accent)" }}>
              Clear filters
            </Link>{" "}
            or{" "}
            <Link href="/admin/challenges/new" style={{ color: "var(--accent)" }}>
              create one
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Difficulty</th>
                <th>Questions</th>
                <th>Review</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link
                      href={`/scenarios/${encodeURIComponent(s.slug)}`}
                      style={{ fontWeight: 600, color: "var(--fg)" }}
                    >
                      {s.title}
                    </Link>
                    <div>
                      <code style={{ color: "var(--muted)", fontSize: ".8rem" }}>
                        {s.slug}
                      </code>
                    </div>
                  </td>
                  <td>
                    <span className={`admin-status-${s.status}`}>{s.status}</span>
                  </td>
                  <td>{s.difficulty}/5</td>
                  <td>{s.questionCount}</td>
                  <td style={{ fontSize: ".82rem" }}>
                    <span className={chipClassFor(s.reviewStatus)}>
                      {REVIEW_STATUS_LABELS[s.reviewStatus]}
                    </span>
                  </td>
                  <td style={{ color: "var(--muted)", fontSize: ".8rem" }}>
                    {new Date(s.updatedAt).toLocaleDateString()}
                  </td>
                  <td>
                    <Link
                      href={`/scenarios/${encodeURIComponent(s.slug)}`}
                      style={{ color: "var(--accent)", marginRight: "1rem" }}
                    >
                      Solve →
                    </Link>
                    <Link
                      href={`/admin/challenges/${encodeURIComponent(s.slug)}/edit`}
                      style={{ color: "var(--accent)" }}
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function chipClassFor(
  status: import("@ci-train/contracts").ScenarioReviewStatus,
): string {
  if (status === "approved") return "chip chip-ok";
  if (status === "needs_review") return "chip chip-partial";
  return "chip chip-bad";
}

// GET-form filter bar. Each control is a regular form input
// inside a GET-method form, so submitting updates the URL and
// triggers a fresh server render — no client-side state, no
// hydration mismatches.
function FilterBar({
  query,
  invalid,
  totalShown,
}: {
  query: AdminScenarioListQuery;
  invalid: string[];
  totalShown: number;
}) {
  return (
    <form
      method="GET"
      action="/admin/challenges"
      className="card"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: ".75rem",
        alignItems: "end",
        marginBottom: ".75rem",
      }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
        <span className="field-label">Search</span>
        <input
          type="text"
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="title or slug"
          className="input"
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
        <span className="field-label">Status</span>
        <select name="status" defaultValue={query.status ?? ""} className="select">
          <option value="">Any</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
        <span className="field-label">Difficulty</span>
        <select
          name="difficulty"
          defaultValue={query.difficulty !== undefined ? String(query.difficulty) : ""}
          className="select"
        >
          <option value="">Any</option>
          <option value="1">1 / 5</option>
          <option value="2">2 / 5</option>
          <option value="3">3 / 5</option>
          <option value="4">4 / 5</option>
          <option value="5">5 / 5</option>
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
        <span className="field-label">Review</span>
        <select
          name="reviewStatus"
          defaultValue={query.reviewStatus ?? ""}
          className="select"
        >
          <option value="">Any</option>
          <option value="needs_review">Needs review</option>
          <option value="approved">Approved</option>
          <option value="needs_rewrite">Needs rewrite</option>
          <option value="too_generic">Too generic</option>
          <option value="unclear_question">Unclear question</option>
          <option value="answer_key_issue">Answer-key issue</option>
          <option value="debrief_issue">Debrief issue</option>
          <option value="retire_candidate">Retire / delete candidate</option>
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
        <span className="field-label">Tag</span>
        <input
          type="text"
          name="tag"
          defaultValue={query.tag ?? ""}
          placeholder="e.g. beginner"
          className="input"
        />
      </label>
      <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
        <button type="submit" className="btn btn-primary">Filter</button>
        <Link href="/admin/challenges" className="btn btn-ghost btn-sm">
          Clear
        </Link>
        <span style={{ color: "var(--muted)", fontSize: ".85rem", marginLeft: "auto" }}>
          {totalShown} shown
        </span>
      </div>
      {invalid.length > 0 ? (
        <div
          className="form-message error"
          style={{ gridColumn: "1 / -1" }}
          role="alert"
        >
          Ignored invalid filter{invalid.length === 1 ? "" : "s"}:{" "}
          {invalid.map((f) => (
            <code key={f} style={{ marginRight: ".5rem" }}>{f}</code>
          ))}
        </div>
      ) : null}
    </form>
  );
}
