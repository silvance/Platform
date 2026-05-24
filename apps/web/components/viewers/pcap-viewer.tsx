import type { ArtifactListItem } from "@ci-train/contracts";

interface Props {
  artifact: ArtifactListItem;
  proxyUrl: string;
}

// PCAP files are download-only. We never try to render
// packet contents inline — opening in Wireshark / tshark /
// tcpdump is the analyst's job. The card shows file metadata,
// a download link, and a one-line nudge about the expected
// tooling. A companion text artefact (when one is present in
// the scenario) carries the human-readable summary so the
// challenge stays solvable without leaving the browser.
export function PcapViewer({ artifact, proxyUrl }: Props) {
  return (
    <div
      className="card"
      style={{
        padding: "1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: ".4rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: ".5rem",
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: ".95rem" }}>{artifact.displayName}</strong>
        <span className="chip" style={{ fontSize: ".7rem" }}>pcap</span>
        <span style={{ color: "var(--muted)", fontSize: ".82rem" }}>
          {artifact.mimeType} · {formatBytes(artifact.sizeBytes)}
        </span>
      </div>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: ".88rem" }}>
        Packet-capture artefact. Download and open in Wireshark, tshark,
        or tcpdump. A text summary alongside this artefact (if present)
        carries the same information for browser-only triage.
      </p>
      <div>
        <a
          href={proxyUrl}
          download={artifact.displayName}
          className="btn btn-primary btn-sm"
          style={{ textDecoration: "none" }}
        >
          Download {artifact.displayName}
        </a>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
