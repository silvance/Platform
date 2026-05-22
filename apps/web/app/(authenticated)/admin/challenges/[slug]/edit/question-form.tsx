"use client";

import { useActionState, useMemo, useState } from "react";
import type { AuthoredIndicatorSet, AuthoredQuestion } from "@ci-train/contracts";
import type { ActionResult } from "./actions";

type QuestionType = "multi_choice" | "confidence" | "text_match" | "select_indicators";

interface Props {
  initial?: Extract<
    AuthoredQuestion,
    { type: "multi_choice" | "confidence" | "text_match" | "select_indicators" }
  >;
  // Indicator sets on the parent scenario, used to render the
  // select_indicators picker. Empty list disables the type option.
  indicatorSets: AuthoredIndicatorSet[];
  // Server action that takes (prevState, formData) — bound to the
  // scenario slug (+ question id, for edit) by the caller.
  action: (
    prev: ActionResult | undefined,
    fd: FormData,
  ) => Promise<ActionResult>;
  submitLabel: string;
}

const TYPES: { value: QuestionType; label: string }[] = [
  { value: "multi_choice", label: "Multiple choice" },
  { value: "confidence", label: "Confidence (1–5)" },
  { value: "text_match", label: "Text match" },
  { value: "select_indicators", label: "Select indicators" },
];

const DEFAULT_MC_OPTIONS = ["", "", "", ""];

