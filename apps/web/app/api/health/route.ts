import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    service: "cicyberlab-web",
    timestamp: new Date().toISOString(),
  });
}
