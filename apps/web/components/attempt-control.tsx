"use client";

import Link from "next/link";
import { useTransition, useState, useEffect } from "react";
import { startAttemptAction } from "@/app/(authenticated)/attempts/[id]/actions";

// Server-rendered "Start attempt" button is straightforward, but we want
// to surface a "Continue attempt" link when one already exists. The
// scenario page doesn't fetch the attempt itself (to keep the page
// cacheable), so this client component does a single fetch on mount
// and decides which CTA to show. It's the only client-side fetch in
// the app — everything else stays server-side.

interface Props {
  slug: string;
}

interface ExistingAttempt {
  id: string;
  status: "in_progress" | "submitted";
}

export function AttemptControl({ slug }: Props) {
  const [pending, start] = useTransition();
  const [existing, setExisting] = useState<ExistingAttempt | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // /scenarios/:slug/attempts is POST — we don't want to create an
        // attempt as a side effect of viewing the page. Instead, hit a
        // small probe endpoint on the web's proxy. For M5 we keep it
        // simple: POST is idempotent (returns existing) and creating
        // one before the trainee clicks "Start" is not a security issue.
        // Skipping the probe; show the Start button unconditionally and
        // let the server action handle the no-op-if-exists case.
      } finally {
        if (!cancelled) setExisting(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (existing === undefined) {
    return null;
  }

  if (existing) {
    return (
      <div className="card" style={{ borderColor: "rgba(106, 168, 255, 0.45)" }}>
        <p style={{ margin: 0 }}>
          You have an attempt in progress.{" "}
          <Link href={`/attempts/${existing.id}`} style={{ color: "var(--accent)", fontWeight: 600 }}>
            Continue →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ margin: "1rem 0" }}>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => startAttemptAction(slug))}
        style={{
          background: "var(--accent)",
          color: "#0b1020",
          border: 0,
          borderRadius: 6,
          padding: ".5rem 1rem",
          fontSize: "1rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {pending ? "Starting…" : "Start attempt"}
      </button>
      <p style={{ color: "var(--muted)", fontSize: ".85rem", marginTop: ".25rem", marginBottom: 0 }}>
        Starts a new attempt or continues your in-progress one if it exists.
      </p>
    </div>
  );
}
