"use client";

import { useState, useTransition } from "react";
import type { McOption, QuestionPayload, QuestionResponse } from "@ci-train/contracts";
import { Markdown } from "@/components/markdown";

interface Props {
  question: QuestionPayload;
  initialSelectedIds: string[];
  disabled: boolean;
  onSubmit: (response: QuestionResponse) => void | Promise<void>;
}

// Threshold for switching from the radio-list layout to the bordered
// "draft review" card layout. When any option label exceeds this many
// characters the radio list reads as a wall of text and the cards are
// much easier to scan; below the threshold the compact list wins on
// information density. Inferred from content rather than introduced as
// a new authoring field — see /home/user/Platform issue thread.
const DRAFT_REVIEW_OPTION_CHAR_THRESHOLD = 240;

export function MultiChoiceForm({ question, initialSelectedIds, disabled, onSubmit }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds));
  const [pending, start] = useTransition();
  const options = question.options ?? [];
  const allowMultiple = Boolean(question.allowMultiple);
  const isDraftReview = shouldUseDraftReviewLayout(options);

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
    <div className={`q-widget q-mc${isDraftReview ? " q-mc-drafts" : ""}`}>
      {isDraftReview ? (
        <DraftReviewList
          options={options}
          selected={selected}
          allowMultiple={allowMultiple}
          disabled={disabled}
          questionId={question.id}
          onToggle={toggle}
        />
      ) : (
        <CompactList
          options={options}
          selected={selected}
          allowMultiple={allowMultiple}
          disabled={disabled}
          questionId={question.id}
          onToggle={toggle}
        />
      )}
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

interface ListProps {
  options: McOption[];
  selected: Set<string>;
  allowMultiple: boolean;
  disabled: boolean;
  questionId: string;
  onToggle: (id: string) => void;
}

function CompactList({ options, selected, allowMultiple, disabled, questionId, onToggle }: ListProps) {
  return (
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
                name={`q-${questionId}`}
                checked={checked}
                onChange={() => onToggle(opt.id)}
                disabled={disabled}
              />
              <span>{opt.label}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function DraftReviewList({ options, selected, allowMultiple, disabled, questionId, onToggle }: ListProps) {
  return (
    <div className="q-mc-draft-list">
      {options.map((opt, idx) => {
        const checked = selected.has(opt.id);
        const draftLetter = draftLabelFor(idx);
        const cardClass = [
          "card",
          "q-mc-draft-card",
          checked ? "q-mc-draft-card-selected" : "",
          disabled ? "q-mc-draft-card-disabled" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <label key={opt.id} className={cardClass}>
            <div className="q-mc-draft-header">
              <input
                type={allowMultiple ? "checkbox" : "radio"}
                name={`q-${questionId}`}
                checked={checked}
                onChange={() => onToggle(opt.id)}
                disabled={disabled}
              />
              <span className="q-mc-draft-tag">Draft {draftLetter}</span>
            </div>
            <div className="q-mc-draft-body">
              <Markdown source={opt.label} />
            </div>
          </label>
        );
      })}
    </div>
  );
}

// Pick the layout from the option content. The radio-list layout reads
// well up to ~moderate option lengths; once any single option crosses
// the threshold the layout reads as a wall of text and the bordered
// "draft" cards are much easier to scan. Pure inference — no authoring
// field — so existing content benefits automatically and short-option
// questions are unaffected.
export function shouldUseDraftReviewLayout(options: McOption[]): boolean {
  if (options.length < 2) return false;
  for (const opt of options) {
    if (opt.label.length > DRAFT_REVIEW_OPTION_CHAR_THRESHOLD) return true;
  }
  return false;
}

function draftLabelFor(index: number): string {
  // A, B, C, ... Z, then AA, AB, ... — well past any plausible option count.
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}
