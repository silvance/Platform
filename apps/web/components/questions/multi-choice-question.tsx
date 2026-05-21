"use client";

import { useState, useTransition } from "react";
import type { McOption, QuestionPayload, QuestionResponse } from "@ci-train/contracts";
import { saveAnswerAction } from "@/app/(authenticated)/attempts/[id]/actions";

interface Props {
  attemptId: string;
  question: QuestionPayload;
  initialSelectedIds: string[];
  locked: boolean;
}

export function MultiChoiceQuestion({ attemptId, question, initialSelectedIds, locked }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [_pending, start] = useTransition();
  const options: McOption[] = question.options ?? [];
  const allowMultiple = Boolean(question.allowMultiple);

  function persist(next: Set<string>) {
    setStatus("saving");
    const body: QuestionResponse = {
      type: "multi_choice",
      data: { selectedIds: [...next] },
    };
    start(async () => {
      const r = await saveAnswerAction(attemptId, question.id, body);
      setStatus(r.ok ? "saved" : "error");
    });
  }

  function toggle(id: string) {
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (allowMultiple) {
        next.has(id) ? next.delete(id) : next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      persist(next);
      return next;
    });
  }

  return (
    <div className="q-widget q-mc">
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {options.map((opt) => {
          const checked = selected.has(opt.id);
          return (
            <li key={opt.id} style={{ margin: ".3rem 0" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: ".5rem", cursor: locked ? "default" : "pointer" }}>
                <input
                  type={allowMultiple ? "checkbox" : "radio"}
                  name={`q-${question.id}`}
                  checked={checked}
                  onChange={() => toggle(opt.id)}
                  disabled={locked}
                />
                <span>{opt.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <SaveBadge status={status} />
    </div>
  );
}

function SaveBadge({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;
  if (status === "saving") return <span className="save-badge save-saving">saving…</span>;
  if (status === "saved") return <span className="save-badge save-saved">saved</span>;
  return <span className="save-badge save-error">save failed</span>;
}
