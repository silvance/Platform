import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser, readToken } from "@/lib/session";
import { api, ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CohortProgressPage({ params }: Props) {
  const user = await requireUser();
  if (user.role !== "instructor") {
    // Trainees don't get to see the cohort view.
    redirect(`/scenarios/${(await params).slug}`);
  }
  const token = await readToken();
  const { slug } = await params;

  let cohort;
  try {
    cohort = await api.progress.cohort(token!, slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <main>
      <div style={{ fontSize: ".9rem", marginBottom: ".5rem" }}>
        <Link href={`/scenarios/${slug}`} style={{ color: "var(--accent)" }}>
          ← Back to scenario
        </Link>
      </div>
      <h1>Cohort progress — {cohort.scenarioTitle}</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        {cohort.trainees.length} trainee
        {cohort.trainees.length === 1 ? "" : "s"} have started this scenario.
      </p>

      {cohort.trainees.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: "var(--muted)" }}>
            No trainee has submitted an answer for this scenario yet.
          </p>
        </div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="artifact-csv">
            <thead>
              <tr>
                <th>Trainee</th>
                <th>Email</th>
                <th>Started</th>
                <th>Progress</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {cohort.trainees.map((t) => {
                const pct =
                  t.totalQuestions === 0
                    ? 0
                    : Math.round((t.completedQuestions / t.totalQuestions) * 100);
                return (
                  <tr key={t.traineeId}>
                    <td>{t.traineeDisplayName}</td>
                    <td>
                      <code style={{ fontSize: ".85rem" }}>{t.traineeEmail}</code>
                    </td>
                    <td>{t.startedAt ? new Date(t.startedAt).toLocaleString() : "—"}</td>
                    <td>
                      {t.completedQuestions} / {t.totalQuestions} ({pct}%)
                    </td>
                    <td>
                      {t.completedAt ? (
                        <span className="chip chip-ok">
                          {new Date(t.completedAt).toLocaleString()}
                        </span>
                      ) : (
                        <span className="chip">in progress</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
