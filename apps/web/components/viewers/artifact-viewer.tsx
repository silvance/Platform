import type { ArtifactListItem } from "@ci-train/contracts";
import { TextViewer } from "./text-viewer";
import { CsvViewer } from "./csv-viewer";
import { JsonViewer } from "./json-viewer";
import { PdfViewer } from "./pdf-viewer";
import { ImageViewer } from "./image-viewer";
import { EmlViewer } from "./eml-viewer";

interface Props {
  scenarioSlug: string;
  artifact: ArtifactListItem;
  token: string;
}

// Dispatches to a per-kind viewer based on the artifact's declared kind.
// All viewers fetch through the authenticated web proxy, so the API
// bearer token never reaches the browser.
export async function ArtifactViewer({ scenarioSlug, artifact, token }: Props) {
  const proxyUrl = `/scenarios/${encodeURIComponent(scenarioSlug)}/artifacts/${encodeURIComponent(artifact.id)}/raw`;

  switch (artifact.kind) {
    case "text":
      return <TextViewer artifact={artifact} scenarioSlug={scenarioSlug} token={token} />;
    case "csv":
      return <CsvViewer artifact={artifact} scenarioSlug={scenarioSlug} token={token} />;
    case "json":
      return <JsonViewer artifact={artifact} scenarioSlug={scenarioSlug} token={token} />;
    case "pdf":
      return <PdfViewer artifact={artifact} proxyUrl={proxyUrl} />;
    case "image":
      return <ImageViewer artifact={artifact} proxyUrl={proxyUrl} />;
    case "eml":
      return <EmlViewer artifact={artifact} scenarioSlug={scenarioSlug} token={token} />;
    default:
      return (
        <div className="card">
          <p style={{ margin: 0 }}>No viewer registered for artifact kind <code>{artifact.kind}</code>.</p>
        </div>
      );
  }
}
