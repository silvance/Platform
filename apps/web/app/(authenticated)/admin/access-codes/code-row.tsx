"use client";

import { useActionState } from "react";
import type { AccessCodeRecord } from "@ci-train/contracts";
import { disableAccessCodeAction, type DisableCodeState } from "./actions";

interface Props {
  code: AccessCodeRecord;
}

export function CodeRow({ code }: Props) {
  const disabled = code.disabledAt !== null;
  const expired =
    code.expiresAt !== null && new Date(code.expiresAt).getTime() <= Date.now();
  const exhausted =
    code.usesLimit !== null && code.usesCount >= code.usesLimit;
  const active = !disabled && !expired && !exhausted;

  const bound = disableAccessCodeAction.bind(null, code.id);
  const [state, run, pending] = useActionState<DisableCodeState | undefined, FormData>(
    (_prev, _fd) => bound(_prev),
    undefined,
  );

  return (
    <tr>
      <td style={cellStyle}>
        <code style={{ fontFamily: "var(--mono)", fontSize: ".95rem" }}>
          {code.code}
        </code>
        <div style={{ color: "var(--muted)", fontSize: ".82rem" }}>{code.label}</div>
      </td>
      <td style={cellStyle}>
        {active ? (
          <span className="chip chip-ok">active</span>
        ) : (
          <span className="chip chip-bad">
            {disabled ? "disabled" : expired ? "expired" : "exhausted"}
          </span>
        )}
      </td>
      <td style={cellStyle}>
        {code.usesCount}
        {code.usesLimit !== null ? ` / ${code.usesLimit}` : ""}
      </td>
      <td style={cellStyle}>
        {new Date(code.createdAt).toLocaleString()}
      </td>
      <td style={cellStyle}>
        {code.expiresAt
          ? new Date(code.expiresAt).toLocaleString()
          : <span style={{ color: "var(--muted)" }}>never</span>}
      </td>
      <td style={cellStyle}>
        {disabled ? (
          <span style={{ color: "var(--muted)" }}>—</span>
        ) : (
          <form action={run}>
            <button
              type="submit"
              disabled={pending}
              className="btn btn-ghost btn-sm"
            >
              {pending ? "Disabling…" : "Disable"}
            </button>
            {state && !state.ok ? (
              <div className="tag-bad" style={{ marginTop: ".3rem", fontSize: ".8rem" }}>
                {state.error}
              </div>
            ) : null}
          </form>
        )}
      </td>
    </tr>
  );
}

const cellStyle: React.CSSProperties = {
  padding: ".7rem .5rem",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "top",
};
