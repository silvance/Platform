"use client";

import { useActionState } from "react";
import { SKILL_AREA_LABELS, type SkillArea } from "@ci-train/contracts";
import { createScenarioAction, type CreateScenarioState } from "./actions";

export function CreateScenarioForm({ skillAreas }: { skillAreas: readonly string[] }) {
  const [state, action, pending] = useActionState<
    CreateScenarioState | undefined,
    FormData
  >(createScenarioAction, undefined);

  return (
    <form action={action} className="admin-form">
      <label>
        Slug (URL fragment — lowercase, hyphens)
        <input
          name="slug"
          type="text"
          required
          maxLength={120}
          pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
          placeholder="e.g. bec-vendor-redirect-002"
        />
      </label>

      <label>
        Title
        <input name="title" type="text" required maxLength={200} />
      </label>

      <label>
        Summary (one-line catalog blurb)
        <textarea
          name="summary"
          required
          maxLength={1000}
          rows={3}
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
            defaultValue={2}
          />
        </label>
        <label>
          Estimated minutes (optional)
          <input
            name="estimatedMinutes"
            type="number"
            min={1}
            max={600}
            placeholder="e.g. 30"
          />
        </label>
      </div>

      <fieldset
        style={{
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: ".55rem .85rem",
        }}
      >
        <legend style={{ color: "var(--muted)", fontSize: ".85rem" }}>
          Skill areas (pick at least one)
        </legend>
        <div className="checkboxes">
          {skillAreas.map((a) => (
            <label key={a}>
              <input type="checkbox" name="skillArea" value={a} />
              {SKILL_AREA_LABELS[a as SkillArea]}
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        Brief (markdown shown to users in the workspace)
        <textarea
          name="briefMd"
          required
          maxLength={100_000}
          rows={10}
          placeholder="# Brief&#10;&#10;Describe the scenario, what artifacts are in scope, and what reasoning skills are being trained."
        />
      </label>

      {state && !state.ok ? (
        <p className="admin-error">{state.error}</p>
      ) : null}

      <div style={{ display: "flex", gap: ".5rem" }}>
        <button type="submit" className="admin-btn" disabled={pending}>
          {pending ? "Creating…" : "Create draft"}
        </button>
      </div>
    </form>
  );
}
