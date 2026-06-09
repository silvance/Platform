"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GLOSSARY_BY_ID } from "@/content/glossary";

interface Props {
  termId: string;
  children: React.ReactNode;
}

// Inline glossary popover. The Markdown component swaps any link
// with href="glossary:<id>" for one of these. The wrapped text is
// the original term as it appeared in the source (e.g. "Prefetch",
// "$STANDARD_INFORMATION"); the popover shows the canonical
// definition from content/glossary.ts on hover, focus, or tap.
//
// Behaviour
//   - Pointer hover opens the popover.
//   - Keyboard focus opens it (so it's reachable without a mouse).
//   - Tap on touch devices opens it; tap-outside closes.
//   - The trigger is also a real link to /glossary#<id> so a
//     middle-click / Cmd-click jumps to the full entry.
export function GlossaryTerm({ termId, children }: Props) {
  const term = GLOSSARY_BY_ID[termId];
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  // Close when the user clicks somewhere outside the trigger /
  // popover. Only attached when open so we don't pay the cost on
  // every render.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (!term) {
    // Defensive: if the link rendered with an unknown id, just
    // emit the children plain. Shouldn't happen with the
    // preprocessor.
    return <>{children}</>;
  }

  return (
    <span
      ref={wrapperRef}
      style={{ position: "relative", display: "inline" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link
        href={`/glossary#${termId}`}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          // Tap behavior on touch / no-hover: first click opens
          // the popover, second click follows the link. The
          // popover-already-open case is the second click.
          if (!open && window.matchMedia("(hover: none)").matches) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        style={{
          color: "var(--accent)",
          textDecoration: "underline dotted",
          textUnderlineOffset: "3px",
          cursor: "help",
        }}
        aria-describedby={open ? `glossary-popover-${termId}` : undefined}
      >
        {children}
      </Link>
      {open && (
        <span
          id={`glossary-popover-${termId}`}
          role="tooltip"
          style={{
            position: "absolute",
            top: "1.5rem",
            left: 0,
            zIndex: 50,
            width: "min(360px, 90vw)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border, rgba(255,255,255,0.1))",
            borderRadius: "6px",
            padding: ".75rem .9rem",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            fontSize: ".85rem",
            lineHeight: 1.45,
            color: "var(--fg)",
          }}
        >
          <span
            style={{
              display: "block",
              fontWeight: 600,
              fontSize: ".95rem",
              marginBottom: ".25rem",
            }}
          >
            {term.term}
          </span>
          {/* Definition: render as plain text -- the markdown body
              would require a nested Markdown component which could
              recursively re-link glossary terms and blow the stack. */}
          <span style={{ display: "block" }}>{stripMd(term.definition)}</span>
          <span
            style={{
              display: "block",
              marginTop: ".4rem",
              fontSize: ".75rem",
              color: "var(--muted)",
            }}
          >
            Click again to open the full entry →
          </span>
        </span>
      )}
    </span>
  );
}

// Strip simple markdown formatting from a definition so the popup
// shows plain text rather than literal `**bold**` markers.
function stripMd(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}
