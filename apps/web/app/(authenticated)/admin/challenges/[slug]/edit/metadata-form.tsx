"use client";

import { useActionState } from "react";
import type { AdminScenarioDetail } from "@ci-train/contracts";
import type { ActionResult } from "./actions";

interface Props {
  scenario: AdminScenarioDetail;
  skillAreas: readonly string[];
  action: (
    prev: ActionResult | undefined,
    fd: FormData,
  ) => Promise<ActionResult>;
}

export function MetadataForm({ scenario, skillAreas, action }: Props) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);
  const selected = new Set(scenario.skillAreas);

  return (
    <form action={formAction} className="admin-form">
      <label>
        Title
        <input
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={scenario.title}
        />
      </label>
      <label>
        Summary
        <textarea
          name="summary"
          required
          maxLength={1000}
          rows={3}
          defaultValue={scenario.summary}
          style={{ minHeight: "4rem" }}
        />
      </label>
      <div className="admin-form-row">
        <label>
          Difficulty (1–5)
          <input
            name="difficulty"
            type="number"
            min={1}
            max={5}
            required
            defaultValue={scenario.difficulty}
          />
        </label>
        <label>
          Estimated minutes
          <input
            name="estimatedMinutes"
            type="number"
            min={1}
            max={600}
            defaultValue={scenario.estimatedMinutes ?? ""}
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={scenario.status}>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </label>
      </div>
      <label>
        Tags (comma-separated)
        <input
          name="tags"
          type="text"
          defaultValue={scenario.tags.join(", ")}
          placeholder="e.g. bec, phishing, finance"
        />
      </label>
      <fieldset
        style={{
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: ".55rem .85rem",
        }}
      >
        <legend style={{ color: "var(--muted)", fontSize: ".85rem" }}>
          Skill areas
        </legend>
        <div className="checkboxes">
          {skillAreas.map((a) => (
            <label key={a}>
              <input
                type="checkbox"
                name="skillArea"
                value={a}
                defaultChecked={selected.has(a as never)}
              />
              <code>{a}</code>
            </label>
          ))}
        </div>
      </fieldset>

      {state && !state.ok ? <p className="admin-error">{state.error}</p> : null}

      <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
        <button type="submit" className="admin-btn" disabled={pending}>
          {pending ? "Saving…" : "Save metadata"}
        </button>
        {state?.ok ? <span className="save-badge save-saved">saved</span> : null}
      </div>
    </form>
  );
}
