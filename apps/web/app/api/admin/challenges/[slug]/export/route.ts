import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";
import { readToken, getCurrentUser } from "@/lib/session";

// BFF passthrough for the pack export. The browser hits this Next.js
// route handler with the session cookie; we forward to the API with
// the bearer token. The browser never sees the API directly (CORS
// is disabled by design).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const token = await readToken();
  if (!token) return new NextResponse("Unauthorized", { status: 401 });

  const { slug } = await params;
  try {
    const { filename, bytes } = await api.authoring.exportPack(token, slug);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${filename}"`,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return new NextResponse(err.message, { status: err.status });
    }
    return new NextResponse("Export failed", { status: 500 });
  }
}
