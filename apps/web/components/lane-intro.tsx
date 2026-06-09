"use client";

import { useEffect, useState } from "react";
import type { Lane } from "@ci-train/contracts";
import { Markdown } from "@/components/markdown";

interface Props {
  lane: Lane;
  source: string;
}

// Lane-orientation card rendered at the top of /scenarios/lanes/<slug>.
//
// State model: default to expanded the first time the user lands on
// the lane, then default to collapsed on every subsequent visit.
// Per-lane via localStorage so a learner who's already seen the
// macOS intro doesn't get reset by visiting Linux. Always toggleable.
//
// The "seen" flag is set on first mount, not on collapse. That way
// expanding then collapsing within the same session doesn't change
// the "first time" status -- the user has now SEEN it, end of story.
export function LaneIntro({ lane, source }: Props) {
  const storageKey = `lane-intro-seen-v1:${lane}`;
  // Start expanded. We'll flip to collapsed on mount if we find a
  // "seen" record. This avoids the SSR/CSR mismatch you'd get if we
  // tried to read localStorage during render.
  const [open, setOpen] = useState(true);
  // Only render the toggle button after hydration so the initial
  // SSR markup matches the client's first render.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHydrated(true);
    try {
      const seen = window.localStorage.getItem(storageKey);
      if (seen) setOpen(false);
      else window.localStorage.setItem(storageKey, String(Date.now()));
    } catch {
      // localStorage blocked (private mode, etc.) -- harmless;
      // intro stays default-expanded.
    }
  }, [storageKey]);

  return (
    <section
      className="card"
      style={{
        marginTop: ".5rem",
        marginBottom: "1.25rem",
        padding: open ? "1rem 1.25rem" : ".5rem 1.25rem",
        background: "var(--bg-elevated)",
        borderLeft: "3px solid var(--accent)",
      }}
      aria-label="Lane orientation"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: ".75rem",
        }}
      >
        <strong
          style={{
            fontSize: ".75rem",
            textTransform: "uppercase",
            letterSpacing: ".05em",
            color: "var(--muted)",
          }}
        >
          Orientation
        </strong>
        {hydrated && (
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={{ fontSize: ".8rem", padding: ".25rem .5rem" }}
          >
            {open ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {open && (
        <div style={{ marginTop: ".5rem" }}>
          <Markdown source={source} />
        </div>
      )}
    </section>
  );
}
