import "server-only";
import type { ArtifactListItem } from "@ci-train/contracts";

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ?? "http://localhost:4000";

// Server-side helper for text/CSV/JSON viewers. We fetch the artifact
// bytes directly from the internal API (Node-side) rather than via the
// proxy route — it's the same auth, fewer hops.
//
// Hard cap protects renderers from absurd payloads even if the API
// somehow served one. 5 MB is well above any sane brief/log/json
// artifact and below "render lockup" territory.
const MAX_TEXTLIKE_RENDER_BYTES = 5 * 1024 * 1024;

export interface ArtifactBytes {
  text: string | null;
  truncated: boolean;
  error: string | null;
}

export async function fetchArtifactText(
  scenarioSlug: string,
  artifact: ArtifactListItem,
  token: string,
): Promise<ArtifactBytes> {
  if (artifact.sizeBytes > MAX_TEXTLIKE_RENDER_BYTES) {
    return {
      text: null,
      truncated: true,
      error: `Artifact is ${(artifact.sizeBytes / 1024 / 1024).toFixed(1)} MB; over the ${MAX_TEXTLIKE_RENDER_BYTES / 1024 / 1024} MB render limit.`,
    };
  }

  const url =
    `${API_INTERNAL_URL}/v1/scenarios/${encodeURIComponent(scenarioSlug)}` +
    `/artifacts/${encodeURIComponent(artifact.id)}/content`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "*/*" },
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      text: null,
      truncated: false,
      error: `API returned ${res.status} ${res.statusText}.`,
    };
  }
  const text = await res.text();
  return { text, truncated: false, error: null };
}
