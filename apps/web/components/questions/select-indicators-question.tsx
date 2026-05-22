"use client";

import { useState, useTransition } from "react";
import type { QuestionPayload, QuestionResponse } from "@ci-train/contracts";
import { saveAnswerAction } from "@/app/(authenticated)/attempts/[id]/actions";

interface Props {
  attemptId: string;
  question: QuestionPayload;
  initialSelectedIds: string[];
  locked: boolean;
}

export function SelectIndicatorsQuestion({
  attemptId,
  question,
  initialSelectedIds,
  locked,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [_pending, start] = useTransition();
  const set = question.indicatorSet;

  if (!set) {
    return (
      <div className="card">
        <p style={{ margin: 0, color: "var(--muted)" }}>
          <em>This question's indicator set is not authored yet.</em>
        </p>
      </div>
    );
  }

  function toggle(id: string) {
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persist(next);
      return next;
    });
  }

  function persist(next: Set<string>) {
    setStatus("saving");
    const body: QuestionResponse = {
      type: "select_indicators",
      data: { selectedIds: [...next] },
    };
    start(async () => {
      const r = await saveAnswerAction(attemptId, question.id, body);
      setStatus(r.ok ? "saved" : "error");
    });
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
                  cursor: locked ? "default" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(item.id)}
                  disabled={locked}
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
