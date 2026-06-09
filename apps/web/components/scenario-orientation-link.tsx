"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Lane } from "@ci-train/contracts";
import { LANE_LABELS } from "@ci-train/contracts";
import { LANE_INTROS } from "@/content/lane-intros";

interface Props {
  lane: Lane;
}

// In-scenario "background reading" callout. Renders below the
// scenario title chips, surfacing the lane orientation to a
// learner who's mid-scenario and might not realise there's
// grounding material one click away.
//
// Behaviour:
//   - If the lane has no intro (foundations / ojt_bridge),
//     renders nothing.
//   - If the user hasn't yet visited the lane's orientation
//     (localStorage flag from <LaneIntro>), default-expanded:
//     shows the first paragraph of the intro + a "Read full
//     orientation →" link to the lane page.
//   - If they HAVE seen it, render the compact one-line
//     "Lane orientation →" link only. No wall of text on
//     scenarios in lanes they've already grounded in.
export function ScenarioOrientationLink({ lane }: Props) {
  const source = LANE_INTROS[lane];
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const flag = window.localStorage.getItem(`lane-intro-seen-v1:${lane}`);
      setSeen(!!flag);
    } catch {
      setSeen(false);
    }
  }, [lane]);

  if (!source) return null;

  const laneUrl = `/scenarios/lanes/${encodeURIComponent(lane)}`;
  const laneLabel = LANE_LABELS[lane];

  // Pre-hydration / "already seen": render the compact link.
  // null state (haven't read localStorage yet) takes this path
  // too so the SSR markup matches whatever the client paints
  // first frame.
  if (seen === null || seen) {
    return (
      <div
        style={{
          margin: ".5rem 0 1rem",
          fontSize: ".85rem",
          color: "var(--muted)",
        }}
      >
        <Link
          href={laneUrl}
          style={{ color: "var(--accent)", textDecoration: "none" }}
        >
          📖 {laneLabel} orientation →
        </Link>
      </div>
    );
  }

  // First-time user: show the orientation snippet inline. Pull
  // the first paragraph after the heading (skip the `# Title`
  // line, take everything up to the next blank line).
  const snippet = extractFirstParagraph(source);

  return (
    <aside
      className="card"
      style={{
        margin: ".5rem 0 1.25rem",
        padding: ".85rem 1.1rem",
        background: "var(--bg-elevated)",
        borderLeft: "3px solid var(--accent)",
      }}
      aria-label="Background reading"
    >
      <div
        style={{
          fontSize: ".75rem",
          textTransform: "uppercase",
          letterSpacing: ".05em",
          color: "var(--muted)",
          marginBottom: ".35rem",
        }}
      >
        Background reading · {laneLabel}
      </div>
      <p style={{ margin: ".25rem 0 .6rem", fontSize: ".95rem" }}>{snippet}</p>
      <Link
        href={laneUrl}
        style={{
          color: "var(--accent)",
          fontSize: ".9rem",
          textDecoration: "none",
        }}
      >
        Read the full orientation →
      </Link>
    </aside>
  );
}

// Take the first paragraph of body text out of a markdown lane
// intro: skip the top-level `# Heading` line, then return
// everything up to the next blank line.
function extractFirstParagraph(md: string): string {
  const lines = md.trim().split("\n");
  let i = 0;
  // Skip the leading heading.
  if (lines[i]?.startsWith("#")) i++;
  while (i < lines.length && lines[i]!.trim() === "") i++;
  const para: string[] = [];
  while (i < lines.length && lines[i]!.trim() !== "") {
    para.push(lines[i]!);
    i++;
  }
  // Markdown bold + inline backticks would survive; render
  // raw text so the snippet stays unstyled and tight.
  return para
    .join(" ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}
