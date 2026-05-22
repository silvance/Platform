"use client";

import { useState, useTransition } from "react";
import type { QuestionPayload, QuestionResponse } from "@ci-train/contracts";

interface Props {
  question: QuestionPayload;
  initialSelectedIds: string[];
  disabled: boolean;
  onSubmit: (response: QuestionResponse) => void | Promise<void>;
}

export function SelectIndicatorsForm({
  question,
  initialSelectedIds,
  disabled,
  onSubmit,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds));
  const [pending, start] = useTransition();
  const set = question.indicatorSet;

  function toggle(id: string) {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function submit() {
    if (disabled || pending) return;
    const body: QuestionResponse = {
      type: "select_indicators",
      data: { selectedIds: [...selected] },
    };
    start(() => Promise.resolve(onSubmit(body)));
  }

  if (!set) {
    return (
      <div className="card">
        <p style={{ margin: 0, color: "var(--muted)" }}>
          <em>This question's indicator set is not authored yet.</em>
        </p>
      </div>
    );
  }

  return (
    <div className="q-widget q-indicators">
      <div className="indicator-set-name">
        <strong>{set.displayName}</strong>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: ".25rem 0" }}>
        {set.items.map((item) => {
          const checked = selected.has(item.id);
          return (
            <li key={item.id} style={{ margin: ".3rem 0" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: ".5rem",
                  cursor: disabled ? "default" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(item.id)}
                  disabled={disabled}
                />
                <span>
                  {item.label}
                  {item.evidenceRef ? (
                    <span style={{ color: "var(--muted)", fontSize: ".75rem", marginLeft: ".4rem" }}>
                      ({item.evidenceRef})
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={disabled || pending || selected.size === 0}
        onClick={submit}
        className="q-submit"
      >
        {pending ? "Submitting…" : disabled ? "Submitted" : "Submit"}
      </button>
    </div>
  );
}
