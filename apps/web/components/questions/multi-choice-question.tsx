"use client";

import { useState, useTransition } from "react";
import type { QuestionPayload, QuestionResponse } from "@ci-train/contracts";

interface Props {
  question: QuestionPayload;
  initialSelectedIds: string[];
  disabled: boolean;
  onSubmit: (response: QuestionResponse) => void | Promise<void>;
}

export function MultiChoiceForm({ question, initialSelectedIds, disabled, onSubmit }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds));
  const [pending, start] = useTransition();
  const options = question.options ?? [];
  const allowMultiple = Boolean(question.allowMultiple);

  function toggle(id: string) {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (allowMultiple) {
        next.has(id) ? next.delete(id) : next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      return next;
    });
  }

  function submit() {
    if (disabled || pending) return;
    const body: QuestionResponse = {
      type: "multi_choice",
      data: { selectedIds: [...selected] },
    };
    start(() => Promise.resolve(onSubmit(body)));
  }

  return (
    <div className="q-widget q-mc">
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {options.map((opt) => {
          const checked = selected.has(opt.id);
          return (
            <li key={opt.id} style={{ margin: ".3rem 0" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: ".5rem",
                  cursor: disabled ? "default" : "pointer",
                }}
              >
                <input
                  type={allowMultiple ? "checkbox" : "radio"}
                  name={`q-${question.id}`}
                  checked={checked}
                  onChange={() => toggle(opt.id)}
                  disabled={disabled}
                />
                <span>{opt.label}</span>
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
