import { fetchHello } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let status: "ok" | "error" = "ok";
  let payload:
    | Awaited<ReturnType<typeof fetchHello>>
    | { message: string }
    | null = null;
  let error: string | null = null;

  try {
    payload = await fetchHello();
  } catch (err) {
    status = "error";
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <main>
      <h1>ci-train</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Milestone 0 — repo bootstrap and end-to-end wiring check.
      </p>

      <h2>API hello</h2>
      <div className="card">
        {status === "ok" && payload && "from" in payload ? (
          <dl className="kv">
            <dt>status</dt>
            <dd className="tag-ok">reachable</dd>
            <dt>message</dt>
            <dd>{payload.message}</dd>
            <dt>from</dt>
            <dd>{payload.from}</dd>
            <dt>apiVersion</dt>
            <dd>{payload.apiVersion}</dd>
            <dt>timestamp</dt>
            <dd>{payload.timestamp}</dd>
          </dl>
        ) : (
          <dl className="kv">
            <dt>status</dt>
            <dd className="tag-bad">unreachable</dd>
            <dt>error</dt>
            <dd>{error}</dd>
          </dl>
        )}
      </div>

      <footer>
        web → api call made server-side. See <code>apps/web/lib/api.ts</code>.
      </footer>
    </main>
  );
}
