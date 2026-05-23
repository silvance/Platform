"use client";

import { useActionState, useState } from "react";
import type { AdminUserSummary, Role } from "@ci-train/contracts";
import { MIN_PASSWORD_LENGTH } from "@ci-train/contracts";
import {
  approveUserAction,
  resetPasswordAction,
  updateUserAction,
  type UserActionState,
} from "./actions";

const initial: UserActionState = { error: null, ok: null };

interface Props {
  user: AdminUserSummary;
  // True when this row is the currently signed-in admin. UI hides
  // self-disable and the role dropdown collapses to read-only —
  // the API enforces these too, but pre-hiding the controls makes
  // the foot-gun harder to find.
  isSelf: boolean;
}

export function UserRow({ user, isSelf }: Props) {
  const [showReset, setShowReset] = useState(false);
  const [updateState, updateAction, updating] = useActionState(
    updateUserAction,
    initial,
  );
  const [resetState, resetActionFn, resetting] = useActionState(
    resetPasswordAction,
    initial,
  );
  const [approveState, approveActionFn, approving] = useActionState(
    approveUserAction,
    initial,
  );

  // Combined banner: prefer the most recent message across all
  // three forms (update, reset-password, approve).
  const banner = pickLatest(pickLatest(updateState, resetState), approveState);

  return (
    <tr style={{ borderTop: "1px solid var(--border)", verticalAlign: "top" }}>
      <td style={cellStyle}>
        <div style={{ fontWeight: 500 }}>{user.email}</div>
        <div style={{ color: "var(--muted)", fontSize: ".85rem" }}>
          {user.displayName}
        </div>
        {isSelf ? (
          <div style={{ color: "var(--accent)", fontSize: ".75rem", marginTop: ".2rem" }}>
            (you)
          </div>
        ) : null}
      </td>
      <td style={cellStyle}>
        <RoleControl
          userId={user.id}
          role={user.role}
          disabled={isSelf}
          action={updateAction}
          pending={updating}
        />
      </td>
      <td style={cellStyle}>
        {user.approvedAt === null ? (
          <PendingApprovalControl
            userId={user.id}
            action={approveActionFn}
            pending={approving}
          />
        ) : (
          <DisabledControl
            userId={user.id}
            currentlyDisabled={user.disabled}
            locked={isSelf}
            action={updateAction}
            pending={updating}
          />
        )}
      </td>
      <td style={cellStyle}>
        <div style={{ color: "var(--muted)", fontSize: ".85rem" }}>
          {user.lastLoginAt
            ? new Date(user.lastLoginAt).toLocaleString()
            : "—"}
        </div>
      </td>
      <td style={{ ...cellStyle, minWidth: 220 }}>
        {!isSelf ? (
          showReset ? (
            <ResetPasswordForm
              userId={user.id}
              action={resetActionFn}
              pending={resetting}
              onCancel={() => setShowReset(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowReset(true)}
              style={inlineButtonStyle}
            >
              Reset password
            </button>
          )
        ) : (
          <span style={{ color: "var(--muted)", fontSize: ".85rem" }}>
            Change your own password via{" "}
            <a href="/me/security" style={{ color: "var(--accent)" }}>
              Security
            </a>
            .
          </span>
        )}
        {banner.error ? (
          <div className="tag-bad" style={{ marginTop: ".4rem" }}>
            {banner.error}
          </div>
        ) : null}
        {banner.ok ? (
          <div className="tag-ok" style={{ marginTop: ".4rem" }}>
            {banner.ok}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function RoleControl({
  userId,
  role,
  disabled,
  action,
  pending,
}: {
  userId: string;
  role: Role;
  disabled: boolean;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  if (disabled) {
    return <span className="tag-ok">{role}</span>;
  }
  return (
    <form action={action}>
      <input type="hidden" name="id" value={userId} />
      <select
        name="role"
        defaultValue={role}
        onChange={(e) => {
          // Auto-submit on change; saves the user a separate
          // "save" button per row.
          e.currentTarget.form?.requestSubmit();
        }}
        disabled={pending}
        style={selectStyle}
      >
        <option value="user">user</option>
        <option value="admin">admin</option>
      </select>
    </form>
  );
}

function PendingApprovalControl({
  userId,
  action,
  pending,
}: {
  userId: string;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={action} style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
      <input type="hidden" name="id" value={userId} />
      <span className="tag-bad" style={{ fontSize: ".75rem" }}>pending</span>
      <button type="submit" disabled={pending} style={inlineButtonStyle}>
        {pending ? "Approving…" : "Approve"}
      </button>
    </form>
  );
}

function DisabledControl({
  userId,
  currentlyDisabled,
  locked,
  action,
  pending,
}: {
  userId: string;
  currentlyDisabled: boolean;
  locked: boolean;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  if (locked) {
    return (
      <span style={{ color: "var(--muted)", fontSize: ".85rem" }}>
        can't disable self
      </span>
    );
  }
  const next = !currentlyDisabled;
  return (
    <form action={action}>
      <input type="hidden" name="id" value={userId} />
      <input type="hidden" name="disabled" value={String(next)} />
      <button
        type="submit"
        disabled={pending}
        style={{
          ...inlineButtonStyle,
          background: currentlyDisabled ? "var(--bg-sunken)" : "transparent",
        }}
      >
        {currentlyDisabled ? "Re-enable" : "Disable"}
      </button>
    </form>
  );
}

function ResetPasswordForm({
  userId,
  action,
  pending,
  onCancel,
}: {
  userId: string;
  action: (formData: FormData) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  return (
    <form action={action} style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
      <input type="hidden" name="id" value={userId} />
      <input
        name="password"
        type="password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        placeholder={`min ${MIN_PASSWORD_LENGTH} chars`}
        autoComplete="new-password"
        style={{
          ...selectStyle,
          minWidth: 160,
          padding: ".35rem .55rem",
        }}
      />
      <button type="submit" disabled={pending} style={inlineButtonStyle}>
        {pending ? "Resetting…" : "Set"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{ ...inlineButtonStyle, background: "transparent" }}
      >
        Cancel
      </button>
    </form>
  );
}

function pickLatest(
  a: UserActionState,
  b: UserActionState,
): UserActionState {
  // Either form's most recent submit wins. No timestamps on the
  // state, so just prefer whichever has a non-empty message.
  if (b.error || b.ok) return b;
  return a;
}

const cellStyle: React.CSSProperties = {
  padding: ".7rem .5rem",
};
const selectStyle: React.CSSProperties = {
  padding: ".3rem .5rem",
  background: "var(--bg-sunken)",
  border: "1px solid var(--border-strong)",
  borderRadius: 6,
  color: "var(--fg)",
  fontSize: ".9rem",
};
const inlineButtonStyle: React.CSSProperties = {
  background: "var(--bg-sunken)",
  color: "var(--fg)",
  border: "1px solid var(--border-strong)",
  borderRadius: 6,
  padding: ".3rem .65rem",
  fontSize: ".85rem",
  cursor: "pointer",
};
