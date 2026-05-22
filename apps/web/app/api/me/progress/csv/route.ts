import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";
import { getCurrentUser, readToken } from "@/lib/session";

// BFF passthrough: pulls /v1/me/progress and renders it as a CSV with
// a stable header. Done server-side so the API token never leaves the
// HttpOnly cookie boundary.
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const token = await readToken();
  if (!token) return new NextResponse("Unauthorized", { status: 401 });

  let rows;
  try {
    rows = (await api.progress.me(token)).rows;
  } catch (err) {
    if (err instanceof ApiError) {
      return new NextResponse(err.message, { status: err.status });
    }
    return new NextResponse("Export failed", { status: 500 });
  }

  const header = [
    "scenario_slug",
    "scenario_title",
    "scenario_status",
    "started_at",
    "completed_at",
    "completed_questions",
    "total_questions",
  ].join(",");
  const body = rows
    .map((r) =>
      [
        csvField(r.scenarioSlug),
        csvField(r.scenarioTitle),
        csvField(r.scenarioStatus),
        csvField(r.startedAt),
        csvField(r.completedAt ?? ""),
        String(r.completedQuestions),
        String(r.totalQuestions),
      ].join(","),
    )
    .join("\n");
  const csv = header + "\n" + body + "\n";

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ci-train-progress-${stamp}.csv"`,
      "x-content-type-options": "nosniff",
    },
  });
}

function csvField(s: string): string {
  // RFC 4180: fields containing commas, quotes, or newlines are
  // wrapped in quotes; internal quotes are doubled.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
