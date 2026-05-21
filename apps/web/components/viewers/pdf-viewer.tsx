import type { ArtifactListItem } from "@ci-train/contracts";

interface Props {
  artifact: ArtifactListItem;
  proxyUrl: string;
}

// Browser-native PDF rendering inside a sandboxed iframe. The sandbox
// attribute is empty on purpose: no scripts, no top-level navigation,
// no form submission, no popups. PDF.js (which would let us highlight
// regions, etc.) is a possible later upgrade — M3 keeps it simple.
export function PdfViewer({ artifact, proxyUrl }: Props) {
  return (
    <div className="artifact-pdf">
      <iframe
        src={proxyUrl}
        title={artifact.displayName}
        sandbox=""
        style={{ width: "100%", height: "78vh", border: "1px solid #1f2845", borderRadius: 6, background: "#0b1020" }}
      />
      <p style={{ color: "var(--muted)", fontSize: ".85rem", marginTop: ".5rem" }}>
        {artifact.displayName} · {artifact.mimeType} · {formatBytes(artifact.sizeBytes)}
      </p>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
