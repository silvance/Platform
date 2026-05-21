import type { ArtifactListItem } from "@ci-train/contracts";

interface Props {
  artifact: ArtifactListItem;
  proxyUrl: string;
}

export function ImageViewer({ artifact, proxyUrl }: Props) {
  return (
    <div className="artifact-image">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxyUrl}
        alt={artifact.displayName}
        style={{
          maxWidth: "100%",
          maxHeight: "78vh",
          border: "1px solid #1f2845",
          borderRadius: 6,
          background: "#0b1020",
        }}
      />
      <p style={{ color: "var(--muted)", fontSize: ".85rem", marginTop: ".5rem" }}>
        {artifact.displayName} · {artifact.mimeType}
      </p>
    </div>
  );
}
