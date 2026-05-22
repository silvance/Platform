import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";
import { getCurrentUser, readToken } from "@/lib/session";

// BFF passthrough for the JSON download. Streams the API's
// MeProgressResponse straight to the browser as a downloadable file.
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const token = await readToken();
  if (!token) return new NextResponse("Unauthorized", { status: 401 });

  let payload;
  try {
    payload = await api.progress.me(token);
  } catch (err) {
    if (err instanceof ApiError) {
      return new NextResponse(err.message, { status: err.status });
    }
    return new NextResponse("Export failed", { status: 500 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="ci-train-progress-${stamp}.json"`,
      "x-content-type-options": "nosniff",
    },
  });
}
