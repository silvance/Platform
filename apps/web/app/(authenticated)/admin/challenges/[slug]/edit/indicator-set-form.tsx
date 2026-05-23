"use client";

import { useActionState, useState } from "react";
import type {
  AuthoredArtifact,
  AuthoredIndicatorSet,
} from "@ci-train/contracts";
import type { ActionResult } from "./actions";

interface Props {
  initial?: AuthoredIndicatorSet;
  artifacts: AuthoredArtifact[];
  action: (
    prev: ActionResult | undefined,
    fd: FormData,
  ) => Promise<ActionResult>;
  submitLabel: string;
}

interface ItemDraft {
  id: string;
  label: string;
  evidenceRef: string;
}

const EMPTY_ITEMS: ItemDraft[] = [
  { id: "", label: "", evidenceRef: "" },
  { id: "", label: "", evidenceRef: "" },
];

export function IndicatorSetForm({
  initial,
  artifacts,
  action,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  const [items, setItems] = useState<ItemDraft[]>(
    initial
      ? initial.items.map((i) => ({
          id: i.id,
          label: i.label,
          evidenceRef: i.evidenceRef ?? "",
        }))
      : EMPTY_ITEMS,
  );

  function setField(i: number, key: keyof ItemDraft, v: string) {
    setItems((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, [key]: v } : row)),
    );
  }
  function addRow() {
    setItems((p) => [...p, { id: "", label: "", evidenceRef: "" }]);
  }
  function removeRow(i: number) {
    if (items.length <= 2) return;
    setItems((p) => p.filter((_, idx) => idx !== i));
  }

  return (
    <form action={formAction} className="admin-form">
      {!initial ? (
        <label>
          Slug (URL-safe; unique per scenario)
          <input
            name="slug"
            type="text"
            required
            pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
            placeholder="e.g. bec-header-indicators"
            maxLength={120}
          />
        </label>
      ) : null}

      <label>
        Display name
        <input
          name="displayName"
          type="text"
          required
          maxLength={120}
          defaultValue={initial?.displayName ?? ""}
        />
      </label>

      <label>
        Source artifact (optional)
        <select
          name="sourceArtifactId"
          defaultValue={initial?.sourceArtifactId ?? ""}
        >
          <option value="">— none —</option>
          {artifacts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName}
            </option>
          ))}
        </select>
      </label>

      <fieldset
        style={{
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: ".55rem .85rem",
        }}
      >
        <legend style={{ color: "var(--muted)", fontSize: ".85rem" }}>
          Items (min 2)
        </legend>
        <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
          {items.map((row, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "10rem 1fr 10rem 2rem",
                gap: ".4rem",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                name="itemId"
                value={row.id}
                onChange={(e) => setField(i, "id", e.target.value)}
                placeholder="id (e.g. dkim-fail)"
                required
                pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
                maxLength={60}
              />
              <input
                type="text"
                name="itemLabel"
                value={row.label}
                onChange={(e) => setField(i, "label", e.target.value)}
                placeholder="label shown to user"
                required
                maxLength={400}
              />
              <input
                type="text"
                name="itemEvidenceRef"
                value={row.evidenceRef}
                onChange={(e) => setField(i, "evidenceRef", e.target.value)}
                placeholder="evidence ref (opt.)"
                maxLength={200}
              />
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => removeRow(i)}
                disabled={items.length <= 2}
                style={{ padding: ".25rem .55rem" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          onClick={addRow}
          style={{ marginTop: ".5rem" }}
        >
          + Add item
        </button>
      </fieldset>

      {state && !state.ok ? <p className="admin-error">{state.error}</p> : null}

      <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
        <button type="submit" className="admin-btn" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {state?.ok ? <span className="save-badge save-saved">saved</span> : null}
      </div>
    </form>
  );
}
