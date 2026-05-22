"use client";

import { useActionState } from "react";
import Link from "next/link";
import { importPackAction, type ImportResult } from "./import-actions";

export function ImportPackForm() {
  const [state, action, pending] = useActionState<
    ImportResult | undefined,
    FormData
  >(importPackAction, undefined);

  return (
    <form
      action={action}
      className="admin-form"
      encType="multipart/form-data"
    >
      <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: 0 }}>
        Upload a <code>.zip</code> exported from another deployment. The
        imported scenario lands as a <strong>draft</strong> — publish it
        explicitly after spot-checking on this install.
      </p>
      <label>
        Pack file
        <input name="file" type="file" accept=".zip,application/zip" required />
      </label>
      {state && !state.ok ? <p className="admin-error">{state.error}</p> : null}
      {state?.ok ? (
        <div className="card" style={{ borderColor: "rgba(74,222,128,.4)" }}>
          <p style={{ margin: 0 }}>
            Imported{" "}
            <Link
              href={`/admin/challenges/${state.result.slug}/edit`}
              style={{ color: "var(--accent)" }}
            >
              <code>{state.result.slug}</code>
            </Link>{" "}
            — {state.result.artifactsImported} artifact(s),{" "}
            {state.result.indicatorSetsImported} indicator set(s),{" "}
            {state.result.questionsImported} question(s).
          </p>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
        <button type="submit" className="admin-btn" disabled={pending}>
          {pending ? "Importing…" : "Import pack"}
        </button>
      </div>
    </form>
  );
}
