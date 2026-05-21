import type { ArtifactListItem } from "@ci-train/contracts";
import { fetchArtifactText } from "./fetch-bytes";
import { ViewerError } from "./viewer-shell";

interface Props {
  artifact: ArtifactListItem;
  scenarioSlug: string;
  token: string;
}

// Minimal CSV parser. Real-world CSV has edge cases (quoted commas,
// embedded newlines, escaped quotes) that go beyond what a viewer
// should bake in — when imports start handling user-uploaded CSV, we
// should switch to a library. For seed data in M3 this is enough.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (field !== "" || row.length > 0) {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      }
      // Swallow \r\n as a single newline.
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const MAX_RENDERED_ROWS = 1000;

export async function CsvViewer({ artifact, scenarioSlug, token }: Props) {
  const { text, error } = await fetchArtifactText(scenarioSlug, artifact, token);
  if (error || text === null) {
    return <ViewerError message={error ?? "Could not load artifact."} />;
  }
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return <p style={{ color: "var(--muted)" }}>Empty CSV file.</p>;
  }
  const truncated = rows.length > MAX_RENDERED_ROWS;
  const visible = truncated ? rows.slice(0, MAX_RENDERED_ROWS) : rows;
  const [header, ...body] = visible;

  return (
    <div className="artifact-csv">
      <table>
        <thead>
          <tr>
            {(header ?? []).map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {truncated ? (
        <p style={{ color: "var(--muted)", fontSize: ".85rem", marginTop: ".5rem" }}>
          Showing first {MAX_RENDERED_ROWS.toLocaleString()} of {rows.length.toLocaleString()} rows.
        </p>
      ) : null}
    </div>
  );
}