export function QuestionForm({
  initial,
  indicatorSets,
  action,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);
  const [type, setType] = useState<QuestionType>(initial?.type ?? "multi_choice");

  // For select_indicators: which set, and which item ids are correct.
  // Default to the question's stored set, otherwise the first available.
  const [siSetId, setSiSetId] = useState<string>(
    initial?.type === "select_indicators"
      ? initial.indicatorSetId
      : indicatorSets[0]?.id ?? "",
  );
  const initialSiCorrect =
    initial?.type === "select_indicators" ? new Set(initial.correctIds) : new Set<string>();
  const [siCorrectIds, setSiCorrectIds] = useState<Set<string>>(initialSiCorrect);
  const siActiveSet = useMemo(
    () => indicatorSets.find((s) => s.id === siSetId) ?? null,
    [indicatorSets, siSetId],
  );

  function toggleSiCorrect(id: string) {
    setSiCorrectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // MC option editor lives in local state so the admin can add/remove
  // rows without round-tripping. Server action reads `optionLabel[]` +
  // `correctIndex[]` from the FormData on submit.
  const initialMcOptions = initial?.type === "multi_choice" ? initial.options : null;
  const initialCorrectIds =
    initial?.type === "multi_choice" ? new Set(initial.correctIds) : new Set<string>();
  const [mcLabels, setMcLabels] = useState<string[]>(
    initialMcOptions ? initialMcOptions.map((o) => o.label) : DEFAULT_MC_OPTIONS,
  );
  const [mcChecked, setMcChecked] = useState<boolean[]>(
    initialMcOptions
      ? initialMcOptions.map((o) => initialCorrectIds.has(o.id))
      : DEFAULT_MC_OPTIONS.map(() => false),
  );

  function setLabel(i: number, v: string) {
    setMcLabels((prev) => prev.map((l, idx) => (idx === i ? v : l)));
  }
  function setChecked(i: number, v: boolean) {
    setMcChecked((prev) => prev.map((c, idx) => (idx === i ? v : c)));
  }
  function addOption() {
    setMcLabels((p) => [...p, ""]);
    setMcChecked((p) => [...p, false]);
  }
  function removeOption(i: number) {
    if (mcLabels.length <= 2) return;
    setMcLabels((p) => p.filter((_, idx) => idx !== i));
    setMcChecked((p) => p.filter((_, idx) => idx !== i));
  }

  return (
    <form action={formAction} className="admin-form">
      <label>
        Question type
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as QuestionType)}
          disabled={Boolean(initial)}
        >
          {TYPES.map((t) => (
            <option
              key={t.value}
              value={t.value}
              disabled={t.value === "select_indicators" && indicatorSets.length === 0}
            >
              {t.label}
              {t.value === "select_indicators" && indicatorSets.length === 0
                ? " (create an indicator set first)"
                : ""}
            </option>
          ))}
        </select>
      </label>

      <label>
        Prompt (markdown)
        <textarea
          name="promptMd"
          required
          rows={4}
          defaultValue={initial?.promptMd ?? ""}
        />
      </label>

      <div className="admin-form-row">
        <label>
          Weight
          <input
            name="weight"
            type="number"
            min={1}
            max={10}
            defaultValue={initial?.weight ?? 1}
          />
        </label>
      </div>

      {type === "multi_choice" ? (
        <fieldset
          style={{
            border: "1px solid #1f2845",
            borderRadius: 6,
            padding: ".55rem .85rem",
          }}
        >
          <legend style={{ color: "var(--muted)", fontSize: ".85rem" }}>
            Options (check the correct one(s))
          </legend>
          <label style={{ flexDirection: "row", alignItems: "center", gap: ".4rem" }}>
            <input
              type="checkbox"
              name="allowMultiple"
              defaultChecked={initial?.type === "multi_choice" ? initial.allowMultiple : false}
            />
            Allow multiple correct answers
          </label>
          <div style={{ marginTop: ".5rem", display: "flex", flexDirection: "column", gap: ".4rem" }}>
            {mcLabels.map((label, i) => (
              <div key={i} style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
                <input
                  type="checkbox"
                  name="correctIndex"
                  value={i}
                  checked={mcChecked[i] ?? false}
                  onChange={(e) => setChecked(i, e.target.checked)}
                />
                <input
                  type="text"
                  name="optionLabel"
                  value={label}
                  onChange={(e) => setLabel(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  required
                />
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  onClick={() => removeOption(i)}
                  disabled={mcLabels.length <= 2}
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
            onClick={addOption}
            style={{ marginTop: ".5rem" }}
          >
            + Add option
          </button>
        </fieldset>
      ) : null}

      {type === "confidence" ? (
        <div className="admin-form-row">
          <label>
            Expected range — low (1–5)
            <input
              name="expectedLo"
              type="number"
              min={1}
              max={5}
              defaultValue={initial?.type === "confidence" ? initial.expectedRange[0] : 3}
            />
          </label>
          <label>
            Expected range — high (1–5)
            <input
              name="expectedHi"
              type="number"
              min={1}
              max={5}
              defaultValue={initial?.type === "confidence" ? initial.expectedRange[1] : 5}
            />
          </label>
        </div>
      ) : null}

      {type === "text_match" ? (
        <>
          <label>
            Acceptable answers (one per line)
            <textarea
              name="acceptableAnswers"
              required
              rows={4}
              defaultValue={
                initial?.type === "text_match"
                  ? initial.acceptableAnswers.join("\n")
                  : ""
              }
              placeholder={"vendor-lookup-alike.com\nvendor-lookup-alike"}
            />
          </label>
          <div className="checkboxes">
            <label>
              <input
                type="checkbox"
                name="caseSensitive"
                defaultChecked={initial?.type === "text_match" ? initial.caseSensitive : false}
              />
              Case-sensitive
            </label>
            <label>
              <input
                type="checkbox"
                name="normalizeWhitespace"
                defaultChecked={initial?.type === "text_match" ? initial.normalizeWhitespace : true}
              />
              Collapse whitespace
            </label>
            <label>
              <input
                type="checkbox"
                name="regex"
                defaultChecked={initial?.type === "text_match" ? initial.regex : false}
              />
              Match as regex
            </label>
          </div>
          <label>
            Hint (optional, shown after N wrong tries)
            <input
              name="hint"
              type="text"
              defaultValue={initial?.type === "text_match" ? initial.hint ?? "" : ""}
            />
          </label>
          <label>
            Hint after how many tries
            <input
              name="hintAfterTries"
              type="number"
              min={1}
              max={10}
              defaultValue={initial?.type === "text_match" ? initial.hintAfterTries : 3}
            />
          </label>
        </>
      ) : null}

      {type === "select_indicators" ? (
        <fieldset
          style={{
            border: "1px solid #1f2845",
            borderRadius: 6,
            padding: ".55rem .85rem",
          }}
        >
          <legend style={{ color: "var(--muted)", fontSize: ".85rem" }}>
            Indicator set + correct items
          </legend>
          <label>
            Indicator set
            <select
              name="indicatorSetId"
              value={siSetId}
              onChange={(e) => {
                setSiSetId(e.target.value);
                // Clear correct ids when switching sets — they live in
                // different namespaces.
                setSiCorrectIds(new Set());
              }}
              required
            >
              {indicatorSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}
                </option>
              ))}
            </select>
          </label>
          {siActiveSet ? (
            <div
              style={{
                marginTop: ".5rem",
                display: "flex",
                flexDirection: "column",
                gap: ".25rem",
              }}
            >
              <div style={{ color: "var(--muted)", fontSize: ".85rem" }}>
                Check every item that's a correct selection.
              </div>
              {siActiveSet.items.map((item) => (
                <label
                  key={item.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: ".4rem",
                    color: "var(--fg)",
                  }}
                >
                  <input
                    type="checkbox"
                    name="siCorrectId"
                    value={item.id}
                    checked={siCorrectIds.has(item.id)}
                    onChange={() => toggleSiCorrect(item.id)}
                  />
                  <span>
                    <code style={{ fontSize: ".8rem", color: "var(--muted)" }}>
                      {item.id}
                    </code>{" "}
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          ) : null}
        </fieldset>
      ) : null}

      <label>
        Debrief (markdown shown after a correct submission)
        <textarea
          name="debriefMd"
          required
          rows={6}
          defaultValue={initial?.debriefMd ?? ""}
        />
      </label>

      {state && !state.ok ? <p className="admin-error">{state.error}</p> : null}

      <div style={{ display: "flex", gap: ".5rem" }}>
        <button type="submit" className="admin-btn" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {state?.ok ? (
          <span className="save-badge save-saved" style={{ alignSelf: "center" }}>
            saved
          </span>
        ) : null}
      </div>
    </form>
  );
}
