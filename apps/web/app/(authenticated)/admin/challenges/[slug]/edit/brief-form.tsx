"use client";

import { useActionState } from "react";
import type { ScenarioBriefDraft } from "@ci-train/contracts";
import type { ActionResult } from "./actions";

interface Props {
  brief: ScenarioBriefDraft | null;
  action: (
    prev: ActionResult | undefined,
    fd: FormData,
  ) => Promise<ActionResult>;
}

export function BriefForm({ brief, action }: Props) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);
  return (
    <form action={formAction} className="admin-form">
      <label>
        Brief markdown
        <textarea
          name="markdownBody"
          required
          rows={14}
          defaultValue={brief?.markdownBody ?? ""}
        />
      </label>
      <label>
        Awareness disclaimer (optional — rendered above the brief)
        <textarea
          name="disclaimerMd"
          rows={4}
          defaultValue={brief?.disclaimerMd ?? ""}
          placeholder="Leave blank unless the scenario is in an awareness-only skill area."
        />
      </label>
      {state && !state.ok ? <p className="admin-error">{state.error}</p> : null}
      <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
        <button type="submit" className="admin-btn" disabled={pending}>
          {pending ? "Saving…" : "Save brief"}
        </button>
        {state?.ok ? <span className="save-badge save-saved">saved</span> : null}
      </div>
    </form>
  );
}
