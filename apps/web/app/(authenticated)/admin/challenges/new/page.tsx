import Link from "next/link";
import { requireInstructor } from "@/lib/session";
import { SkillArea } from "@ci-train/contracts";
import { CreateScenarioForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewChallengePage() {
  await requireInstructor();
  const skillAreas = SkillArea.options;

  return (
    <main>
      <p style={{ marginBottom: ".5rem" }}>
        <Link href="/admin/challenges" style={{ color: "var(--accent)" }}>
          ← Challenges
        </Link>
      </p>
      <h1>New challenge</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Starts as a draft. Use the editor on the next page to add questions and
        flip status to <code>published</code>.
      </p>

      <CreateScenarioForm skillAreas={skillAreas} />
    </main>
  );
}
