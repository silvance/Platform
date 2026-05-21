import type { ArtifactListItem } from "@ci-train/contracts";
import { fetchArtifactText } from "./fetch-bytes";
import { ViewerError } from "./viewer-shell";

interface Props {
  artifact: ArtifactListItem;
  scenarioSlug: string;
  token: string;
}

export async function TextViewer({ artifact, scenarioSlug, token }: Props) {
  const { text, error } = await fetchArtifactText(scenarioSlug, artifact, token);
  if (error || text === null) {
    return <ViewerError message={error ?? "Could not load artifact."} />;
  }
  return (
    <pre className="artifact-text">
      {text}
    </pre>
  );
}
