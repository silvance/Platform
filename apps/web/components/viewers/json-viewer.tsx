import type { ArtifactListItem } from "@ci-train/contracts";
import { fetchArtifactText } from "./fetch-bytes";
import { ViewerError } from "./viewer-shell";

interface Props {
  artifact: ArtifactListItem;
  scenarioSlug: string;
  token: string;
}

export async function JsonViewer({ artifact, scenarioSlug, token }: Props) {
  const { text, error } = await fetchArtifactText(scenarioSlug, artifact, token);
  if (error || text === null) {
    return <ViewerError message={error ?? "Could not load artifact."} />;
  }
  let pretty: string;
  let invalid = false;
  try {
    pretty = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    pretty = text;
    invalid = true;
  }
  return (
    <>
      {invalid ? (
        <p
          style={{
            color: "#f0d68a",
            fontSize: ".85rem",
            margin: "0 0 .5rem",
          }}
        >
          File is not valid JSON — displaying as text.
        </p>
      ) : null}
      <pre className="artifact-text">{pretty}</pre>
    </>
  );
}
