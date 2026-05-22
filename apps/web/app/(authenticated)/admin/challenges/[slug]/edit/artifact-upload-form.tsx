"use client";

import { useActionState } from "react";
import type { ActionResult } from "./actions";

interface Props {
  artifactKinds: readonly string[];
  action: (
    prev: ActionResult | undefined,
    fd: FormData,
  ) => Promise<ActionResult>;
}

export function ArtifactUploadForm({ artifactKinds, action }: Props) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  return (
    <form
      action={formAction}
      className="admin-form"
      encType="multipart/form-data"
    >
      <div className="admin-form-row">
        <label>
          Display name
          <input
            name="displayName"
            type="text"
            required
            maxLength={200}
            placeholder="e.g. suspect-email.eml"
          />
        </label>
        <label>
          Kind
          <select name="kind" required defaultValue="">
            <option value="" disabled>
              — pick one —
            </option>
            {artifactKinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Viewer hint (optional)
        <input
          name="viewerHint"
          type="text"
          maxLength={60}
          placeholder="advisory only — UI viewer dispatches by kind"
        />
      </label>

      <label>
        File
        <input name="file" type="file" required />
      </label>

      {state && !state.ok ? <p className="admin-error">{state.error}</p> : null}

      <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
        <button type="submit" className="admin-btn" disabled={pending}>
          {pending ? "Uploading…" : "Upload artifact"}
        </button>
        {state?.ok ? <span className="save-badge save-saved">uploaded</span> : null}
      </div>
    </form>
  );
}
