import { HelloResponse, HealthResponse } from "@ci-train/contracts";

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ?? "http://localhost:4000";

async function getJson<T>(path: string, schema: { parse: (v: unknown) => T }): Promise<T> {
  const url = `${API_INTERNAL_URL}/v1${path}`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API ${path} returned ${res.status} ${res.statusText}`);
  }
  const json: unknown = await res.json();
  return schema.parse(json);
}

export function fetchHello(): Promise<HelloResponse> {
  return getJson("/hello", HelloResponse);
}

export function fetchHealth(): Promise<HealthResponse> {
  return getJson("/healthz", HealthResponse);
}
